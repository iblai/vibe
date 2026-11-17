"use client";

import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getUserEmail,
  setOpenAppleRestrictionModal,
  setOpenContactAdminModal,
  setOpenPricingModal,
  use402ErrorCheck,
  useSubscriptionConfig,
  type CreditExhaustion,
} from "@iblai/iblai-js/web-utils";
import {
  AppleRestrictionModal,
  ContactAdminModal,
  UpgradePackageModal,
} from "@iblai/iblai-js/web-containers";
import { loginReturnUrl } from "@/lib/iblai/auth-utils";
import { resolveAppTenant } from "@/lib/iblai/tenant";
import type { IblaiRootState } from "@/store/iblai-store";

/**
 * The DOM event `<agent-ai>` dispatches for an embedded agent's
 * `credits.exhausted` frame (`CREDIT_EXHAUSTION_EVENT` in `@iblai/agent-ai`;
 * spelled out here so this chunk does not load the web component for a string).
 */
export const CREDIT_EXHAUSTION_EVENT = "creditsexhausted";

/**
 * One REST 402 reaches the data layer's handler twice (before its throw and
 * again in its catch), so two events this close together are one refusal.
 */
const REPEAT_WINDOW_MS = 1_000;

/**
 * What the app shows when credits run out. The SDK decides the next step in
 * `use402ErrorCheck` and only flips flags on the `subscription` /
 * `appleRestriction` store slices; this component is where those flags become
 * screens, at page size, for everything on this page:
 *
 * - `<Chat>` (the in-process chat) — its default `on402Error` is this hook.
 * - The free-trial gate (`useShowFreeTrialDialog().executeWithTrialCheck`)
 *   and the navbar's credit balance.
 * - The app's own REST calls: the providers dispatch a credits 402 as the
 *   same `creditsexhausted` event.
 * - An embedded OS agent (`<agent-ai handlecreditexhaustion>`): instead of a
 *   modal inside the chat widget, the element re-dispatches the agent's frame
 *   as a `creditsexhausted` DOM event, fed here to the same `handle402Error`.
 *
 * Who sees what: an admin is sent to `/admin/billing` (the provider's
 * `openBillingTab`); a free-trial user (signed up on the platform's main
 * organization, the SDK's `mainTenantKey`, and in no other) or anyone whose
 * 402 carries a `pricing_table` gets the plan picker (`UpgradePackageModal`);
 * everyone else the contact-your-admin notice. A desktop/iOS build that may
 * not sell in-app gets the Apple-restriction modal. Mounted once in
 * `app/(app)/layout.tsx`.
 */
export function CreditExhaustionHandler() {
  const dispatch = useDispatch();
  const { handle402Error } = use402ErrorCheck();
  // The platform's main organization (`main` unless the provider says
  // otherwise): where free-trial users live and the only one that lists and
  // changes plans. Never this app's organization.
  const { mainTenantKey: platformMainOrg } = useSubscriptionConfig();
  const lastHandledAt = useRef(0);
  const openPricingModal = useSelector(
    (state: IblaiRootState) => state.subscription.openPricingModal,
  );
  const openContactAdminModal = useSelector(
    (state: IblaiRootState) => state.subscription.openContactAdminModal,
  );
  const openAppleRestrictionModal = useSelector(
    (state: IblaiRootState) => state.appleRestriction.openAppleRestrictionModal,
  );

  useEffect(() => {
    const onCreditsExhausted = (event: Event) => {
      const frame = (event as CustomEvent<CreditExhaustion | undefined>).detail;
      if (!frame || typeof frame !== "object") return;
      const now = Date.now();
      if (now - lastHandledAt.current < REPEAT_WINDOW_MS) return;
      lastHandledAt.current = now;
      void handle402Error({
        error: frame.error,
        message: frame.message,
        pricing_table: frame.pricing_table,
      });
    };
    document.addEventListener(CREDIT_EXHAUSTION_EVENT, onCreditsExhausted);
    return () =>
      document.removeEventListener(CREDIT_EXHAUSTION_EVENT, onCreditsExhausted);
  }, [handle402Error]);

  return (
    <>
      {openPricingModal && (
        <UpgradePackageModal
          open={openPricingModal}
          onClose={() => dispatch(setOpenPricingModal(false))}
          // Where Stripe sends the person back after checkout: the login page
          // with this app nested inside. The checkout appends a sign-in token
          // the login page consumes before returning here; the pricing session
          // refuses a return URL on a domain it does not allow, and the app's
          // own domain is not on that list.
          redirectUrl={loginReturnUrl()}
          mainPlatformKey={platformMainOrg}
          sourcePlatformKey={resolveAppTenant()}
          currentUserEmail={getUserEmail() ?? ""}
        />
      )}
      {openContactAdminModal && (
        <ContactAdminModal
          isOpen={openContactAdminModal}
          onClose={() => dispatch(setOpenContactAdminModal(false))}
        />
      )}
      {openAppleRestrictionModal && (
        <AppleRestrictionModal
          isOpen={openAppleRestrictionModal}
          onClose={() => dispatch(setOpenAppleRestrictionModal(false))}
        />
      )}
    </>
  );
}
