"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";

/** What the platform answers for `ui_mode: "embedded"`. */
export type EmbeddedSession = {
  client_secret: string;
  session_id: string;
  publishable_key: string;
  stripe_account: string | null;
};

/**
 * Stripe's own payment form, rendered in the page instead of a redirect.
 *
 * The platform minted the session; the browser only renders it — with the
 * platform's publishable key acting for the organization's connected account
 * when there is one (`stripeAccount`). Stripe never redirects here
 * (`redirect_on_completion: never`), so completion routes through the existing
 * return page, which confirms with the session id.
 */
export function PaywallEmbedded({ session }: { session: EmbeddedSession }) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let checkout: StripeEmbeddedCheckout | null = null;

    (async () => {
      const stripe = await loadStripe(
        session.publishable_key,
        session.stripe_account ? { stripeAccount: session.stripe_account } : undefined,
      );
      if (!stripe) throw new Error("Stripe.js could not be loaded.");
      checkout = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: async () => session.client_secret,
        onComplete: () =>
          router.replace(`/paywall/return?session_id=${encodeURIComponent(session.session_id)}`),
      });
      if (cancelled || !mountRef.current) {
        checkout.destroy();
        return;
      }
      checkout.mount(mountRef.current);
    })().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Could not open the payment form.");
    });

    return () => {
      cancelled = true;
      checkout?.destroy();
    };
  }, [session, router]);

  return (
    <div className="space-y-2">
      <div ref={mountRef} />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
