"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkPaywallAccess } from "@/components/paywall-gate";
import { PaywallEmbedded, type EmbeddedSession } from "@/components/paywall-embedded";

/** Entitled users landing here go straight back into the app. */
export function PaywallAutoVerify() {
  const router = useRouter();
  useEffect(() => {
    checkPaywallAccess().then((granted) => granted && router.replace("/"));
  }, [router]);
  return null;
}

export function BuyButton({ priceId }: { priceId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<EmbeddedSession | null>(null);

  const buy = async () => {
    setBusy(true);
    setError("");
    const token = localStorage.getItem("dm_token") ?? "";
    const res = await fetch("/api/paywall/checkout", {
      method: "POST",
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ price_id: priceId }),
    });
    const data = await res.json().catch(() => null);
    // The server route decides which the platform minted: by default a
    // client_secret to render in place, or — under PAYWALL_EMBEDDED=0 — a
    // checkout_url to redirect to.
    if (data?.checkout_url) {
      window.location.href = data.checkout_url;
      return;
    }
    if (data?.client_secret) {
      setSession(data as EmbeddedSession);
      return;
    }
    setError(data?.error ?? data?.detail ?? "Could not start checkout");
    setBusy(false);
  };

  if (session) return <PaywallEmbedded session={session} />;

  return (
    <div className="space-y-2">
      <button
        onClick={buy}
        disabled={busy}
        className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#2563EB] to-[#93C5FD] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Redirecting…" : "Continue to payment"}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function RestoreAccessButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  const restore = async () => {
    setMessage("");
    const granted = await checkPaywallAccess();
    if (granted) router.replace("/");
    else setMessage("No payment found for your account.");
  };

  return (
    <div className="space-y-1">
      <button
        onClick={restore}
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        Already paid? Restore access
      </button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
