"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/loading-screen";
import { isTenantAdmin } from "@/lib/iblai/tenant";
import {
  checkPaywallSetup,
  errorWithStatus,
  hasPaidAccess,
  setupSettled,
} from "@/lib/paywall-client";

/**
 * Wraps the (app) group. An organization admin is never charged: they go
 * straight in, and — one quiet check per session — an admin who has not
 * answered the paywall question yet is taken to it, whichever page they opened.
 * Everyone else goes in without a Stripe call while nothing is for sale;
 * otherwise the platform's verdict lets them in or sends them to /paywall. A
 * check that fails is shown with the platform's words, never a silent pass.
 */
export function PaywallGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  // Read once on the client: the providers hold this tree until mounted.
  const [admin] = useState(isTenantAdmin);
  const [state, setState] = useState<"checking" | "in" | "failed">(admin ? "in" : "checking");
  const [error, setError] = useState("");

  useEffect(() => {
    if (admin) {
      if (!setupSettled())
        void checkPaywallSetup().then((s) => {
          if (s === "undecided") router.replace("/paywall/setup");
        });
      return;
    }
    if (state !== "checking") return;
    let cancelled = false;
    hasPaidAccess()
      .then((ok) => {
        if (cancelled) return;
        if (ok) setState("in");
        else router.replace("/paywall");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(errorWithStatus(e));
        setState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [admin, state, router]);

  if (state === "checking") return <LoadingScreen className="min-h-0 flex-1" />;
  if (state === "failed")
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p role="alert" className="max-w-md text-sm text-destructive">
          {error}
        </p>
        <button
          onClick={() => setState("checking")}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  return <>{children}</>;
}
