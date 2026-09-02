"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { checkPaywallAccess } from "@/components/paywall-gate";

function ReturnInner() {
  const router = useRouter();
  const sessionId = useSearchParams().get("session_id") ?? undefined;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    checkPaywallAccess(sessionId).then((granted) =>
      granted ? router.replace("/") : setFailed(true),
    );
  }, [sessionId, router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      {failed ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-foreground">We couldn&apos;t confirm your payment yet.</p>
          <Link href="/paywall" className="text-sm text-primary underline-offset-4 hover:underline">
            Back to pricing
          </Link>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Confirming your payment...</p>
      )}
    </main>
  );
}

export default function PaywallReturnPage() {
  return (
    <Suspense fallback={null}>
      <ReturnInner />
    </Suspense>
  );
}
