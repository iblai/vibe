# Navbar — credit balance widget and profile button (Steps 2–3)

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

## Step 2 — Credit balance widget

Create `components/navbar/credit-balance-widget.tsx`. This wraps the SDK's
`CreditBalance` behind the SDK's own visibility rule
(`isPlatformNavbarCreditBalanceVisible`, the one the OS navbar runs): billing
on, an organization that sells credits (`show_paywall`) or the platform's
main one, an admin acting as one or a free-trial user, signed in.
`isLiveAdmin` is yours: `isAdmin && adminMode` behind vibe-starter's
User/Admin switch (`/iblai-vibe-admin`), plain `isAdmin` in an app without
one. `useUserIsOnTrial` and `useSubscriptionConfig` (whose `mainTenantKey` is
the platform's main organization, `main`, never this app's) are the SDK's.

```tsx
'use client';

import {
  CreditBalance,
  isPlatformNavbarCreditBalanceVisible,
} from '@iblai/iblai-js/web-containers';
import { useSubscriptionConfig, useUserIsOnTrial } from '@iblai/iblai-js/web-utils';
import config from '@/lib/iblai/config';

interface CreditBalanceWidgetProps {
  tenantKey: string;
  /** The entry for `tenantKey` in the signed-in user's `tenants`. */
  currentTenant?: { key?: string | null; show_paywall?: boolean | null } | null;
  username: string;
  email: string;
  /**
   * An admin acting as one: `isAdmin && adminMode` behind a User/Admin
   * switch (`/iblai-vibe-admin`), plain `isAdmin` in an app without one.
   */
  isLiveAdmin: boolean;
}

export function CreditBalanceWidget({
  tenantKey,
  currentTenant,
  username,
  email,
  isLiveAdmin,
}: CreditBalanceWidgetProps) {
  const userOnFreeTrial = useUserIsOnTrial();
  // The platform's main organization (`main`): where free-trial users live
  // and the only one that lists and changes plans. Never this app's.
  const { mainTenantKey: platformMainOrg } = useSubscriptionConfig();

  const visible = isPlatformNavbarCreditBalanceVisible({
    tenantKey,
    currentTenant,
    stripeEnabled: config.stripeEnabled(),
    isLiveAdmin,
    userOnFreeTrial,
    mainPlatformKey: platformMainOrg,
    currentUserEmail: email,
    username,
  });
  if (!visible || !username || !email) return null;

  return (
    <CreditBalance
      tenant={tenantKey}
      enabled={true}
      username={username}
      mainPlatformKey={platformMainOrg}
      currentUserEmail={email}
      redirectUrl={window.location.origin}
    />
  );
}
```

`redirectUrl` is the origin, never `window.location.href`: Stripe returns
there after checkout or the customer portal, and the widget completes a
pending Add Credits on the way back. For the full props reference, the panel
behavior and what the SDK shows when credits run out, see `/iblai-vibe-credit`
and `/iblai-vibe-credit-exhaustion`.

---

## Step 3 — User profile button

Create `components/navbar/user-profile-button.tsx`. This wraps the SDK's
`UserProfileDropdown`:

```tsx
'use client';

import { UserProfileDropdown } from '@iblai/iblai-js/web-containers/next';

interface UserProfileButtonProps {
  username: string;
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
      // Single-org app: no "Organizations" item (see /iblai-vibe-profile Step 4).
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
```

---
