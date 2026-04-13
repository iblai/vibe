---
name: iblai-profile
description: Add profile dropdown and settings page to your Next.js app
globs:
alwaysApply: false
---

# /iblai-profile

Add user profile features -- a compact avatar dropdown for your navbar and
a full settings page with tabs for Basic info, Social links, Education,
Experience, Resume, and Security.

![Profile Page](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-profile/profile-page.png)

Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
They ship with their own styling. Keep the components as-is.
Do NOT implement dark mode unless the user explicitly asks for it.

When building custom UI around SDK components, use the ibl.ai brand:
- **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
- Always use shadcn/ui components for all custom UI -- buttons, forms,
  modals, tables, dropdowns, etc. Do NOT write raw HTML or custom
  components when a shadcn equivalent exists. Install with
  `npx shadcn@latest add <component>`. shadcn shares the same Tailwind
  theme and renders in ibl.ai brand colors automatically.
- Follow [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md) for
  colors, typography, spacing, and component styles.

You MUST run `/iblai-test` before telling the user the work is ready.

After all work is complete, start a dev server (`pnpm dev`) so the user
can see the result at http://localhost:3000.

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
its runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed. The generated app should live in the current directory,
not in a subdirectory.

When building a navbar or header, do NOT display the platform name.
Use the ibl.ai logo instead.

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- MCP and skills must be set up: `iblai add mcp`

## Step 0: Check for CLI Updates

Before running any `iblai` command, ensure the CLI is
up to date. Run `iblai --version` to check the current version, then
upgrade directly:
- pip: `pip install --upgrade iblai-app-cli`
- npm: `npm install -g @iblai/cli@latest`

This is safe to run even if already at the latest version.

## Step 1: Check Environment

Before proceeding, check for a `iblai.env`
in the project root. Look for `PLATFORM`, `DOMAIN`, and `TOKEN` variables.
If the file does not exist or is missing these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Run the Generator

```bash
iblai add profile
```

## What Was Generated

| File | Purpose |
|------|---------|
| `components/iblai/profile-dropdown.tsx` | Avatar dropdown for navbar with profile, organization, platform switcher, and logout |

The dropdown reads `userData`, `tenant`/`current_tenant`, and `tenants` from
localStorage. Admin status is derived from the `tenants` array by matching
the current platform key against `is_admin`.

The dropdown shows: **Profile** (links to `/profile`),
**Organization** (links to `/account`), **Platform Switcher**, and **Logout**.

## Step 3: Add a Full Profile Page

The generator creates the dropdown only. You must create the profile **page**
manually using the `Profile` component (not `UserProfileModal`, which renders
as a dialog).

Import `Profile` from `@iblai/iblai-js/web-containers` (the framework-agnostic
bundle, NOT the `/next` bundle). This renders an inline, full-page profile
editor with sidebar navigation on desktop and tabbed navigation on mobile.

### Reference implementation

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

### Key patterns

- **White container wrapper**: The SDK Profile component has no outer background.
  Wrap it in a `bg-white rounded-lg border` container so it renders as a card
  against the gray page background (`--sidebar-bg: #fafbfc`).
- **`Profile` vs `UserProfileModal`**: `Profile` renders inline (full page).
  `UserProfileModal` renders as a dialog overlay. Use `Profile` for a
  dedicated `/profile` route.
- **Import path**: `@iblai/iblai-js/web-containers` (NOT `/next`).

## Step 4: Enable Platform Switcher in the Dropdown

The generator does NOT enable the platform switcher by default. You must pass
the `userTenants` prop and set `showTenantSwitcher` to `true`:

```tsx
// In profile-dropdown.tsx, add:
const userTenants = useMemo(() => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("tenants");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}, []);

// Then pass to the component:
<UserProfileDropdown
  userTenants={userTenants}
  showTenantSwitcher
  showAccountTab
  // ...other props
/>
```

Without `userTenants`, the platform switcher will not appear even when
`showTenantSwitcher` is `true`.

## Step 5: Use MCP Tools for Customization

```
get_component_info("UserProfileDropdown")
get_component_info("Profile")
```

## `<UserProfileDropdown>` Props

The generated dropdown component. Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Description |
|------|------|-------------|
| `username` | `string` | Username |
| `tenantKey` | `string` | Platform key |
| `userIsAdmin` | `boolean` | Shows admin badge + settings |
| `userTenants` | `Tenant[]` | **Required for platform switcher** -- full platform list from localStorage |
| `showProfileTab` | `boolean` | Show profile link |
| `showAccountTab` | `boolean` | Show account settings link |
| `showTenantSwitcher` | `boolean` | Show platform switcher (needs `userTenants`) |
| `showLogoutButton` | `boolean` | Show logout button |
| `showHelpLink` | `boolean` | Show help link |
| `authURL` | `string` | Auth service URL |
| `onLogout` | `() => void` | Logout callback |
| `onTenantChange` | `(tenant: string) => void` | Called when user switches platform -- must set `app_tenant` in localStorage |
| `onTenantUpdate` | `(tenant: Tenant) => void` | Called when platform data updates -- must set `app_tenant` in localStorage |
| `className` | `string?` | Additional CSS class |

## `<Profile>` Props (Full-Page Profile)

Import from `@iblai/iblai-js/web-containers`.

| Prop | Type | Description |
|------|------|-------------|
| `tenant` | `string` | Platform key |
| `username` | `string` | Username |
| `isAdmin` | `boolean` | Admin flag |
| `onClose` | `() => void` | Close callback |
| `customization` | `object` | `{ showPlatformName, useGravatarPicFallback }` |
| `targetTab` | `string` | Initial tab: `basic`, `social`, `education`, `experience`, `resume`, `security` |

## `<UserProfileModal>` Props (Profile + Account Modal)

For a profile editing modal (used by the MentorAI reference app), import
`UserProfileModal` from `@iblai/iblai-js/web-containers/next`. This is a
dialog that combines profile editing and account settings in one overlay.

### Required

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Whether the modal is visible |
| `onClose` | `() => void` | Close callback |
| `params` | `{ tenantKey: string; mentorId?: string; isAdmin?: boolean }` | Tenant key, optional mentor ID and admin flag |
| `authURL` | `string` | Auth service URL (from `config.authUrl()`) |

### Optional

| Prop | Type | Description |
|------|------|-------------|
| `tenants` | `Tenant[]` | Full list of user tenants from localStorage |
| `targetTab` | `string` | Initial tab: `basic`, `social`, `education`, `experience`, `resume`, `security` |
| `showPlatformName` | `boolean` | Show platform name badge |
| `useGravatarPicFallback` | `boolean` | Use Gravatar when no profile pic |
| `currentSPA` | `string` | Current app identifier (e.g., `"agent"`) |
| `currentPlatformBaseDomain` | `string` | Base domain for custom domain settings |
| `onTenantUpdate` | `(tenant: Tenant) => void` | Called when platform is updated |
| `onAccountDeleted` | `() => void` | Called after account deletion |

## Step 6: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/profile /tmp/profile.png
   ```

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Admin detection**: Derived from `tenants` array in localStorage
- **SDK hardcoded styles**: The SDK Profile component uses `bg-white` and
  `bg-gray-50` internally. Do NOT override these. Instead, wrap the component
  in a white container so it renders correctly against the gray page background.
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
