import { Sidebar } from './sidebar';
import { TabBar } from './tab-bar';
import type { NavItem } from './nav-config';

export function AppShell({ nav, children }: { nav: NavItem[]; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-content gap-5 p-4 md:p-5">
      <Sidebar items={nav} />
      <main id="main" className="min-w-0 flex-1 pb-24 md:pb-0">{children}</main>
      <TabBar items={nav} />
    </div>
  );
}
