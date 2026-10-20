'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isActive, type NavItem } from './nav-config';

export function TabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="glass fixed inset-x-3 bottom-3 z-30 flex justify-around !rounded-[22px] p-1.5 md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={cn('grid h-11 w-11 place-items-center rounded-tile', active ? 'bg-primary-gradient text-white' : 'text-ink-600')}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}
