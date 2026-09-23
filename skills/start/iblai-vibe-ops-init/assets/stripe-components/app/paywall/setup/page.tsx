"use client";

import { PaywallSetup } from "@/components/paywall-setup";

/**
 * The paywall's setup: how people get in. Outside the (app) group on purpose —
 * PaywallGate would bounce the very admin who came here — and admin-only: the
 * screen says so, and the platform refuses everyone else on every call.
 */
export default function PaywallSetupPage() {
  return <PaywallSetup step="access" />;
}
