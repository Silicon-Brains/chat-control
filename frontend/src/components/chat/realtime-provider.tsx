'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { CONVERSATIONS_KEY } from '@/hooks/use-conversations';
import { conversationsApi } from '@/lib/api/endpoints';
import { toChatMessage } from '@/lib/chat/pipeline';
import { ensureKeys } from '@/lib/crypto';
import { realtime } from '@/lib/ws/client';
import { useChatStore } from '@/stores/chat';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/toast';
import type { Conversation } from '@/types';

/** Owns the WebSocket lifecycle and routes server events into the chat store. */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const userId = useSession((s) => s.user?.id);
  const keyReady = useSession((s) => s.keyReady);

  useEffect(() => {
    if (!userId || !keyReady) return;
    const { setConnection, upsert, remove, prune } = useChatStore.getState();

    const offStatus = realtime.onStatus(setConnection);
    const offEvents = realtime.onEvent(async (event) => {
      switch (event.t) {
        case 'message.new': {
          let conv = qc.getQueryData<Conversation[]>(CONVERSATIONS_KEY)?.find((c) => c.id === event.conversationId);
          if (!conv) {
            const fresh = await qc.fetchQuery({ queryKey: CONVERSATIONS_KEY, queryFn: conversationsApi.list, staleTime: 0 });
            conv = fresh.find((c) => c.id === event.conversationId);
          }
          if (conv) await ensureKeys(userId, conv);
          upsert(event.conversationId, [await toChatMessage(event)]);
          void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
          break;
        }
        case 'message.expired':
          remove(event.ids);
          void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
          break;
        case 'key.rotated':
          void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
          break;
        case 'error':
          toast.error(event.error.message);
          break;
      }
    });

    realtime.start();
    const sweep = setInterval(() => prune(Date.now()), 30_000); // belt-and-braces: client-side expiry
    return () => {
      clearInterval(sweep);
      offStatus();
      offEvents();
      realtime.stop();
    };
  }, [userId, keyReady, qc]);

  return <>{children}</>;
}
