"use client";

import { Suspense, useState } from "react";
import { OnboardingShell } from "@iblai/iblai-js/web-containers";
import { isTenantAdmin } from "@/lib/iblai/tenant";
import { SetupScreen } from "@/components/setup/setup-screen";

/**
 * First-run setup for org admins: name the app, pick or create its agent.
 * Outside the (app) group on purpose — sign-in gated by the providers, but no
 * navbar: the SDK's onboarding canvas is the whole page.
 */
export default function SetupPage() {
  // Read once on the client: the providers hold this tree until mounted.
  const [isAdmin] = useState(() => typeof window !== "undefined" && isTenantAdmin());

  if (isAdmin) {
    return (
      <Suspense fallback={null}>
        <SetupScreen />
      </Suspense>
    );
  }
  return (
    <OnboardingShell totalSteps={1} currentStep={1}>
      <p role="alert" className="text-sm text-destructive">
        Only organization admins can set up this app.
      </p>
    </OnboardingShell>
  );
}
