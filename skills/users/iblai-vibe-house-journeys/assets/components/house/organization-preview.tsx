"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import {
  OnboardingShell,
  StepHeader,
  onboardingPrimaryButtonClass,
  onboardingSecondaryButtonClass,
} from "@iblai/iblai-js/web-containers";
import { redirectToAuthSpaJoinTenant, useTenantMetadata } from "@iblai/iblai-js/web-utils";
import config from "@/lib/iblai/config";
import { createOrganizationUrl, readUserEmail } from "@/lib/iblai/house-journeys";

/** The outlined twin of the SDK's primary onboarding button. */
const outlined =
  "inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50";

/**
 * A signed-in visitor on an organization they do not belong to: its name and
 * logo from the public metadata, Join (the auth page joins them, or says why
 * not), or an organization of their own through ibl.ai's $0 sign-up. The app
 * runs on their own organization underneath. The key stands in for the name
 * until the metadata answers — an unknown key never answers (the data layer
 * retries a 404), and the screen must not wait for it.
 */
export function OrganizationPreview({ org, app = "mentor" }: { org: string; app?: string }) {
  const t = useTranslations("houseJourneys.preview");
  const { platformName } = useTenantMetadata({ org });
  const [logo, setLogo] = useState(true);
  const name = platformName || org;
  return (
    <OnboardingShell totalSteps={1} currentStep={1}>
      <div data-testid="organization-preview" className="space-y-6">
        {logo && (
          <Image
            src={`${config.dmUrl()}/api/core/orgs/${encodeURIComponent(org)}/logo/`}
            alt=""
            width={160}
            height={48}
            unoptimized
            onError={() => setLogo(false)}
            className="mx-auto h-12 w-auto object-contain"
          />
        )}
        <StepHeader icon={Building2} title={name} subtitle={t("body", { name })} />
        <div className="space-y-3">
          <button
            type="button"
            className={onboardingPrimaryButtonClass}
            onClick={() => redirectToAuthSpaJoinTenant(config.authUrl(), org, window.location.href)}
          >
            {t("join", { name })}
          </button>
          <button
            type="button"
            className={outlined}
            onClick={() =>
              window.location.assign(createOrganizationUrl(config.appUrl(), readUserEmail(), app))
            }
          >
            {t("create")}
          </button>
          <Link href="/" className={onboardingSecondaryButtonClass}>
            {t("back")}
          </Link>
        </div>
      </div>
    </OnboardingShell>
  );
}
