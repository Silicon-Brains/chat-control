import { create } from 'zustand';
import type { ChatMessage } from '@/types';

interface ChatState {
  messages: Record<string, ChatMessage[]>;
  upsert: (conversationId: string, incoming: ChatMessage[]) => void;
  markFailed: (conversationId: string, id: string) => void;
  markSent: (conversationId: string, id: string, createdAt: string, expiresAt: string) => void;
  markFailedById: (id: string) => void;
  remove: (ids: string[]) => void;
  clearConversation: (conversationId: string) => void;
  prune: (now: number) => void;
  reset: () => void;
}

const byTime = (a: ChatMessage, b: ChatMessage) =>
  a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt < b.createdAt ? -1 : 1;

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  upsert: (conversationId, incoming) =>
    set((s) => {
      const map = new Map((s.messages[conversationId] ?? []).map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, m);
      return { messages: { ...s.messages, [conversationId]: [...map.values()].sort(byTime) } };
    }),
  markFailed: (conversationId, id) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
          m.id === id ? { ...m, status: 'failed' as const } : m,
        ),
      },
    })),
  markSent: (conversationId, id, createdAt, expiresAt) =>
    set((s) => {
      const messages = s.messages[conversationId];
      if (!messages) return s;
      return {
        messages: {
          ...s.messages,
          [conversationId]: messages
            .map((message) =>
              message.id === id ? { ...message, createdAt, expiresAt, status: 'ok' as const } : message,
            )
            .sort(byTime),
        },
      };
    }),
  markFailedById: (id) =>
    set((s) => {
      let changed = false;
      const messages = Object.fromEntries(
        Object.entries(s.messages).map(([conversationId, list]) => {
          const next = list.map((message) => {
            if (message.id !== id || message.status !== 'pending') return message;
            changed = true;
            return { ...message, status: 'failed' as const };
          });
          return [conversationId, next];
        }),
      );
      return changed ? { messages } : s;
    }),
  remove: (ids) =>
    set((s) => {
      const drop = new Set(ids);
      const next: Record<string, ChatMessage[]> = {};
      for (const [cid, list] of Object.entries(s.messages)) next[cid] = list.filter((m) => !drop.has(m.id));
      return { messages: next };
    }),
  clearConversation: (conversationId) =>
    set((s) => {
      const messages = { ...s.messages };
      delete messages[conversationId];
      return { messages };
    }),
  prune: (now) =>
    set((s) => {
      const next: Record<string, ChatMessage[]> = {};
      for (const [cid, list] of Object.entries(s.messages)) {
        next[cid] = list.filter((m) => new Date(m.expiresAt).getTime() > now);
      }
      return { messages: next };
    }),
  reset: () => set({ messages: {} }),
}));
