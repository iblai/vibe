import { NextRequest, NextResponse } from "next/server";
// Relative import (not @/): __tests__ invoke this handler under vitest, which
// resolves no path alias.
import { PAYWALL_APP_SLUG, dmPaywallFetch, userFromRequest } from "../../../../lib/paywall";

const ALLOWED_PRICE_IDS = (process.env.PAYWALL_PRICE_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Embedded is the default: the buyer pays without leaving the app. Opt out with
// PAYWALL_EMBEDDED=0, which is only needed when the organization's Stripe source
// carries no publishable key — a connected account always has one, a pasted
// restricted key only if the credential stores it too. /paywall/setup says which.
const EMBEDDED = !["0", "false"].includes((process.env.PAYWALL_EMBEDDED ?? "").toLowerCase());

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not a platform member" }, { status: 401 });
  if (!PAYWALL_APP_SLUG)
    return NextResponse.json({ error: "PAYWALL_APP_SLUG not set" }, { status: 500 });

  const { price_id } = await req.json().catch(() => ({}) as any);
  if (!price_id || !ALLOWED_PRICE_IDS.includes(price_id))
    return NextResponse.json({ error: "Unknown price_id" }, { status: 400 });

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  // Embedded takes no redirect URLs — Stripe never leaves the page, and the
  // app confirms through /paywall/return with the session id instead.
  const mode = EMBEDDED
    ? { ui_mode: "embedded" }
    : {
        success_url: `${origin}/paywall/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/paywall`,
      };
  const res = await dmPaywallFetch(user.username, "/paywall/checkout/", {
    method: "POST",
    body: JSON.stringify({ price_id, app: PAYWALL_APP_SLUG, ...mode }),
  });
  // DM 400s are actionable (missing credential, wrong app tag, bad URL host) — pass through.
  return NextResponse.json(await res.json(), { status: res.status });
}
