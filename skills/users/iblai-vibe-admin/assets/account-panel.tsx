"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Account } from "@iblai/iblai-js/web-containers/next";
import config from "@/lib/iblai/config";
import { resolveAppTenant, readTenants } from "@/lib/iblai/tenant";

/**
 * One SDK <Account> surface, opened on a given tab. The admin pages mount it
 * full-width the way the OS does — the component owns its scrolling and
 * background — so several tabs can live at their own routes.
 *
 * Tabs: organization · management (Users, Groups, Roles, Policies, Teams,
 * Alerts) · integrations · advanced · billing · memory · monetization.
 *
 * `enableRbac` is deliberately NOT passed. It only means anything alongside a
 * matching `rbacPermissions` object: `checkRbacPermission` returns true when
 * RBAC is off, but denies everything when it is on and the permissions are
 * empty — which hides the whole Management tab, admin or not. This app is
 * single-org and /admin/** is already admin-only (see lib/iblai/admin-mode),
 * with writes enforced server-side by requireAdmin, so there is nothing left
 * for RBAC to refine. Going multi-org? Add BOTH halves: load permissions via
 * TenantProvider's onLoadPlatformPermissions into the `rbac` store slice and
 * pass them here with `enableRbac`. Never one without the other.
 */
export function AccountPanel({
  tab,
  onInviteClick,
}: {
  tab: "organization" | "management" | "integrations" | "advanced" | "billing" | "memory" | "monetization";
  onInviteClick?: () => void;
}) {
  const router = useRouter();
  const [session, setSession] = useState<{
    username: string;
    email: string;
    tenantKey: string;
    tenants: any[];
    isAdmin: boolean;
  } | null>(null);

  useEffect(() => {
    let username = "";
    let email = "";
    try {
      const raw = localStorage.getItem("userData");
      if (raw) {
        const parsed = JSON.parse(raw);
        username = parsed.user_nicename ?? parsed.username ?? "";
        email = parsed.user_email ?? parsed.email ?? "";
      }
    } catch {}
    const tenantKey = resolveAppTenant();
    const tenants = readTenants();
    const isAdmin = !!tenants.find((t) => t.key === tenantKey)?.is_admin;
    setSession({ username, email, tenantKey, tenants, isAdmin });
  }, []);

  if (!session || !session.tenantKey) return null;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <Account
        tenant={session.tenantKey}
        tenants={session.tenants}
        username={session.username}
        email={session.email}
        mainPlatformKey={config.mainTenantKey()}
        isAdmin={session.isAdmin}
        authURL={config.authUrl()}
        currentPlatformBaseDomain={config.platformBaseDomain()}
        currentSPA="agent"
        onInviteClick={onInviteClick ?? (() => {})}
        onClose={() => router.push("/")}
        targetTab={tab}
        showPlatformName
        useGravatarPicFallback
      />
    </div>
  );
}
