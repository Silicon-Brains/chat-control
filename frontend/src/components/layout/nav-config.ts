import { LayoutDashboard, Megaphone, MessageSquare, ScrollText, Settings, ShieldCheck, Users, type LucideIcon } from 'lucide-react';

export interface NavItem { href: string; label: string; icon: LucideIcon }

export const userNav: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chats', label: 'Chats', icon: MessageSquare },
  { href: '/groups', label: 'Groups', icon: Users },
  { href: '/broadcasts', label: 'Broadcasts', icon: Megaphone },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export const adminNav: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
  { href: '/admin/security', label: 'Security', icon: ShieldCheck },
];

export const isActive = (pathname: string, href: string) =>
  href === '/' || href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
