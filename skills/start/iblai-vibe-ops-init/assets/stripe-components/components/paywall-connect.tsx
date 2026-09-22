"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ConnectError,
  type ConnectStatus,
  disconnect,
  getConnectStatus,
  reasonText,
  startConnect,
} from "@/lib/paywall-connect";

const message = (e: unknown, fallback: string) =>
  e instanceof ConnectError ? e.message : fallback;

/** `Yes` / `No`, so a half-finished Stripe account reads at a glance. */
const yesNo = (v: boolean | undefined) => (v ? "Yes" : "No");

function summary(status: ConnectStatus): string {
  if (status.source === "key")
    return "Running on the restricted key in this organization's credentials, which wins over any linked account.";
  if (status.source === "connected") return "Connected to a Stripe account.";
  return "No Stripe account linked yet — the app cannot charge.";
}

/**
 * Link, inspect or unlink the organization's own Stripe account. Every call
 * goes out on the admin's own session token; the platform enforces
 * Ibl.Mentor/StripeConnect/* and answers 403 to anyone else.
 */
export function PaywallConnect() {
  const params = useSearchParams();
  const outcome = params.get("stripe_connect") ?? "";
  const reason = params.get("reason") ?? "";
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setError("");
    try {
      setStatus(await getConnectStatus(refresh));
    } catch (e) {
      setError(message(e, "Could not read the Stripe status."));
    }
  }, []);

  // Returning from Stripe with `connected` means the link was just written —
  // read past the snapshot cached for up to a minute so the card is not stale.
  useEffect(() => {
    void load(outcome === "connected");
  }, [load, outcome]);

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      window.location.href = await startConnect(`${window.location.origin}/paywall/setup`);
    } catch (e) {
      setError(message(e, "Could not start the connection."));
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (
      !window.confirm(
        "Disconnect this Stripe account? The app cannot charge until one is linked again.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await disconnect();
      await load(true);
    } catch (e) {
      setError(message(e, "Could not disconnect."));
    } finally {
      setBusy(false);
    }
  };

  const rows: [string, string][] = [];
  if (status?.connected) {
    if (status.business_name) rows.push(["Account", status.business_name]);
    if (status.account_id) rows.push(["Account id", status.account_id]);
    rows.push(["Can charge cards", yesNo(status.charges_enabled)]);
    rows.push(["Details submitted", yesNo(status.details_submitted)]);
    if (status.livemode === false) rows.push(["Mode", "Test"]);
    if (status.stale)
      rows.push(["Snapshot", "Stripe could not be reached — this may be out of date"]);
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background p-6 text-left">
      {outcome === "connected" && (
        <p className="text-xs text-muted-foreground">Stripe account linked.</p>
      )}
      {outcome === "error" && (
        <p role="alert" className="text-xs text-destructive">
          {reasonText(reason)}
        </p>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Stripe</p>
        <p className="text-xs text-muted-foreground">
          {/* A failed read must stop claiming to be in progress — the reason is below. */}
          {status ? summary(status) : error ? "Stripe status unavailable." : "Checking Stripe…"}
        </p>
      </div>

      {rows.length > 0 && (
        <dl className="space-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 text-xs">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Checkout renders in the app by default, and that needs a publishable
          key — so a source without one is a warning, not a footnote. */}
      {status &&
        (status.publishable_key ? (
          <p className="text-xs text-muted-foreground">
            This source has a publishable key, so checkout renders inside the app.
          </p>
        ) : (
          <p role="alert" className="text-xs text-destructive">
            This source has no publishable key, which the in-app checkout needs — buying will fail.
            Store the publishable key (<code>pk_…</code>, it is public) beside the restricted key in
            the platform&apos;s <code>stripe</code> credential, or set{" "}
            <code>PAYWALL_EMBEDDED=0</code> to redirect to Stripe instead.
          </p>
        ))}

      {status && !status.connected && !status.available && (
        <p role="alert" className="text-xs text-destructive">
          This platform has nowhere to keep the connect state, so a new connection cannot be
          started. An operator has to apply the pending migration or give it a working cache. A
          pasted restricted key still works meanwhile.
        </p>
      )}

      <div className="space-y-2">
        {status && status.source === null && status.available && (
          <button
            onClick={connect}
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {busy ? "Opening Stripe…" : "Connect with Stripe"}
          </button>
        )}
        {status?.connected && (
          <button
            onClick={unlink}
            disabled={busy}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            Disconnect this Stripe account
          </button>
        )}
        {status && !status.connected && !status.key_credential_set && (
          <p className="text-xs text-muted-foreground">
            An admin can instead add a restricted key named <code>stripe</code> in the
            platform&apos;s credentials screen — never paste one here.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
