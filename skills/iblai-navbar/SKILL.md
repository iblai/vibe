---
name: iblai-navbar
description: Add a responsive navbar with logo, page links, notification bell, and profile dropdown
globs:
alwaysApply: false
---

# /iblai-navbar

Add a responsive top navigation bar with:
- **Left:** Logo + page links (each with a Lucide icon)
- **Right:** Notification bell + user profile dropdown

The navbar matches the ibl.ai skillsai reference app and is fully
responsive -- desktop shows inline links, tablet/mobile collapses to a
hamburger drawer.

Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
They ship with their own styling. Keep the components as-is.
Do NOT implement dark mode unless the user explicitly asks for it.

When building custom UI around SDK components, use the ibl.ai brand:
- **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
- Follow the component hierarchy: use ibl.ai SDK components
  (`@iblai/iblai-js`) first, then shadcn/ui for everything else
  (`npx shadcn@latest add <component>`). Do NOT write custom components
  when an ibl.ai or shadcn equivalent exists. Both share the same
  Tailwind theme and render in ibl.ai brand colors automatically.
- Follow [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md) for
  colors, typography, spacing, and component styles.

---

## Prerequisites

- Auth must be set up first (`iblai add auth`)
- `@iblai/iblai-js` SDK installed
- shadcn/ui initialized (`npx shadcn@latest init`)
- Lucide icons: `pnpm add lucide-react`
- Media queries: `pnpm add react-responsive`

## Step 0 — Ask the user

Before doing anything, ask the user:

1. **Do you want a navbar?** If no, stop here.
2. **Which pages should appear in the navbar?** Suggest defaults:
   - Home (`/home`, `Home` icon)
   - Profile (`/profile`, `User` icon) — requires `/iblai-profile`
   - Discover (`/discover`, `Search` icon)
3. **Do you want a notification bell?** (default: yes) — requires `/iblai-notification`
4. **Do you want a profile dropdown?** (default: yes) — requires `/iblai-profile`

> **AI Assistant:** If the user wants Profile or Account pages but hasn't
> set them up yet, guide them to run `/iblai-profile` or `/iblai-account`
> first. If they want notifications, guide them to `/iblai-notification`.
> The navbar skill wires everything together but does NOT create those
> pages itself.

---

## Architecture

```
components/
  navbar/
    nav-bar.tsx              # Main navbar component
    navigation-drawer.tsx    # Mobile slide-out drawer
    logo.tsx                 # Tenant logo with fallback
    user-profile-button.tsx  # Profile dropdown wrapper
```

The navbar is rendered in the app layout and wraps all authenticated pages.

---

## Step 1 — Logo component

Create `components/navbar/logo.tsx`:

```tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  appName: string;
  logoUrl?: string;
  fallbackSrc?: string;
}

export function Logo({
  appName,
  logoUrl,
  fallbackSrc = '/images/logo.png',
}: LogoProps) {
  return (
    <Link href="/" className="flex items-center">
      <Image
        src={logoUrl || fallbackSrc}
        alt={appName}
        width={120}
        height={40}
        className="h-6 w-auto sm:h-7 md:h-8"
        loading="lazy"
      />
    </Link>
  );
}
```

The logo source should come from tenant metadata when available:

```tsx
import { useTenantMetadata } from '@iblai/iblai-js/web-utils';

const { metadata } = useTenantMetadata({ org: tenantKey });
const logoUrl = metadata?.auth_web_skillsai?.display_logo
  || `${dmUrl}/api/core/orgs/${tenantKey}/logo/`;
```

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

Create `components/navbar/navigation-drawer.tsx` for the mobile slide-out:

```tsx
'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './logo';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: NavItem[];
  appName: string;
  logoUrl?: string;
}

export function NavigationDrawer({
  isOpen,
  onClose,
  items,
  appName,
  logoUrl,
}: NavigationDrawerProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-80 transform bg-white shadow-lg transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex h-20 items-center justify-between border-b px-4">
          <Logo appName={appName} logoUrl={logoUrl} />
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-4">
          <ul className="space-y-2">
            {items.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                      isActive
                        ? 'border border-amber-200 bg-amber-50 text-amber-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        isActive ? 'text-amber-700' : 'text-gray-500'
                      }`}
                    />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
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
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export interface NavLink {
  name: string;
  href: string;
  icon: LucideIcon;
  /** First path segment to match for active state (e.g. "profile") */
  segment: string;
}

interface NavBarProps {
  activePage: string;
  onMenuClick: () => void;
  links: NavLink[];
  // Tenant/user props
  appName: string;
  logoUrl?: string;
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
  activePage,
  onMenuClick,
  links,
  appName,
  logoUrl,
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

