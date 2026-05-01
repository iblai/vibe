---
name: iblai-navbar
description: Add a responsive navbar with logo, page links, notification bell, and profile dropdown
globs:
alwaysApply: false
---

# /iblai-navbar

Add a responsive top navigation bar with:
- **Left:** Logo + page links
- **Right:** Notification bell + user profile dropdown

The navbar matches the ibl.ai skillsai reference app and is fully
responsive -- desktop shows inline links, tablet/mobile collapses to a
hamburger drawer.

Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
They ship with their own styling. Keep the components as-is.
Do NOT implement dark mode unless the user explicitly asks for it.
Do NOT add Lucide icons next to nav link labels. Links are text-only.

When building custom UI around SDK components, use the ibl.ai brand:
- **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
- Follow the component hierarchy: use ibl.ai SDK components
  (`@iblai/iblai-js`) first, then shadcn/ui for everything else
  (`npx shadcn@latest add <component>`). Do NOT write custom components
  when an ibl.ai or shadcn equivalent exists. Both share the same
  Tailwind theme and render in ibl.ai brand colors automatically.
- Follow [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md) for
  colors, typography, spacing, and component styles.

The navbar MUST follow BRAND.md colors:
- **Active link**: `text-[var(--navbar-active-text,var(--primary-color))]` /
  `border-[var(--navbar-active-border,var(--primary-color))]`
  (brand blue `#0058cc`), NOT amber/yellow
- **Active drawer item**: `bg-[var(--accent-color)] text-[var(--navbar-active-text,var(--primary-color))]`
- **Hover**: `text-[var(--navbar-hover-text,var(--text-primary))]`
- **Inactive**: `text-[var(--navbar-text,var(--text-secondary))]`

---

## Visual spec

| Property | Value |
|---|---|
| Height | `h-16` mobile, `md:h-20` desktop |
| Background | `bg-[var(--navbar-bg,#fff)]` — solid white, no blur/glass |
| Border | `border-b border-[var(--border-color)]` |
| Layout | Full-width, `justify-between`, `px-4 sm:px-6 md:px-6 lg:px-8` |
| Link spacing | `space-x-6` between desktop nav links |
| Link style | Text-only (no icons), `text-sm font-medium` |
| Active link | `border-b-2` bottom border + brand color text |
| Right side spacing | `space-x-4` between right-side items |
| Hamburger icon | `h-6 w-6`, `rounded-sm` |
| Mobile drawer header | `h-16` to match navbar |

---

## Step 0: Start from vibe-starter? (new projects)

Before running this skill, ask the user:

