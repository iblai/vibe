---
name: iblai-account
description: Add account and organization settings page to your Next.js app
globs:
alwaysApply: false
---

# /iblai-account

Add an account/organization settings page with tabs for Organization info,
User Management, Integrations, Advanced settings, and Billing.

![Account Page](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-account/account-page.png)

> **AI Assistant:** Build this component directly using the code and MCP tools
> below. Do NOT use the CLI for this -- you are building this feature yourself
> using the SDK components documented here.
>
> Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
> They ship with their own styling. Keep the components as-is.
> Do NOT implement dark mode unless the user explicitly asks for it.
>
> When building custom UI around SDK components, use the ibl.ai brand:
> - **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
> - **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
> - **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
> - Use shadcn components for custom UI -- they share the same Tailwind
>   theme and render in ibl.ai brand colors automatically.
>
> You MUST run `/iblai-test` before telling the user the work is ready.

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- The following packages are already installed by `iblai add auth`:
  `@iblai/iblai-js`, `@reduxjs/toolkit`, `react-redux`

## Step 1: Use MCP Tools

```
get_component_info("Account")
```

## Step 2: Create Account Settings Page

Create `app/account/page.tsx` (or `src/app/account/page.tsx` if using `src/` layout):

> **Note:** The `Account` component uses `next/image` internally -- always
> import from `@iblai/iblai-js/web-containers/next`, not from
> `@iblai/iblai-js/web-containers`.

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Account } from "@iblai/iblai-js/web-containers/next";
import config from "@/lib/iblai/config";

function resolveTenantKey(raw: string | null): string {
  if (!raw || raw === "[object Object]") return "";
  try {
    const p = JSON.parse(raw);
    if (typeof p === "string") return p;
    if (p?.key) return p.key;
  } catch {}
  return raw;
}

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

    const stored =
      localStorage.getItem("current_tenant") ??
      localStorage.getItem("tenant");
    const resolved = resolveTenantKey(stored) || config.mainTenantKey();
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

  if (!ready || !username || !tenantKey) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p className="text-sm text-gray-400">Loading account settings...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-auto">
      <Account
        tenant={tenantKey}
        tenants={tenants}
        username={username}
        isAdmin={isAdmin}
        authURL={config.authUrl()}
        currentPlatformBaseDomain={config.platformBaseDomain()}
        currentSPA="agent"
        onInviteClick={() => {/* open invite dialog if needed */}}
        onClose={() => router.push("/")}
        targetTab="organization"
        showPlatformName={true}
        useGravatarPicFallback={true}
      />
    </div>
  );
}
```

## Tabs

| Tab | Requires |
|-----|---------|
| **Organization** | `isAdmin === true` -- edit org name, logos, support email |
| **Management** | RBAC permissions -- manage users, groups, roles |
| **Integrations** | `isAdmin === true` -- LLMs, API keys, data sources |
| **Advanced** | `isAdmin === true` -- SMTP, custom domains, auth SPA config |
| **Billing** | `billingURL` or `topUpURL` prop set -- Stripe billing/top-up |

## `<Account>` Props

### Required

| Prop | Type | Description |
|------|------|-------------|
| `tenant` | `string` | Tenant/org key |
| `tenants` | `Tenant[]` | Full list of user tenants from localStorage |
| `username` | `string` | Username |
| `onInviteClick` | `() => void` | Called when "Invite user" is clicked |
| `onClose` | `() => void` | Cancel/close callback |
| `authURL` | `string` | Auth service URL (from `config.authUrl()`) |
| `isAdmin` | `boolean` | Controls tab visibility -- most tabs require `true` |

### Optional

| Prop | Type | Description |
|------|------|-------------|
| `targetTab` | `string` | Initial tab: `organization`, `management`, `integrations`, `advanced`, `billing` |
| `currentPlatformBaseDomain` | `string` | Base domain for custom domain settings |
| `currentSPA` | `string` | Current app identifier (e.g., `"agent"`) |
| `billingURL` | `string` | Stripe billing portal URL -- shows Billing tab |
| `topUpURL` | `string` | Stripe top-up URL -- shows Billing tab |
| `enableRbac` | `boolean` | Enable RBAC permission checks for Management |
| `showPlatformName` | `boolean` | Show tenant name badge in sidebar |
| `useGravatarPicFallback` | `boolean` | Use Gravatar when no org logo |

## How `isAdmin` Is Determined

```typescript
const match = tenants.find((t) => t.key === tenantKey);
const isAdmin = !!match?.is_admin;
```

## Step 3: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `npm run build` -- must pass with zero errors
2. Start dev server and touch test:
   ```bash
   npm run dev &
   npx playwright screenshot http://localhost:3000/account /tmp/account.png
   ```

## Important Notes

- **Next.js required**: Import from `@iblai/iblai-js/web-containers/next` (uses `next/image`)
- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Config import**: Use `@/lib/iblai/config` (generated by `iblai add auth`)
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
