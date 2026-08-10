'use client';

import { useEffect, useState } from 'react';
import { NavBar, type NavLink } from '@/components/navbar/nav-bar';
import {
  NavigationDrawer,
  type NavItem,
} from '@/components/navbar/navigation-drawer';
import config from '@/lib/iblai/config';
import { resolveAppTenant } from '@/lib/iblai/tenant';
import { handleLogout } from '@/lib/iblai/auth-utils';

const NAV_LINKS: NavLink[] = [
  { name: 'Home', href: '/', segment: null },
  { name: 'Profile', href: '/profile', segment: 'profile' },
  { name: 'Account', href: '/account', segment: 'account' },
];

const DRAWER_ITEMS: NavItem[] = NAV_LINKS.map(({ name, href }) => ({
  name,
  href,
}));

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tenantKey, setTenantKey] = useState('');
  const [username, setUsername] = useState<string | undefined>();
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [currentTenant, setCurrentTenant] = useState<any>(undefined);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('userData');
      if (raw) {
        const parsed = JSON.parse(raw);
        setUsername(parsed.user_nicename ?? parsed.username ?? undefined);
        setEmail(parsed.user_email ?? parsed.email ?? '');
      }
    } catch {}

    const resolved = resolveAppTenant();
    setTenantKey(resolved);

    try {
      const tenantsRaw = localStorage.getItem('tenants');
      if (tenantsRaw) {
        const parsed = JSON.parse(tenantsRaw);
        setTenants(parsed);
        const match = parsed.find((t: any) => t.key === resolved);
        if (match) {
          setIsAdmin(!!match.is_admin);
          setCurrentTenant(match);
        }
      }
    } catch {}
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <NavBar
        onMenuClick={() => setDrawerOpen((prev) => !prev)}
        links={NAV_LINKS}
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
        items={DRAWER_ITEMS}
      />

      <main
        className="flex-1 overflow-y-auto"
        style={{ background: 'var(--sidebar-bg, #fafbfc)' }}
      >
        {children}
      </main>
    </div>
  );
}