> Are you starting a new project from scratch? vibe-starter
> (https://github.com/iblai/vibe-starter/tree/spa) already ships this navbar
> wired up (logo, nav links, notification bell, profile dropdown, mobile
> drawer) along with auth and profile/account/notifications pages. Want to
> use that instead of building the navbar from scratch?

If yes, clone into a temp directory and copy into the current directory before
installing (running pnpm install inside the cloned subdirectory causes hardlink
issues), then skip this skill:

    git clone -b spa https://github.com/iblai/vibe-starter.git vibe-starter-init
    cp -a vibe-starter-init/. . && rm -rf vibe-starter-init
    pnpm install

If they prefer to add a navbar to an existing app, continue below.

## Prerequisites

- Auth must be set up first (`iblai add auth`)
- `@iblai/iblai-js` SDK installed
- shadcn/ui initialized (`npx shadcn@latest init`)
- Lucide icons: `pnpm add lucide-react`

## What this skill creates

Every navbar includes all of the following — no choices, no skipping:

**Left side:** ibl.ai logo + three text links (no icons):
- Home (`/`)
- Profile (`/profile`)
- Account (`/account`)

**Right side:**
- Notification bell (links to `/notifications`)
- Profile dropdown (with Profile and Account links)

---

## Architecture

```
components/
  navbar/
    nav-bar.tsx              # Main navbar component
    navigation-drawer.tsx    # Mobile slide-out drawer (shadcn Sheet)
    logo.tsx                 # ibl.ai logo
    user-profile-button.tsx  # Profile dropdown wrapper
app/
  (app)/
    profile/page.tsx         # Profile settings page
    account/page.tsx         # Account/org settings page
    notifications/
      [[...id]]/page.tsx     # Notification center page
```

The navbar is rendered in the app layout and wraps all authenticated pages.
The profile, account, and notification pages are created alongside the
navbar so the links point to real pages, not placeholders.

---

## Step 1 — Download and add the logo

Download the ibl.ai logo into the project's `public/images/` directory:

```bash
mkdir -p public/images
curl -o public/images/iblai-logo.png https://ibl.ai/images/iblai-logo.png
```

Then create `components/navbar/logo.tsx`:

```tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center">
      <Image
        src="/images/iblai-logo.png"
        alt="ibl.ai"
        width={120}
        height={40}
        className="h-6 w-auto sm:h-7 md:h-8"
        priority
      />
    </Link>
  );
}
```

Use the ibl.ai logo. Do NOT use the tenant/platform logo. Always serve
it locally from `public/images/`, never from an external URL.

---

## Step 2 — User profile button

Create `components/navbar/user-profile-button.tsx`. This wraps the SDK's
`UserProfileDropdown`:

```tsx
'use client';

import { UserProfileDropdown } from '@iblai/iblai-js/web-containers/next';

interface UserProfileButtonProps {
  username?: string;
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
      billingEnabled={false}
      billingURL=""
      topUpEnabled={false}
      topUpURL=""
      currentPlan=""
      authURL={authURL}
      onLogout={onLogout}
      onTenantChange={onTenantChange}
      onTenantUpdate={onTenantUpdate}
      onAccountDeleted={onAccountDeleted}
    />
  );
}
```

---

## Step 3 — Navigation drawer (mobile)

Use shadcn `Sheet` with `side="left"` for the mobile drawer. Note: shadcn
Sheet uses `@base-ui/react/dialog`, NOT Radix. The `asChild` prop is NOT
available on `SheetTrigger`.

Create `components/navbar/navigation-drawer.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';

export interface NavItem {
  name: string;
  href: string;
}

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: NavItem[];
}

export function NavigationDrawer({
  isOpen,
  onClose,
  items,
}: NavigationDrawerProps) {
  const pathname = usePathname();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        {/* Header — h-16 matches navbar mobile height */}
        <div className="flex h-16 items-center border-b border-[var(--border-color)] px-5">
          <div onClick={onClose}>
            <Logo />
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-0.5 p-3">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'rounded-sm px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--accent-color)] text-[var(--navbar-active-text,var(--primary-color))]'
                    : 'text-[var(--navbar-text,var(--text-secondary))] hover:text-[var(--navbar-hover-text,var(--text-primary))]'
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
```

---

## Step 4 — Main navbar

Create `components/navbar/nav-bar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Logo } from './logo';
import { UserProfileButton } from './user-profile-button';
import { NotificationDropdown } from '@iblai/iblai-js/web-containers';
import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface NavLink {
  name: string;
  href: string;
  /** First path segment to match for active state (e.g. "profile") */
  segment: string;
}

interface NavBarProps {
  onMenuClick: () => void;
  links: NavLink[];
  // Tenant/user props
  tenantKey: string;
  username?: string;
  isAdmin: boolean;
  currentTenant?: any;
  userTenants?: any[];
  authURL: string;
  onLogout: () => void;
  onTenantChange: (key: string) => void;
  onTenantUpdate?: (tenant: any) => void;
  onAccountDeleted?: () => void;
  // Feature flags
  showNotifications?: boolean;
  showProfileDropdown?: boolean;
}

export function NavBar({
  onMenuClick,
  links,
  tenantKey,
  username,
  isAdmin,
  currentTenant,
  userTenants,
  authURL,
  onLogout,
  onTenantChange,
  onTenantUpdate,
  onAccountDeleted,
  showNotifications = true,
  showProfileDropdown = true,
}: NavBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleViewNotifications = useCallback(
    (notificationId?: string) => {
      router.push(`/notifications/${notificationId ?? ''}`);
    },
    [router],
  );

  return (
    <header className="h-16 flex-shrink-0 border-b border-[var(--border-color)] bg-[var(--navbar-bg,#fff)] md:h-20">
      <div className="flex h-full items-center justify-between px-4 sm:px-6 md:px-6 lg:px-8">
        {/* Left: hamburger + logo + links */}
        <div className="flex h-full items-center">
          <button
            onClick={onMenuClick}
            className="mr-3 rounded-sm text-[var(--navbar-text,var(--text-secondary))] hover:bg-[var(--navbar-hover-bg,var(--hover-bg))] hover:text-[var(--navbar-hover-text,var(--text-primary))] focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none focus:ring-inset md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Logo />

          {/* Desktop navigation links — text only, no icons */}
          <nav className="ml-8 hidden h-full items-center space-x-6 md:flex">
            {links.map((link) => (
              <Link
                key={link.segment}
                href={link.href}
                className={cn(
                  'flex h-full items-center text-sm font-medium',
                  pathname.startsWith(link.href)
                    ? 'border-b-2 border-[var(--navbar-active-border,var(--primary-color))] text-[var(--navbar-active-text,var(--primary-color))]'
                    : 'text-[var(--navbar-text,var(--text-secondary))] hover:text-[var(--navbar-hover-text,var(--text-primary))]'
                )}
              >
                {link.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: notifications + profile */}
        <div className="flex items-center space-x-4">
          {showNotifications && (
            <NotificationDropdown
              org={tenantKey}
              userId={username}
              isAdmin={isAdmin}
              onViewNotifications={handleViewNotifications}
            />
          )}

          {showProfileDropdown && (
            <div className="relative">
              <UserProfileButton
                username={username}
                isAdmin={isAdmin}
                tenantKey={tenantKey}
                currentTenant={currentTenant}
                userTenants={userTenants}
                authURL={authURL}
                onLogout={onLogout}
                onTenantChange={onTenantChange}
                onTenantUpdate={onTenantUpdate}
                onAccountDeleted={onAccountDeleted}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
```

---

## Step 5 — Profile page

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

## Step 6 — Account page

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

## Step 7 — Notifications page

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

## Step 8 — Wire into app layout

In your root layout or app layout component, render the navbar for all
authenticated pages:

```tsx
'use client';

import { useState } from 'react';
import { NavBar, type NavLink } from '@/components/navbar/nav-bar';
import { NavigationDrawer, type NavItem } from '@/components/navbar/navigation-drawer';

const NAV_LINKS: NavLink[] = [
  { name: 'Home',      href: '/',          segment: null },
  { name: 'Profile',   href: '/profile',   segment: 'profile' },
  { name: 'Account',   href: '/account',   segment: 'account' },
];

// Same items for the mobile drawer (text only, no icons)
const DRAWER_ITEMS: NavItem[] = NAV_LINKS.map(({ name, href }) => ({
  name,
  href,
}));

const NON_AUTH_PAGES = ['/sso-login-complete'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <NavBar
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        links={NAV_LINKS}
        tenantKey={/* getTenant() */}
        username={/* getUserName() */}
        isAdmin={/* from your auth context */}
        authURL={/* config.urls.auth() */}
        onLogout={/* your logout handler */}
        onTenantChange={/* your tenant switch handler */}
      />

      <NavigationDrawer
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={DRAWER_ITEMS}
      />

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

---

## Step 9 — CSS variables

The navbar uses CSS custom properties for theming. Add these to your
`globals.css` (or they'll fall back to defaults):

```css
:root {
  --navbar-bg: #ffffff;
  --navbar-text: #374151;
  --navbar-hover-text: #1f2937;
  --navbar-hover-bg: #f3f4f6;
  --navbar-active-text: #0058cc;
  --navbar-active-border: #0058cc;
  --border-color: #d1d5db;
  --primary-color: #0058cc;
  --text-primary: #1f2937;
  --text-secondary: #374151;
  --accent-color: #eff6ff;
  --hover-bg: #f3f4f6;
}
```

---

## Desktop vs Mobile behavior

| Breakpoint | Navbar Height | Links | Drawer |
|---|---|---|---|
| < 768px (mobile) | h-16 (64px) | Hidden | Hamburger opens Sheet drawer |
| >= 768px (desktop) | h-20 (80px) | Inline text links, `space-x-6` | Hidden |

---

## Adding more links

To add a new page link, add an entry to `NAV_LINKS`:

```tsx
// Add to NAV_LINKS array:
{ name: 'Analytics', href: '/analytics', segment: 'analytics' }
// (Analytics is not included by default — add it only if needed)
```

Links are text-only — do NOT add icons next to link labels in the navbar
or drawer.

---

## SDK component reference

For detailed props and customization of the SDK components used in
these pages, see:

- `/iblai-profile` — `Profile`, `UserProfileDropdown`, `UserProfileModal` props,
  profile content APIs, career API slice, media uploads
- `/iblai-account` — `Account` props, tab visibility, billing integration
- `/iblai-notification` — `NotificationDisplay`, `NotificationDropdown` props,
  admin vs user roles
