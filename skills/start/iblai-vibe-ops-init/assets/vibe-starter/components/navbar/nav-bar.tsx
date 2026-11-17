'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Logo } from './logo';
import { UserProfileButton } from './user-profile-button';
import { AdminModeSwitch } from './admin-mode-switch';
import {
  CreditBalance,
  NotificationDropdown,
  isPlatformNavbarCreditBalanceVisible,
} from '@iblai/iblai-js/web-containers';
import { useUserIsOnTrial } from '@iblai/iblai-js/web-utils';
import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import config from '@/lib/iblai/config';
import { useAdminMode } from '@/lib/iblai/admin-mode';
import { useTranslations } from 'next-intl';

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
  onTenantUpdate,
  onAccountDeleted,
  showNotifications = true,
  showProfileDropdown = true,
  showCreditBalance = true,
  creditRedirectUrl,
}: NavBarProps) {
  const t = useTranslations('Nav');
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const { adminMode } = useAdminMode();
  const userOnFreeTrial = useUserIsOnTrial();

  // The SDK's own rule for the credit balance (the OS navbar uses the same
  // one): billing on, the organization sells credits (or is the main one),
  // and the viewer can act on them — an admin in Admin mode or a free-trial
  // user — and is signed in.
  const creditBalanceVisible =
    showCreditBalance &&
    isPlatformNavbarCreditBalanceVisible({
      tenantKey,
      currentTenant: currentTenant
        ? { key: currentTenant.key, show_paywall: currentTenant.show_paywall }
        : null,
      stripeEnabled: config.stripeEnabled(),
      isLiveAdmin: isAdmin && adminMode,
      userOnFreeTrial,
      mainPlatformKey,
      currentUserEmail: email,
      username: username ?? '',
    }) &&
    !!username &&
    !!email;

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
            aria-label={t('openSidebar')}
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
          {/* Org admins: view the app as a member (User) or manage it (Admin). */}
          <AdminModeSwitch className="hidden md:flex" />

          {creditBalanceVisible && (
            <CreditBalance
              tenant={tenantKey}
              enabled={true}
              username={username ?? ''}
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
