# iblai-vibe-navbar

> Add a responsive navbar with logo, page links, notification bell, and profile dropdown

# /iblai-vibe-navbar

> **First time here?** If `iblai.env` has no `ARCHITECTURE=`, run `/iblai-vibe-start` first (four questions; two minutes) — it decides single-org / multi-org / headless and who signs in, and every skill reads the answer.

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
> (https://github.com/iblai/vibe/tree/main/skills/iblai-vibe-ops-init/assets/vibe-starter) already ships this navbar
> wired up (logo, nav links, notification bell, profile dropdown, mobile
> drawer) along with auth and profile/account/notifications pages. Want to
> use that instead of building the navbar from scratch?

If yes, copy the bundled starter template from the installed
`iblai-vibe-ops-init` skill's `assets/vibe-starter/` directory (a sibling of
this skill's directory), or fetch it from the vibe repo if those assets are
not installed -- tell the user which path you took -- then skip this skill:

    cp -a <skills-dir>/iblai-vibe-ops-init/assets/vibe-starter/. .
    # or, without local assets:
    git clone --depth 1 https://github.com/iblai/vibe.git vibe-tmp && cp -a vibe-tmp/skills/iblai-vibe-ops-init/assets/vibe-starter/. . && rm -rf vibe-tmp

    pnpm install --ignore-scripts

> Run with `--ignore-scripts` to skip package lifecycle (postinstall) scripts.

If they prefer to add a navbar to an existing app, continue below.

## Prerequisites

- Auth must be set up first (`/iblai-vibe-auth`)
- `@iblai/iblai-js` SDK installed
- shadcn/ui initialized (`npx shadcn@latest init`)
- Lucide icons: `pnpm add lucide-react`

## What this skill creates

Every navbar includes all of the following — no choices, no skipping:

**Left side:** ibl.ai logo + three text links (no icons):
- Home (`/`)
- Profile (`/profile`)
- Account (`/account`)

**Right side (left → right):**
- Credit balance widget (plan-aware dropdown with credits, auto-recharge, upgrade)
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
    credit-balance-widget.tsx # Plan-aware credit balance dropdown
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

## Step 2 — Credit balance widget and Step 3 — Profile button

Both are documented in full in [`references/credit-and-profile-button.md`](references/credit-and-profile-button.md) (the credit widget is also `/iblai-vibe-credit`). vibe-starter ships both (`components/navbar/nav-bar.tsx`, `user-profile-button.tsx`).

## Step 4 — Navigation drawer (mobile)

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

## Step 5 — Main navbar

Create `components/navbar/nav-bar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Logo } from './logo';
import { CreditBalanceWidget } from './credit-balance-widget';
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
  showCreditBalance?: boolean;
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
  showCreditBalance = true,
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

        {/* Right: credit balance + notifications + profile */}
        <div className="flex items-center space-x-4">
          {showCreditBalance && <CreditBalanceWidget />}

          {showNotifications && (
            <NotificationDropdown
              org={tenantKey}
              userId={username ?? ""}
              isAdmin={isAdmin}
              onViewNotifications={handleViewNotifications}
            />
          )}

          {showProfileDropdown && (
            <div className="relative">
              <UserProfileButton
                username={username ?? ""}
                email={email}
                mainPlatformKey={mainPlatformKey}
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

## Steps 6–8 — Profile, Account, and Notifications pages

The three pages the navbar links to are each their own skill (`/iblai-vibe-profile`, `/iblai-vibe-account`, `/iblai-vibe-notification`) and ship in vibe-starter. The full code from this skill's original Steps 6–8 is preserved in [`references/pages.md`](references/pages.md).

## Step 9 — Wire into app layout

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
        tenantKey={tenantKey /* getTenant() */}
        username={username /* getUserName() */}
        email={email /* from userData in localStorage */}
        mainPlatformKey={mainPlatformKey /* config.mainTenantKey() */}
        isAdmin={isAdmin /* from your auth context */}
        authURL={authURL /* config.authUrl() */}
        onLogout={onLogout /* your logout handler */}
        onTenantChange={onTenantChange /* your tenant switch handler */}
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

## Step 10 — CSS variables, behavior, more links, SDK reference

The navbar's CSS variables (`--navbar-bg`, `--navbar-text`, `--navbar-active-*`, …), the desktop/mobile behavior table, how to add links, and the SDK component reference are in [`references/css-variables-and-reference.md`](references/css-variables-and-reference.md).