  const handleViewNotifications = useCallback(
    (notificationId?: string) => {
      router.push(`/notifications/${notificationId ?? ''}`);
    },
    [router],
  );

  return (
    <header className="h-16 flex-shrink-0 border-b border-[var(--border)] bg-[var(--navbar-bg,#fff)] md:h-20">
      <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: hamburger + logo + links */}
        <div className="flex h-full items-center">
          <button
            onClick={onMenuClick}
            className="mr-3 rounded-sm text-[var(--navbar-text,#374151)] hover:bg-[var(--navbar-hover-bg,#f3f4f6)] hover:text-[var(--navbar-hover-text,#1f2937)] focus:ring-2 focus:ring-[var(--primary)] focus:outline-none focus:ring-inset md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Logo appName={appName} logoUrl={logoUrl} />

          {/* Desktop navigation links */}
          <nav className="ml-8 hidden h-full items-center space-x-6 md:flex">
            {links.map((link) => {
              const isActive = activePage === link.segment;
              const Icon = link.icon;
              return (
                <Link
                  key={link.segment}
                  href={link.href}
                  className={`flex h-full items-center gap-2 text-sm font-medium ${
                    isActive
                      ? 'border-b-2 border-[var(--navbar-active-border,#f59e0b)] text-[var(--navbar-active-text,#f59e0b)]'
                      : 'text-[var(--navbar-text,#374151)] hover:text-[var(--navbar-hover-text,#1f2937)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.name}
                </Link>
              );
            })}
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

## Step 5 — Wire into app layout

In your root layout or app layout component, render the navbar for all
authenticated pages:

```tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Home, User, Search } from 'lucide-react';
import { NavBar, type NavLink } from '@/components/navbar/nav-bar';
import { NavigationDrawer, type NavItem } from '@/components/navbar/navigation-drawer';

const NAV_LINKS: NavLink[] = [
  { name: 'Home',    href: '/home',    icon: Home,   segment: 'home' },
  { name: 'Profile', href: '/profile', icon: User,   segment: 'profile' },
  { name: 'Discover', href: '/discover', icon: Search, segment: 'discover' },
];

// Same items for the mobile drawer
const DRAWER_ITEMS: NavItem[] = NAV_LINKS.map(({ name, href, icon }) => ({
  name,
  href,
  icon,
}));

const NON_AUTH_PAGES = ['/login', '/sso-login-complete', '/logout'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Skip navbar on non-auth pages
  if (NON_AUTH_PAGES.includes(pathname)) {
    return <>{children}</>;
  }

  const activePage = pathname.split('/')[1] || 'home';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <div className="sticky top-0 z-40 w-full">
        <NavBar
          activePage={activePage}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          links={NAV_LINKS}
          appName="My App"
          tenantKey={/* getTenant() */}
          username={/* getUserName() */}
          isAdmin={/* from your auth context */}
          authURL={/* config.urls.auth() */}
          onLogout={/* your logout handler */}
          onTenantChange={/* your tenant switch handler */}
        />
      </div>

      <NavigationDrawer
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={DRAWER_ITEMS}
        appName="My App"
      />

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

---

## Step 6 — CSS variables

The navbar uses CSS custom properties for theming. Add these to your
`globals.css` (or they'll fall back to defaults):

```css
:root {
  --navbar-bg: #ffffff;
  --navbar-text: #374151;
  --navbar-hover-text: #1f2937;
  --navbar-hover-bg: #f3f4f6;
  --navbar-active-text: #f59e0b;
  --navbar-active-border: #f59e0b;
  --border: #d1d5db;
  --primary: #0058cc;
}
```

---

## Desktop vs Mobile behavior

| Breakpoint | Navbar Height | Links | Drawer |
|---|---|---|---|
| < 768px (mobile) | h-16 | Hidden | Hamburger opens drawer |
| >= 768px (desktop) | h-20 | Inline with icons | Hidden |

---

## Adding more links

To add a new page link, add an entry to `NAV_LINKS` and `DRAWER_ITEMS`:

```tsx
import { BarChart3 } from 'lucide-react';

// Add to NAV_LINKS array:
{ name: 'Analytics', href: '/analytics', icon: BarChart3, segment: 'analytics' }
```

The icon appears to the left of the link text on desktop, and to the left
of the item label in the mobile drawer.

---

## Related skills

- `/iblai-profile` — Profile dropdown and settings page (the dropdown
  rendered in the navbar comes from this)
- `/iblai-notification` — Notification bell and center page (the bell
  icon in the navbar comes from this)
- `/iblai-account` — Account/org settings page (can be linked from the
  profile dropdown)
