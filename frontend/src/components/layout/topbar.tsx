'use client';
import { Bell, LogOut } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { Avatar } from '@/components/ui/avatar';
import { useConversations } from '@/hooks/use-conversations';
import { env } from '@/lib/env';
import { useSession } from '@/stores/session';

// Lazy so user pages never download Clerk.
const AdminMenu = dynamic(() => import('@/components/admin/admin-menu').then((m) => m.AdminMenu), { ssr: false });

function ClerkSignOutButton({ clearLocal }: { clearLocal: () => void }) {
  const { signOut } = useClerk();
  return (
    <button
      onClick={() => {
        clearLocal();
        void signOut({ redirectUrl: '/login' });
      }}
      aria-label="Sign out"
      className="grid h-9 w-9 place-items-center rounded-full hover:bg-primary-500/10"
    >
      <LogOut className="h-4 w-4" aria-hidden />
    </button>
  );
}

export function Topbar({ title, greeting, admin }: { title: string; greeting?: string; admin?: boolean }) {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const { data } = useConversations();
  const unread = admin ? 0 : (data ?? []).reduce((n, c) => n + c.unreadCount, 0);

  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-primary-500">{greeting ?? `Hi, ${user?.displayName ?? ''}`}</p>
        <h1 className="text-[28px] font-bold leading-9 md:text-4xl md:leading-[44px]">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {!admin && (
          <Link href="/chats" aria-label={`Chats, ${unread} unread`} className="glass relative grid h-11 w-11 place-items-center !rounded-full">
            <Bell className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            {unread > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-accent-pink ring-2 ring-white" />}
          </Link>
        )}
        {admin && !env.mock ? (
          <AdminMenu />
        ) : (
          user && (
          <div className="glass flex items-center gap-2 !rounded-full py-1 pl-1 pr-2">
            <Avatar name={user.displayName} size={36} />
            <span className="hidden max-w-32 truncate text-sm font-medium text-ink-900 sm:inline">{user.displayName}</span>
            {env.mock ? (
              <button
                onClick={async () => { await signOut(); router.replace(admin ? '/admin/login' : '/login'); }}
                aria-label="Sign out"
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-primary-500/10"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            ) : <ClerkSignOutButton clearLocal={() => useSession.getState().clearLocal()} />}
          </div>
          )
        )}
      </div>
    </header>
  );
}
