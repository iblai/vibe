'use client';

import { UserProfileDropdown } from '@iblai/iblai-js/web-containers/next';

interface UserProfileButtonProps {
  username?: string;
  email: string;
  mainPlatformKey: string;
  isAdmin: boolean;
  tenantKey: string;
  currentTenant?: any;
  userTenants?: any[];
  authURL: string;
  onLogout: () => void;
  onTenantUpdate?: (tenant: any) => void;
  onAccountDeleted?: () => void;
}

export function UserProfileButton({
  username,
  email,
  mainPlatformKey,
  isAdmin,
  tenantKey,
  currentTenant,
  userTenants = [],
  authURL,
  onLogout,
  onTenantUpdate,
  onAccountDeleted,
}: UserProfileButtonProps) {
  return (
    <UserProfileDropdown
      email={email}
      mainPlatformKey={mainPlatformKey}
      username={username}
      userIsAdmin={isAdmin}
      userIsStudent={false}
      tenantKey={tenantKey}
      currentTenant={currentTenant}
      userTenants={userTenants}
      showProfileTab={true}
      showAccountTab={false}
      showTenantSwitcher={isAdmin}
      // The chooser signs in to another organization but never updates
      // `app_tenant`, so this single-organization app would land back in its own.
      showOrganizationsLink={false}
      showHelpLink={false}
      showLogoutButton={true}
      showLearnerModeSwitch={false}
      currentPlan=""
      authURL={authURL}
      onLogout={onLogout}
      onTenantUpdate={onTenantUpdate ?? (() => {})}
      onAccountDeleted={onAccountDeleted}
    />
  );
}
