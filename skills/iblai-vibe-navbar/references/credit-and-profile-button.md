# Navbar — credit balance widget and profile button (Steps 2–3)

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

## Step 2 — Credit balance widget

Create `components/navbar/credit-balance-widget.tsx`. This wraps the SDK's
`CreditBalance` (from `@iblai/iblai-js` >= 1.6.0). It is gated by the
active tenant's `show_paywall` flag — when that flag is falsy, the widget
renders nothing.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { CreditBalance } from '@iblai/iblai-js/web-containers';
import config from '@/lib/iblai/config';
import { resolveAppTenant } from '@/lib/iblai/tenant';

export function CreditBalanceWidget() {
  const [tenant, setTenant] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');

  useEffect(() => {
    setTenant(resolveAppTenant());

    try {
      const raw = localStorage.getItem('userData');
      if (raw) {
        const parsed = JSON.parse(raw);
        setUsername(parsed.user_nicename ?? parsed.username ?? '');
        setEmail(parsed.email ?? parsed.user_email ?? '');
      }
    } catch {}

    try {
      const raw = localStorage.getItem('current_tenant');
      if (raw) {
        const parsed = JSON.parse(raw);
        setEnabled(Boolean(parsed?.show_paywall));
      }
    } catch {}

    setRedirectUrl(window.location.href);
  }, []);

  if (!tenant || !username) return null;

  return (
    <CreditBalance
      tenant={tenant}
      username={username}
      mainPlatformKey={config.mainTenantKey()}
      currentUserEmail={email}
      redirectUrl={redirectUrl}
      enabled={enabled}
    />
  );
}
```

For the full props reference, panel behavior, and Playwright helpers,
see `/iblai-vibe-credit`.

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
  onTenantChange: (newTenantKey: string) => void;
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
  onTenantChange,
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
      showHelpLink={false}
      showLogoutButton={true}
      showLearnerModeSwitch={false}
      currentPlan=""
      authURL={authURL}
      onLogout={onLogout}
      onTenantChange={onTenantChange ?? (() => {})}
      onTenantUpdate={onTenantUpdate ?? (() => {})}
      onAccountDeleted={onAccountDeleted}
    />
  );
}
```

---
