'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { isActive, type NavItem } from './nav-config';

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <aside className="glass sticky top-5 hidden h-[calc(100dvh-2.5rem)] shrink-0 flex-col gap-6 p-3 md:flex md:w-[72px] lg:w-60 lg:p-4">
      <div className="px-1 pt-1 lg:px-2"><Logo /></div>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-3 rounded-tile px-3.5 text-sm font-medium transition',
                active ? 'bg-primary-gradient text-white shadow-glass' : 'hover:bg-primary-500/10',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
