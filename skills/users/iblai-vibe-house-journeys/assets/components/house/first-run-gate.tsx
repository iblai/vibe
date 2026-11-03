"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGetUserPlatformMetadataQuery } from "@iblai/iblai-js/data-layer";
import {
  hasOnboardingContent,
  readUserOnboardingForm,
  readUserOnboardingSubmission,
} from "@iblai/iblai-js/web-containers";
import { useTenantMetadata } from "@iblai/iblai-js/web-utils";
import { LoadingScreen } from "@/components/loading-screen";
import { firstRunTarget, mainOrg, readUsername } from "@/lib/iblai/house-journeys";

/** The organization an admin was sent to setup for, this session. */
const SENT = "house_setup_sent";

/**
 * First run. An admin who has not finished the SDK setup flow is sent to
 * `/platform/<org>/onboarding?flow=admin` once per session; a member is sent
 * to `/platform/<org>/onboarding` while the organization's form waits for
 * their answers. Wraps the platform page tree; the onboarding route and the
 * community organization pass through, and so does a failed read.
 */
export function FirstRunGate({
  org,
  isAdmin,
  children,
}: {
  org: string;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const base = `/platform/${encodeURIComponent(org)}/onboarding`;
  const [username] = useState(readUsername);
  const [sent] = useState(() => typeof window !== "undefined" && sessionStorage.getItem(SENT) === org);
  const skip = pathname.startsWith(base) || org === mainOrg() || (isAdmin && sent);
  const user = useGetUserPlatformMetadataQuery({ tenantKey: org }, { skip: skip || !isAdmin });
  const organization = useTenantMetadata({ org, skip: skip || isAdmin });
  const loading = isAdmin ? user.isLoading : organization.isLoading;

  let target: "admin" | "user" | null = null;
  if (!skip && !loading) {
    if (isAdmin) {
      const onboarding = (user.data?.metadata as { onboarding?: { completed?: boolean } } | null)?.onboarding;
      target = user.isError
        ? null
        : firstRunTarget({ isAdmin, completed: onboarding?.completed === true, formReady: false, submitted: false });
    } else {
      const form = readUserOnboardingForm(organization.metadata);
      target = organization.isError
        ? null
        : firstRunTarget({
            isAdmin,
            completed: true,
            formReady: form.enabled && hasOnboardingContent(form),
            submitted: !!readUserOnboardingSubmission(organization.metadata, username),
          });
    }
  }

  useEffect(() => {
    if (!target) return;
    if (target === "admin") sessionStorage.setItem(SENT, org);
    router.replace(target === "admin" ? `${base}?flow=admin` : base);
  }, [target, org, base, router]);

  if ((!skip && loading) || target) return <LoadingScreen className="min-h-0 flex-1" />;
  return <>{children}</>;
}
