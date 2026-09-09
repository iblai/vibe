# Navbar — the profile, account, and notifications pages (Steps 6–8)

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

## Step 6 — Profile page

Create `app/(app)/profile/page.tsx`.

Import `Profile` from `@iblai/iblai-js/web-containers` (the framework-agnostic
bundle, NOT the `/next` bundle). This renders an inline, full-page profile
editor with sidebar navigation on desktop and tabbed navigation on mobile.

```tsx
// app/(app)/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Profile } from "@iblai/iblai-js/web-containers";
import { resolveAppTenant } from "@/lib/iblai/tenant";

export default function ProfilePage() {
  const [tenantKey, setTenantKey] = useState("");
  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("userData");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUsername(parsed.user_nicename ?? parsed.username ?? "");
      }
    } catch {}

    const resolved = resolveAppTenant();
    setTenantKey(resolved);

    try {
      const tenantsRaw = localStorage.getItem("tenants");
      if (tenantsRaw) {
        const parsed = JSON.parse(tenantsRaw);
        const match = parsed.find((t: any) => t.key === resolved);
        if (match) setIsAdmin(!!match.is_admin);
      }
    } catch {}

    setReady(true);
  }, []);

  if (!ready || !tenantKey) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full flex-1 overflow-auto px-4 py-8 md:w-[75vw] md:px-0">
      <div className="rounded-lg border border-[var(--border-color)] bg-white overflow-hidden">
        <Profile
          tenant={tenantKey}
          tenants={tenants}
          username={username}
          isAdmin={isAdmin}
          onClose={() => {}}
          customization={{
            showPlatformName: true,
            useGravatarPicFallback: true,
          }}
          targetTab="basic"
        />
      </div>
    </div>
  );
}
```

**Key patterns:**
- Wrap in `bg-white rounded-lg border` — the SDK Profile has no outer background
- Import from `@iblai/iblai-js/web-containers` (NOT `/next`)
- `Profile` renders inline (full page). `UserProfileModal` renders as a dialog.

---

## Step 7 — Account page

Create `app/(app)/account/page.tsx`.

Import `Account` from `@iblai/iblai-js/web-containers/next` (this one
DOES use the `/next` bundle because it uses `next/image` internally).

```tsx
// app/(app)/account/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Account } from "@iblai/iblai-js/web-containers/next";
import config from "@/lib/iblai/config";
import { resolveAppTenant } from "@/lib/iblai/tenant";

export default function AccountPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [tenantKey, setTenantKey] = useState("");
  const [tenants, setTenants] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("userData");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUsername(parsed.user_nicename ?? parsed.username ?? "");
      }
    } catch {}

    const resolved = resolveAppTenant();
    setTenantKey(resolved);

    try {
      const tenantsRaw = localStorage.getItem("tenants");
      if (tenantsRaw) {
        const parsed = JSON.parse(tenantsRaw);
        setTenants(parsed);
        const match = parsed.find((t: any) => t.key === resolved);
        if (match) setIsAdmin(!!match.is_admin);
      }
    } catch {}

    setReady(true);
  }, []);

  if (!ready || !tenantKey) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">Loading account settings...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full flex-1 overflow-auto px-4 py-8 md:w-[75vw] md:px-0">
      <div className="rounded-lg border border-[var(--border-color)] bg-white overflow-hidden">
        <Account
          tenant={tenantKey}
          tenants={tenants}
          username={username}
          email={email}
          mainPlatformKey={config.mainTenantKey()}
          isAdmin={isAdmin}
          authURL={config.authUrl()}
          currentPlatformBaseDomain={config.platformBaseDomain()}
          currentSPA="agent"
          onInviteClick={() => {}}
          onClose={() => router.push("/")}
          targetTab="organization"
          showPlatformName={true}
          useGravatarPicFallback={true}
        />
      </div>
    </div>
  );
}
```

**Key patterns:**
- Wrap in `bg-white rounded-lg border` — same as Profile
- Import from `@iblai/iblai-js/web-containers/next` (uses `next/image`)
- Most tabs require `isAdmin === true` to be visible

---

## Step 8 — Notifications page

Create `app/(app)/notifications/[[...id]]/page.tsx`.

The `[[...id]]` catch-all route handles both `/notifications` (inbox) and
`/notifications/{id}` (specific notification). Import `NotificationDisplay`
from `@iblai/iblai-js/web-containers`.

```tsx
// app/(app)/notifications/[[...id]]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { NotificationDisplay } from "@iblai/iblai-js/web-containers";
import { resolveAppTenant } from "@/lib/iblai/tenant";

export default function NotificationsPage() {
  const params = useParams();
  const notificationId = params?.id?.[0] ?? undefined;
  const [tenantKey, setTenantKey] = useState("");
  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("userData");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUsername(parsed.user_nicename ?? parsed.username ?? "");
      }
    } catch {}

    const resolved = resolveAppTenant();
    setTenantKey(resolved);

    try {
      const tenantsRaw = localStorage.getItem("tenants");
      if (tenantsRaw) {
        const parsed = JSON.parse(tenantsRaw);
        const match = parsed.find((t: any) => t.key === resolved);
        if (match) setIsAdmin(!!match.is_admin);
      }
    } catch {}

    setReady(true);
  }, []);

  if (!ready || !tenantKey) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full flex-1 overflow-auto px-4 py-8 md:w-[75vw] md:px-0">
      <div className="rounded-lg border border-[var(--border-color)] bg-white overflow-hidden">
        <NotificationDisplay
          org={tenantKey}
          userId={username}
          isAdmin={isAdmin}
          selectedNotificationId={notificationId}
        />
      </div>
    </div>
  );
}
```

**Key patterns:**
- `[[...id]]` catch-all so `/notifications` and `/notifications/abc123` both work
- Admin users see the Alerts tab and Send button
- Import from `@iblai/iblai-js/web-containers` (NOT `/next`)

---
