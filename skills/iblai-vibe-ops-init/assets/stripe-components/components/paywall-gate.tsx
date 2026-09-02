"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const OK_KEY = "paywall_ok_at";
const OK_TTL_MS = 60_000;

/** GET /api/paywall/access with the user's dm_token; stamps the grant cache. */
export async function checkPaywallAccess(sessionId?: string): Promise<boolean> {
  const token = localStorage.getItem("dm_token") ?? "";
  const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  const res = await fetch(`/api/paywall/access${qs}`, {
    headers: { Authorization: `Token ${token}` },
  });
  const data = await res.json().catch(() => null);
  if (data?.has_access) sessionStorage.setItem(OK_KEY, String(Date.now()));
  return !!data?.has_access;
}

export function PaywallGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  // ponytail: sessionStorage grant cache (~60s) only de-flashes hard
  // navigations; the DM stays the entitlement authority.
  const [ok, setOk] = useState(() => {
    if (typeof window === "undefined") return false;
    return Date.now() - Number(sessionStorage.getItem(OK_KEY) ?? 0) < OK_TTL_MS;
  });

  // Mount-only check. ponytail: enforcement is client-side — this starter's
  // server HTML carries no user data, so a bypass only shows the empty shell;
  // real data still requires the user's own tokens.
  useEffect(() => {
    if (ok) return;
    checkPaywallAccess()
      .then((granted) => (granted ? setOk(true) : router.replace("/paywall")))
      .catch(() => router.replace("/paywall"));
  }, [ok, router]);

  if (!ok)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  return <>{children}</>;
}
