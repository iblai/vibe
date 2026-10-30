"use client";

import { useDispatch, useSelector } from "react-redux";
import { UpgradePackageModal } from "@iblai/iblai-js/web-containers";
import { setOpenPricingModal } from "@iblai/iblai-js/web-utils";
import config from "@/lib/iblai/config";
import { createOrganizationUrl, loginReturnUrl, mainOrg, readUserEmail } from "@/lib/iblai/house-journeys";

type State = { subscription?: { openPricingModal?: boolean } };

/**
 * The SDK's "Upgrade for free" dialog — the $0 checkout that gives a user on
 * the community organization one of their own. Opened by any trial-gated
 * click (`setOpenPricingModal(true)`) and by a 402 that carries a pricing
 * table. Upgrade for free goes straight to the $0 checkout, which returns them
 * into this app (`config.appUrl()`) on the new organization.
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
      redirectUrl={loginReturnUrl(config.appUrl(), app)}
      checkoutUrl={createOrganizationUrl(config.appUrl(), readUserEmail(), app)}
      sourcePlatformKey={org}
      mainPlatformKey={mainOrg()}
      currentUserEmail={readUserEmail()}
    />
  );
}
