'use client';
import { ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { VerifiedMark } from '@/components/ui/verified-mark';
import { conversationsApi } from '@/lib/api/endpoints';
import { canPost, conversationTitle } from '@/lib/chat/helpers';
import { prepareOutgoing, toChatMessage } from '@/lib/chat/pipeline';
import { serializeVoiceMessage } from '@/lib/chat/voice';
import { MESSAGE_TTL_MS } from '@/lib/constants';
import { useChatStore } from '@/stores/chat';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/toast';
import type { ChatMessage, Conversation } from '@/types';
import { Composer } from './composer';
import { GroupActions } from './group-actions';
import { MessageBubble } from './message-bubble';

const EMPTY: ChatMessage[] = [];

function encodeMessageCursor(createdAt: string, id: string): string {
  return btoa(`${createdAt}|${id}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function ChatThread({ conversation }: { conversation: Conversation }) {
  const user = useSession((s) => s.user)!;
  const messages = useChatStore((s) => s.messages[conversation.id] ?? EMPTY);
  const upsert = useChatStore((s) => s.upsert);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const syncCursor = useRef<string | null>(null);
  const pollInFlight = useRef(false);
  const convId = conversation.id;

  const fetchPage = useCallback(async (cur: string | null) => {
    const page = await conversationsApi.messages(convId, cur);
    upsert(convId, await Promise.all(page.items.map(toChatMessage)));
    if (cur === null && page.items[0]) {
      syncCursor.current = encodeMessageCursor(page.items[0].createdAt, page.items[0].id);
    }
    return page.nextCursor;
  }, [convId, upsert]);

  const pollUpdates = useCallback(async () => {
    if (loading || pollInFlight.current || document.visibilityState !== 'visible') return;
    pollInFlight.current = true;
    try {
      const after = syncCursor.current;
      if (!after) {
        await fetchPage(null);
        return;
      }
      const incoming = await conversationsApi.messageUpdates(convId, after);
      if (!incoming.length) return;
      upsert(convId, await Promise.all(incoming.map(toChatMessage)));
      const latest = incoming[incoming.length - 1]!;
      syncCursor.current = encodeMessageCursor(latest.createdAt, latest.id);
    } finally {
      pollInFlight.current = false;
    }
  }, [convId, fetchPage, loading, upsert]);

  // Initial history
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCursor(null);
    fetchPage(null)
      .then((next) => { if (!cancelled) setCursor(next); })
      .catch(() => toast.error('Couldn’t load messages.'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchPage]);

  // Refresh from the database while the conversation is open.
  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    const schedule = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      const startedAt = performance.now();
      void pollUpdates()
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled && document.visibilityState === 'visible') {
            timer = window.setTimeout(schedule, Math.max(0, 1_000 - (performance.now() - startedAt)));
          }
        });
    };
    const onVisibility = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      if (document.visibilityState === 'visible') schedule();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pollUpdates]);

  // Mark read + stick to bottom when new messages arrive.
  const last = messages[messages.length - 1];
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
    if (last && last.senderId !== user.id) void conversationsApi.markRead(convId).catch(() => undefined);
  }, [last?.id, convId, user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadOlder() {
    if (!cursor) return;
    setLoadingMore(true);
    try { setCursor(await fetchPage(cursor)); } finally { setLoadingMore(false); }
  }

  async function send(text: string): Promise<boolean> {
    const id = crypto.randomUUID();
    const now = Date.now();
    upsert(convId, [{
      id, conversationId: convId, senderId: user.id, keyVersion: conversation.currentKeyVersion,
      createdAt: new Date(now).toISOString(), expiresAt: new Date(now + MESSAGE_TTL_MS).toISOString(),
      text, status: 'pending',
    }]);
    try {
      const out = await prepareOutgoing(conversation, user.id, text, id);
      const saved = await conversationsApi.sendMessage(convId, out);
      useChatStore.getState().markSent(convId, id, saved.createdAt, saved.expiresAt);
      return true;
    } catch (e) {
      useChatStore.getState().markFailed(convId, id);
      toast.error(e instanceof Error ? e.message : 'Message not sent.');
      return false;
    }
  }

  async function sendVoice(blob: Blob, durationMs: number): Promise<boolean> {
    try {
      return await send(await serializeVoiceMessage(blob, durationMs));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Voice message not sent.');
      return false;
    }
  }

  const title = conversationTitle(conversation, user.id);
  const directPeer = conversation.type === 'direct'
    ? conversation.members.find((member) => member.userId !== user.id)
    : undefined;
  const names = new Map(conversation.members.map((m) => [m.userId, m.displayName]));
  const verifiedMembers = new Set(conversation.members.filter((m) => m.managementVerified).map((m) => m.userId));
  const showNames = conversation.type !== 'direct';

  return (
    <section className="glass flex h-full min-h-0 flex-col overflow-hidden" aria-label={`Conversation with ${title}`}>
      <header className="flex items-center gap-3 border-b border-black/5 px-4 py-3">
        <Link href="/chats" aria-label="Back to chats" className="grid h-10 w-10 place-items-center rounded-full hover:bg-primary-500/10 lg:hidden">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <Avatar name={title} icon={conversation.type === 'group' ? conversation.groupIcon : null} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1 truncate font-semibold">
            {title}{directPeer?.managementVerified && <VerifiedMark />}
          </h2>
          <p className="flex items-center gap-1 text-xs"><Lock className="h-3 w-3" aria-hidden />End-to-end encrypted · {conversation.members.length} members</p>
        </div>
        {conversation.type === 'group' && conversation.myRole === 'owner' && (
          <GroupActions conversation={conversation} />
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-2/3" />)}</div>
        ) : (
          <>
            {cursor && (
              <div className="mb-4 text-center">
                <Button variant="ghost" size="sm" onClick={loadOlder} loading={loadingMore}>Load earlier messages</Button>
              </div>
            )}
            {messages.length === 0 ? (
              <p className="py-16 text-center text-sm">No messages yet. They’ll disappear 10 hours after they’re sent.</p>
            ) : (
              <ul className="space-y-3" aria-live="polite">
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    mine={m.senderId === user.id}
                    senderName={showNames ? names.get(m.senderId) : undefined}
                    senderVerified={verifiedMembers.has(m.senderId)}
                  />
                ))}
              </ul>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <Composer
        onSend={send}
        onSendVoice={sendVoice}
        readOnlyReason={canPost(conversation) ? undefined : 'Only senders can post in this broadcast channel.'}
      />
    </section>
  );
}
