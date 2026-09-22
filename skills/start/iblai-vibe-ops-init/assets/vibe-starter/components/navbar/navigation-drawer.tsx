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
  const pathname = usePathname() ?? '/';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        <div className="flex h-16 items-center border-b border-[var(--border-color)] px-5">
          <div onClick={onClose}>
            <Logo />
          </div>
        </div>

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
