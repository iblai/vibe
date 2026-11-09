"use client";
/**
 * ibl.ai Profile Dropdown
 *
 * A self-contained user avatar + dropdown menu with profile editing,
 * the current organization (admins open its settings), and logout. Wraps the SDK's
 * `UserProfileDropdown`. Mirrors the reference app's prop set.
 *
 * Usage:
 *   import { ProfileDropdown } from "@/components/iblai/profile-dropdown";
 *   <ProfileDropdown />
 *
 * Prerequisites:
 *   - <IblaiProviders> must wrap this component's ancestor tree
 *   - @iblai/iblai-js/web-containers/styles must be imported in globals.css
 */

import { useMemo } from "react";
import { UserProfileDropdown } from "@iblai/iblai-js/web-containers/next";
import config from "@/lib/iblai/config";
import { resolveAppTenant } from "@/lib/iblai/tenant";
import { handleLogout } from "@/lib/iblai/auth-utils";

interface ProfileDropdownProps {
  /** Additional CSS class for the dropdown trigger. */
  className?: string;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function ProfileDropdown({ className }: ProfileDropdownProps) {
  const tenantKey = useMemo(() => resolveAppTenant(), []);

  // `user_nicename` is the canonical username slug. The SDK fetches the
  // avatar from `/users/manage/metadata/?username=<this>`, which only
  // resolves the profile image for the nicename (NOT a display name), so
  // keying on anything else renders a blank avatar.
  const { username, email } = useMemo(() => {
    const ud = readJSON<any>("userData", {});
    return {
      username: ud.user_nicename ?? ud.username ?? "",
      email: ud.user_email ?? ud.email ?? "",
    };
  }, []);

  // The organization row is named from `tenants`, and admin rights come from it.
  const userTenants = useMemo<any[]>(() => readJSON<any[]>("tenants", []), []);

  const isAdmin = useMemo(
    () => !!userTenants.find((t: any) => t?.key === tenantKey)?.is_admin,
    [userTenants, tenantKey],
  );

  // The SDK fires the avatar/metadata fetch on mount keyed by `username`;
  // an empty value 400s, so don't render until we have it.
  if (!username) return null;

  return (
    <UserProfileDropdown
      email={email}
      username={username}
      mainPlatformKey={config.mainTenantKey()}
      tenantKey={tenantKey}
      userTenants={userTenants}
      userIsAdmin={isAdmin}
      userIsStudent={!isAdmin}
      showProfileTab
      // Account settings live on a separate /account page.
      showAccountTab={false}
      // The row names the current organization and, for an admin, opens its
      // settings. For anyone else it is a bare label, so admins only.
      showTenantSwitcher={isAdmin}
      // The organization chooser signs the user into another organization, but
      // this app keeps working in `app_tenant`, which the chooser never sets.
      // A multi-org app must point `app_tenant` at the chosen organization first.
      showOrganizationsLink={false}
      showHelpLink={false}
      showLogoutButton
      // Gravatar fallback (from the user's email) when there's no uploaded
      // profile image. Defaults true; set explicitly so the avatar never
      // renders blank.
      enableGravatarOnProfilePic
      authURL={config.authUrl()}
      currentPlatformBaseDomain={config.platformBaseDomain()}
      onLogout={handleLogout}
      onTenantUpdate={(tenant: { key?: string }) => {
        if (tenant?.key) {
          localStorage.setItem("app_tenant", tenant.key);
          localStorage.setItem("tenant", tenant.key);
        }
      }}
      className={className}
    />
  );
}
