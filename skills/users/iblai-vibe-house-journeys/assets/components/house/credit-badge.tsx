"use client";

import { CreditBalance, isPlatformNavbarCreditBalanceVisible } from "@iblai/iblai-js/web-containers";
import { isTrialUser, mainOrg, readTenants, readUserEmail, readUsername } from "@/lib/iblai/house-journeys";

/**
 * The OS's credit badge under the SDK's own visibility rule: a live admin of
 * an organization with the paywall (plan, Upgrade, Add Credits, Manage
 * Billing), or a trial user on the community organization ("Free",
 * Upgrade Plan). The SDK handles every checkout. Place it in the top bar.
 */
export function CreditBadge({
  org,
  isLiveAdmin,
  className,
}: {
  org: string;
  /** Admin AND in Admin mode. */
  isLiveAdmin: boolean;
  className?: string;
}) {
  const tenants = readTenants();
  const main = mainOrg();
  const username = readUsername();
  const email = readUserEmail();
  const visible = isPlatformNavbarCreditBalanceVisible({
    tenantKey: org,
    currentTenant: { key: org, show_paywall: tenants.find((t) => t.key === org)?.show_paywall ?? null },
    // The hosted platform's ecommerce switch is on.
    stripeEnabled: true,
    isLiveAdmin,
    userOnFreeTrial: isTrialUser(org, tenants, main),
    mainPlatformKey: main,
    currentUserEmail: email,
    username,
  });
  if (!visible) return null;
  return (
    <CreditBalance
      tenant={org}
      username={username}
      mainPlatformKey={main}
      currentUserEmail={email}
      redirectUrl={typeof window === "undefined" ? "" : window.location.origin}
      enabled
      className={className}
    />
  );
}
