import { NextRequest, NextResponse } from "next/server";
// Relative imports (not @/): __tests__ invoke this handler under vitest.
import config from "../../../../../lib/iblai/config";
import {
  ACCESS_VALUES,
  paywallSlug,
  sourceWarning,
  type Access,
} from "../../../../../lib/paywall-client";
import {
  PaywallUpstreamError,
  adminCaller,
  dmConnectFetchAs,
  dmJson,
  dmStripeFetchAs,
  failure,
  isResponse,
  jsonBody,
  planName,
  readAppPaymentInfo,
  writeAppPaymentInfo,
  type AppPaymentInfo,
  type DmInit,
} from "../../../../../lib/paywall";

/**
 * The whole paywall setup in one call: free, one-time or monthly (USD). Every
 * platform call carries the admin's OWN token, so the platform decides who may
 * do this (403 otherwise). Paid order: ask the platform which Stripe source it
 * runs on (none, or one without a publishable key → 400, nothing touched) →
 * retire the previous price (a 404 is nothing to retire: after a reconnect it
 * lives on another account) → reuse the product tagged for this app, or create
 * one → create the price → record the choice, with that source's publishable
 * key and account, in the organization's metadata. Free makes ZERO Stripe or
 * connect calls, ever — it only records the choice — because free must never
 * need a Stripe account. A client Idempotency-Key makes a retried submit safe.
 */
export async function POST(req: NextRequest) {
  const caller = await adminCaller(req);
  if (isResponse(caller)) return caller;
  const { access, amount } = await jsonBody(req);
  if (!ACCESS_VALUES.includes(access as Access))
    return NextResponse.json(
      { error: "access must be free, one_time or monthly" },
      { status: 400 },
    );
  const paid = access !== "free";
  if (paid && (!Number.isInteger(amount) || (amount as number) <= 0))
    return NextResponse.json(
      { error: "amount must be a positive integer (cents)" },
      { status: 400 },
    );

  const key = req.headers.get("idempotency-key");
  const idem = (suffix: string): Record<string, string> =>
    key ? { "Idempotency-Key": `${key}-${suffix}` } : {};
  const stripe = (path: string, init?: DmInit) =>
    dmStripeFetchAs(caller.token, caller.username, path, init).then(dmJson);

  try {
    const slug = paywallSlug();
    const { current, platformName, appName } = await readAppPaymentInfo();
    // The organization's Stripe source right now: what the product and price
    // are created on, and whose publishable key and account the record carries.
    const source = paid
      ? await dmJson(await dmConnectFetchAs(caller.token, caller.username))
      : null;
    if (paid && !source?.source)
      return NextResponse.json({ error: "Connect a Stripe account first" }, { status: 400 });
    // Embedded checkout renders with the source's publishable key: recording a
    // paid plan without one would let every member's checkout fail instead.
    const blocked = paid ? sourceWarning(source) : "";
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });

    // Raw, not validated: the record the previous release wrote has no `access`.
    const recorded = current?.stripe && typeof current.stripe === "object" ? current.stripe : {};
    let productId: string | null = recorded.product_id ? String(recorded.product_id) : null;
    let priceId: string | null = null;

    if (paid) {
      // 1. The previous price stops being sellable. Paid only: archiving needs
      //    the Stripe source, which free must never require. A price left
      //    behind by a paid → free switch stays active on Stripe but is never
      //    sold — members can buy only the recorded price_id (null for free).
      if (recorded.price_id) {
        try {
          await stripe(`/prices/${encodeURIComponent(String(recorded.price_id))}/`, {
            method: "POST",
            headers: idem("archive"),
            body: JSON.stringify({ active: false }),
          });
        } catch (e) {
          // Gone (another Stripe account after a reconnect, or deleted):
          // nothing to retire. Anything else is real.
          if (!(e instanceof PaywallUpstreamError && e.status === 404)) throw e;
        }
      }
      // 2. The product: reuse ours while it is still active and tagged, else
      //    create one, named after the app — what Stripe's checkout shows.
      if (productId) {
        let product: any = null;
        try {
          product = await stripe(`/products/${encodeURIComponent(productId)}/`);
        } catch (e) {
          if (!(e instanceof PaywallUpstreamError && e.status === 404)) throw e;
        }
        if (product?.active === false || product?.metadata?.app !== slug) productId = null;
      }
      if (!productId) {
        const product = await stripe("/products/", {
          method: "POST",
          headers: idem("product"),
          body: JSON.stringify({
            name: appName || config.appName() || platformName || slug,
            metadata: { app: slug },
          }),
        });
        productId = String(product.id);
      }
      // 3. The price. USD only; monthly is a subscription.
      const price = await stripe("/prices/", {
        method: "POST",
        headers: idem("price"),
        body: JSON.stringify({
          product: productId,
          unit_amount: amount,
          currency: "usd",
          nickname: planName(access as Access),
          ...(access === "monthly" && { recurring: { interval: "month" } }),
        }),
      });
      priceId = String(price.id);
    }

    // 4. Record the choice, nulls included: the platform merges and cannot
    //    delete keys, so a price left out would stay recorded — and for sale.
    const info: AppPaymentInfo = {
      version: 1,
      access: access as Access,
      amount: paid ? (amount as number) : null,
      currency: paid ? "usd" : null,
      stripe: {
        product_id: productId,
        price_id: priceId,
        publishable_key: (paid && source.publishable_key) || null,
        stripe_account: (paid && source.stripe_account) || null,
      },
      updated_at: new Date().toISOString(),
      updated_by: caller.username,
    };
    await writeAppPaymentInfo(caller.token, info);
    return NextResponse.json({ info });
  } catch (e) {
    return failure(e);
  }
}
