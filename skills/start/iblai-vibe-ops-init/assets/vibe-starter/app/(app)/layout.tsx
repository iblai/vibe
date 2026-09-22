'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { NavBar, type NavLink } from '@/components/navbar/nav-bar';
import {
  NavigationDrawer,
  type NavItem,
} from '@/components/navbar/navigation-drawer';
import config from '@/lib/iblai/config';
import { resolveAppTenant, readTenants, isTenantAdmin } from '@/lib/iblai/tenant';
import { handleLogout } from '@/lib/iblai/auth-utils';
import { AdminModeProvider } from '@/lib/iblai/admin-mode';

/** What every member sees. */
const MEMBER_LINKS: NavLink[] = [
  { name: 'Home', href: '/', segment: null },
  { name: 'Agents', href: '/agents', segment: 'agents' },
  { name: 'Profile', href: '/profile', segment: 'profile' },
];

/** What org admins see in Admin mode, on top of the member links. */
const ADMIN_LINKS: NavLink[] = [
  { name: 'Users', href: '/admin/users', segment: 'admin' },
  { name: 'Analytics', href: '/admin/analytics', segment: 'admin' },
  { name: 'Billing', href: '/admin/billing', segment: 'admin' },
  { name: 'Memory', href: '/admin/memory', segment: 'admin' },
  { name: 'Organization', href: '/admin/organization', segment: 'admin' },
];

type Session = {
  tenantKey: string;
  username?: string;
  email: string;
  isAdmin: boolean;
  tenants: any[];
  currentTenant?: any;
};

// Read synchronously on the first client render: the providers hold this tree
// until mounted, and the SDK dropdown fetches by `username` on mount.
function readSession(): Session {
  const session: Session = { tenantKey: '', email: '', isAdmin: false, tenants: [] };
  if (typeof window === 'undefined') return session;
  try {
    const raw = localStorage.getItem('userData');
    if (raw) {
      const parsed = JSON.parse(raw);
      session.username = parsed.user_nicename ?? parsed.username ?? undefined;
      session.email = parsed.user_email ?? parsed.email ?? '';
    }
  } catch {}
  session.tenantKey = resolveAppTenant();
  session.tenants = readTenants();
  session.currentTenant = session.tenants.find((t) => t.key === session.tenantKey);
  session.isAdmin = isTenantAdmin();
  return session;
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [session] = useState(readSession);
  // Org admins start in Admin mode and can switch to the member's view.
  const [adminMode, setAdminMode] = useState(true);
  const { tenantKey, username, email, isAdmin, tenants, currentTenant } = session;
  const liveAdmin = isAdmin && adminMode;
  const pathname = usePathname() ?? '/';
  const router = useRouter();

  // The admin area is admin-only, in Admin mode only.
  useEffect(() => {
    if (pathname.startsWith('/admin') && !liveAdmin) router.replace('/');
  }, [pathname, liveAdmin, router]);

  const links = liveAdmin ? [...MEMBER_LINKS, ...ADMIN_LINKS] : MEMBER_LINKS;
  const drawerItems: NavItem[] = links.map(({ name, href }) => ({ name, href }));

  return (
    <AdminModeProvider isAdmin={isAdmin} mode={adminMode} setMode={setAdminMode}>
      <div className="flex h-screen flex-col overflow-hidden bg-white">
        <NavBar
          onMenuClick={() => setDrawerOpen((prev) => !prev)}
          links={links}
          tenantKey={tenantKey}
          username={username}
          email={email}
          mainPlatformKey={config.mainTenantKey()}
          isAdmin={isAdmin}
          currentTenant={currentTenant}
          userTenants={tenants}
          authURL={config.authUrl()}
          onLogout={() => handleLogout()}
          onTenantChange={(key: string) => {
            localStorage.setItem('current_tenant', key);
            localStorage.setItem('tenant', key);
            window.location.reload();
          }}
        />

        <NavigationDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          items={drawerItems}
        />

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--sidebar-bg,#fafbfc)]">
          {pathname.startsWith('/admin') && !liveAdmin ? null : children}
        </main>
      </div>
    </AdminModeProvider>
  );
}
