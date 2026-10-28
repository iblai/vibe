"use client";

import { useDispatch, useSelector } from "react-redux";
import { UpgradePackageModal } from "@iblai/iblai-js/web-containers";
import { setOpenPricingModal } from "@iblai/iblai-js/web-utils";
import { loginReturnUrl, mainOrg, readUserEmail } from "@/lib/iblai/house-journeys";

type State = { subscription?: { openPricingModal?: boolean } };

/**
 * The SDK's "Upgrade for free" dialog — the $0 checkout that gives a user on
 * the community organization one of their own. Opened by any trial-gated
 * click (`setOpenPricingModal(true)`) and by a 402 that carries a pricing
 * table; the platform returns them into this app on the new organization.
 * Mount once in the platform layout.
 */
export function UpgradeModal({ org, app = "mentor" }: { org: string; app?: string }) {
  const dispatch = useDispatch();
  const open = useSelector((state: State) => !!state.subscription?.openPricingModal);
  if (!open) return null;
  return (
    <UpgradePackageModal
      open
      onClose={() => dispatch(setOpenPricingModal(false))}
      redirectUrl={loginReturnUrl(window.location.origin, app)}
      sourcePlatformKey={org}
      mainPlatformKey={mainOrg()}
      currentUserEmail={readUserEmail()}
    />
  );
}
