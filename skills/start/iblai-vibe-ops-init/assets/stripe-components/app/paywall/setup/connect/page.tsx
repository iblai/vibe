"use client";

import { PaywallSetup } from "@/components/paywall-setup";

/**
 * Connect with Stripe, for a paid answer while the organization has no Stripe
 * source yet. Stripe's consent page returns here, where the retry button is.
 */
export default function PaywallConnectPage() {
  return <PaywallSetup step="connect" />;
}
