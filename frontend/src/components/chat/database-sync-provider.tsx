'use client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/stores/session';
import { useChatStore } from '@/stores/chat';

/** Polls database-backed conversation metadata while the user is active. */
export function DatabaseSyncProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const userId = useSession((s) => s.user?.id);
  const keyReady = useSession((s) => s.keyReady);
  useEffect(() => {
    if (!userId || !keyReady) return;
    const sync = () => {
      if (document.visibilityState !== 'visible') return;
      void qc.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'conversation' });
      useChatStore.getState().prune(Date.now());
    };
    const timer = window.setInterval(sync, 10_000);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [userId, keyReady, qc]);
  return <>{children}</>;
}
