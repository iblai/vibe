"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/loading-screen";
import { PayModal } from "@/components/pay-modal";
import config from "@/lib/iblai/config";
import { isTenantAdmin } from "@/lib/iblai/tenant";
import {
  type Catalogue,
  errorWithStatus,
  fetchCatalogue,
  hasPaidAccess,
  priceText,
  resetPaidAccess,
  restoreAccess,
} from "@/lib/paywall-client";

/**
 * Where PaywallGate sends a member who has not paid. Outside the (app) group —
 * the gate would loop — but inside the providers, so everyone here is signed
 * in. An admin, a member whose payment grants, or anyone while nothing is for
 * sale goes straight back into the app; the price comes from what the admin
 * saved at /paywall/setup, and paying happens in the modal, on this page.
 */
export default function PaywallPage() {
  const router = useRouter();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (isTenantAdmin()) {
      router.replace("/");
      return;
    }
    hasPaidAccess()
      .then(async (ok) => {
        if (ok) router.replace("/");
        else setCatalogue(await fetchCatalogue());
      })
      .catch((e: unknown) => setError(errorWithStatus(e)));
  }, [router]);

  const restore = async () => {
    setNote("");
    try {
      if (await restoreAccess()) router.replace("/");
      else setNote("No payment found for your account.");
    } catch (e) {
      setNote(errorWithStatus(e));
    }
  };

  if (!catalogue && !error) return <LoadingScreen />;
  const price = priceText(catalogue?.price ?? null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="bg-gradient-to-r from-[#00b0ef] to-[#0058cc] bg-clip-text text-4xl font-bold text-transparent">
          Unlock {config.appName() || "this app"}
        </h1>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : catalogue?.price ? (
          <div className="space-y-3 rounded-lg border border-border bg-background p-6">
            {price && <p className="text-3xl font-bold text-foreground">{price}</p>}
            <button
              onClick={() => setPaying(true)}
              className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#2563EB] to-[#93C5FD] px-4 py-2 text-sm font-medium text-white"
            >
              Continue to payment
            </button>
          </div>
        ) : (
          // For sale, yet no price recorded: only an admin can finish it.
          <p role="alert" className="text-sm text-destructive">
            This app’s price is not set up yet. An admin finishes it at /paywall/setup.
          </p>
        )}
        <div className="space-y-1">
          <button
            onClick={restore}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Already paid? Restore access
          </button>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
      </div>
      <PayModal
        open={paying}
        onClose={() => setPaying(false)}
        onPaid={() => {
          resetPaidAccess();
          router.replace("/");
        }}
      />
    </main>
  );
}
