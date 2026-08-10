'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Logo } from './logo';
import { UserProfileButton } from './user-profile-button';
import {
  CreditBalance,
  NotificationDropdown,
} from '@iblai/iblai-js/web-containers';
import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface NavLink {
  name: string;
  href: string;
  segment: string | null;
}

interface NavBarProps {
  onMenuClick: () => void;
  links: NavLink[];
  tenantKey: string;
  username?: string;
  email: string;
  mainPlatformKey: string;
  isAdmin: boolean;
  currentTenant?: any;
  userTenants?: any[];
  authURL: string;
  onLogout: () => void;
  onTenantChange: (key: string) => void;
  onTenantUpdate?: (tenant: any) => void;
  onAccountDeleted?: () => void;
  showNotifications?: boolean;
  showProfileDropdown?: boolean;
  showCreditBalance?: boolean;
  creditRedirectUrl?: string;
}

export function NavBar({
  onMenuClick,
  links,
  tenantKey,
  username,
  email,
  mainPlatformKey,
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
  showCreditBalance = true,
  creditRedirectUrl,
}: NavBarProps) {
  const router = useRouter();
  const pathname = usePathname() ?? '/';

  const handleViewNotifications = useCallback(
    (notificationId?: string) => {
      router.push(`/notifications/${notificationId ?? ''}`);
    },
    [router],
  );

  return (
    <header className="h-16 flex-shrink-0 border-b border-[var(--border-color)] bg-[var(--navbar-bg,#fff)] md:h-20">
      <div className="flex h-full items-center justify-between px-4 sm:px-6 md:px-6 lg:px-8">
        <div className="flex h-full items-center">
          <button
            onClick={onMenuClick}
            className="mr-3 rounded-sm text-[var(--navbar-text,var(--text-secondary))] hover:bg-[var(--navbar-hover-bg,var(--hover-bg))] hover:text-[var(--navbar-hover-text,var(--text-primary))] focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none focus:ring-inset md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Logo />

          <nav className="ml-8 hidden h-full items-center space-x-6 md:flex">
            {links.map((link) => {
              const isActive =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex h-full items-center text-sm font-medium',
                    isActive
                      ? 'border-b-2 border-[var(--navbar-active-border,var(--primary-color))] text-[var(--navbar-active-text,var(--primary-color))]'
                      : 'text-[var(--navbar-text,var(--text-secondary))] hover:text-[var(--navbar-hover-text,var(--text-primary))]'
                  )}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          {showCreditBalance &&
            currentTenant?.show_paywall &&
            tenantKey &&
            username &&
            email && (
              <CreditBalance
                tenant={tenantKey}
                enabled={true}
                username={username}
                mainPlatformKey={mainPlatformKey}
                currentUserEmail={email}
                redirectUrl={
                  creditRedirectUrl ??
                  (typeof window !== 'undefined'
                    ? window.location.origin
                    : '')
                }
              />
            )}

          {showNotifications && (
            <NotificationDropdown
              org={tenantKey}
              userId={username ?? ''}
              isAdmin={isAdmin}
              onViewNotifications={handleViewNotifications}
            />
          )}

          {showProfileDropdown && (
            <div className="relative">
              <UserProfileButton
                username={username}
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
