'use client';
import { useQuery } from '@tanstack/react-query';
import { conversationsApi } from '@/lib/api/endpoints';
import { ensureKeys } from '@/lib/crypto';
import { useSession } from '@/stores/session';
import type { Conversation } from '@/types';

export const CONVERSATIONS_KEY = ['conversations'] as const;

/** Fetches conversations and unwraps their keys before resolving, so threads can decrypt immediately. */
export function useConversations() {
  const userId = useSession((s) => s.user?.id);
  const isUser = useSession((s) => s.user?.role === 'user');
  const keyReady = useSession((s) => s.keyReady);
  return useQuery({
    queryKey: CONVERSATIONS_KEY,
    enabled: isUser && Boolean(userId) && keyReady,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Conversation[]> => {
      const list = await conversationsApi.list();
      if (userId) await Promise.all(list.map((c) => ensureKeys(userId, c)));
      return list.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
    },
  });
}
