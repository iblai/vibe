"use client";

import Link from "next/link";
import { AccountPanel } from "@/components/admin/account-panel";
import { OrgSettingsForm } from "@/components/settings/org-settings";

/**
 * The org's identity (name, logos, support email, help center — the SDK
 * Organization tab) plus this app's own org-level settings.
 */
export default function AdminOrganizationPage() {
  return (
    <>
      <AccountPanel tab="organization" />
      <OrgSettingsForm />
      <p className="px-4 pb-8 text-xs text-muted-foreground md:px-8">
        Change the app's default agent on the{" "}
        <Link href="/setup" className="underline">
          setup page
        </Link>
        .
      </p>
    </>
  );
}
