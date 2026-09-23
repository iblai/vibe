"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingScreen } from "@/components/loading-screen";
import config from "@/lib/iblai/config";
import {
  type Access,
  checkAccess,
  errorMessage,
  errorWithStatus,
  fetchCatalogue,
  startCheckout,
} from "@/lib/paywall-client";

const POLL_MS = 3_000;
const DEADLINE_MS = 60_000;

type State = "loading" | "checkout" | "confirming" | "error";

/**
 * Stripe's checkout, rendered in a modal (embedded mode, no redirect) on the
 * organization's Stripe source — the session, the publishable key and the
 * connected account all come from the platform's own answer to the member's
 * checkout call, made from this browser with the member's own token. When
 * Stripe reports completion the platform verifies the session and {onPaid}
 * fires. Closing the modal changes nothing.
 */
export function PayModal({
  open,
  onClose,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [access, setAccess] = useState<Access | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);
  const sessionRef = useRef("");
  const name = config.appName() || "this app";

  // Open: the price, the session (with the key and account), Stripe.js, then
  // the checkout. It mounts once its div is on screen (the effect below), and
  // is torn down on close.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fail = (e: unknown) => {
      if (cancelled) return;
      setError(errorWithStatus(e));
      setState("error");
    };
    const confirm = async () => {
      setState("confirming");
      const deadline = Date.now() + DEADLINE_MS;
      let last = "We couldn’t confirm your payment yet.";
      while (!cancelled && Date.now() < deadline) {
        try {
          const { has_access } = await checkAccess(sessionRef.current);
          if (has_access === true) {
            onPaid();
            return;
          }
        } catch (e) {
          last = errorMessage(e);
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
      fail(new Error(last));
    };
    (async () => {
      const catalogue = await fetchCatalogue();
      if (!catalogue.price)
        throw new Error("Nothing is for sale yet; an admin sets the price at /paywall/setup.");
      setAccess(catalogue.settings?.access ?? null);
      // The platform's 400s (not the recorded price, no publishable key on its
      // Stripe source) surface verbatim: the admin who debugs them reads them.
      const session = await startCheckout(catalogue.price.id);
      if (!session.publishable_key)
        throw new Error("The organization’s Stripe source has no publishable key.");
      const stripe = await loadStripe(
        session.publishable_key,
        session.stripe_account ? { stripeAccount: session.stripe_account } : undefined,
      );
      if (!stripe) throw new Error("Stripe.js could not be loaded.");
      if (cancelled) return;
      sessionRef.current = session.session_id;
      const checkout = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: async () => session.client_secret,
        onComplete: () => void confirm(),
      });
      if (cancelled) {
        checkout.destroy();
        return;
      }
      checkoutRef.current = checkout;
      setState("checkout");
    })().catch(fail);
    return () => {
      cancelled = true;
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
    };
    // `onPaid` is read when the payment completes; the effect keys on open only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (state === "checkout" && mountRef.current && checkoutRef.current)
      checkoutRef.current.mount(mountRef.current);
  }, [state]);

  const close = () => {
    setState("loading");
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && state !== "confirming" && close()}>
      {/* Wide enough for Stripe's two-column layout (summary left, fields
          right), so the form fits a laptop screen; the viewport is the height
          cap, and scrolling is only the fallback on a short window. */}
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[min(1080px,calc(100%-2rem))]"
      >
        <DialogTitle>Pay to continue</DialogTitle>
        {/* Stripe's form names the product and the price itself. */}
        {state !== "checkout" && (
          <DialogDescription>
            {access === "monthly"
              ? `A subscription unlocks ${name}; cancel any time.`
              : access === "one_time"
                ? `One payment unlocks ${name}.`
                : `Payment unlocks ${name}.`}
          </DialogDescription>
        )}
        {state === "loading" && <LoadingScreen className="min-h-0 py-6" />}
        {state === "confirming" && (
          <LoadingScreen className="min-h-0 py-6" message="Confirming your payment…" />
        )}
        <div ref={mountRef} className={state === "checkout" ? "" : "hidden"} />
        {state === "error" && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogClose
          disabled={state === "confirming"}
          className="self-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Not now
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
