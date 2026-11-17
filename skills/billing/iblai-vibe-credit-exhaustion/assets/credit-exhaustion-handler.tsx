"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getUserEmail,
  setOpenAppleRestrictionModal,
  setOpenContactAdminModal,
  setOpenPricingModal,
  use402ErrorCheck,
  type CreditExhaustion,
} from "@iblai/iblai-js/web-utils";
import {
  AppleRestrictionModal,
  ContactAdminModal,
  UpgradePackageModal,
} from "@iblai/iblai-js/web-containers";
import config from "@/lib/iblai/config";
import { resolveAppTenant } from "@/lib/iblai/tenant";
import type { IblaiRootState } from "@/store/iblai-store";

/**
 * The DOM event `<agent-ai>` dispatches for an embedded agent's
 * `credits.exhausted` frame (`CREDIT_EXHAUSTION_EVENT` in `@iblai/agent-ai`;
 * spelled out here so this chunk does not load the web component for a string).
 */
export const CREDIT_EXHAUSTION_EVENT = "creditsexhausted";

/**
 * What the app shows when credits run out. The SDK decides the next step in
 * `use402ErrorCheck` and only flips flags on the `subscription` /
 * `appleRestriction` store slices; this component is where those flags become
 * screens, at page size, for everything on this page:
 *
 * - `<Chat>` (the in-process chat) — its default `on402Error` is this hook.
 * - The free-trial gate (`useShowFreeTrialDialog().executeWithTrialCheck`)
 *   and the navbar's credit balance.
 * - An embedded OS agent (`<agent-ai handlecreditexhaustion>`): instead of a
 *   modal inside the chat widget, the element re-dispatches the agent's frame
 *   as a `creditsexhausted` DOM event, fed here to the same `handle402Error`.
 *
 * Who sees what: an admin is sent to `/admin/billing` (the provider's
 * `openBillingTab`), the account owner on a free trial gets the plan picker
 * (`UpgradePackageModal`), everyone else the contact-your-admin notice. A
 * desktop/iOS build that may not sell in-app gets the Apple-restriction modal.
 * Mounted once in `app/(app)/layout.tsx`.
 */
export function CreditExhaustionHandler() {
  const dispatch = useDispatch();
  const { handle402Error } = use402ErrorCheck();
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
          // Where Stripe sends the person back after checkout.
          redirectUrl={config.appUrl()}
          mainPlatformKey={config.mainTenantKey()}
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
