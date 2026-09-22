"use client";

import { Suspense, useState } from "react";
import { isTenantAdmin } from "@/lib/iblai/tenant";
import { PaywallConnect } from "@/components/paywall-connect";

/**
 * Link the organization's Stripe account to this app.
 *
 * Outside the (app) group on purpose: PaywallGate would bounce the very admin
 * who came here to make payments work. The admin check below is a UI hint
 * only — the platform enforces Ibl.Mentor/StripeConnect/* on every call this
 * screen makes, and answers 403 to anyone else.
 */
export default function PaywallSetupPage() {
  // Read once on the client: the providers hold this tree until mounted.
  const [isAdmin] = useState(() => typeof window !== "undefined" && isTenantAdmin());

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Payments setup</h1>
        {isAdmin ? (
          <Suspense fallback={null}>
            <PaywallConnect />
          </Suspense>
        ) : (
          <p role="alert" className="text-sm text-destructive">
            Only organization admins can set up payments.
          </p>
        )}
      </div>
    </main>
  );
}
