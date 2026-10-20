import { create } from 'zustand';
import type { ChatMessage, ConnectionStatus } from '@/types';

interface ChatState {
  messages: Record<string, ChatMessage[]>;
  connection: ConnectionStatus;
  setConnection: (s: ConnectionStatus) => void;
  upsert: (conversationId: string, incoming: ChatMessage[]) => void;
  markFailed: (conversationId: string, id: string) => void;
  remove: (ids: string[]) => void;
  prune: (now: number) => void;
  reset: () => void;
}

const byTime = (a: ChatMessage, b: ChatMessage) =>
  a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt < b.createdAt ? -1 : 1;

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  connection: 'idle',
  setConnection: (connection) => set({ connection }),
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
  remove: (ids) =>
    set((s) => {
      const drop = new Set(ids);
      const next: Record<string, ChatMessage[]> = {};
      for (const [cid, list] of Object.entries(s.messages)) next[cid] = list.filter((m) => !drop.has(m.id));
      return { messages: next };
    }),
  prune: (now) =>
    set((s) => {
      const next: Record<string, ChatMessage[]> = {};
      for (const [cid, list] of Object.entries(s.messages)) {
        next[cid] = list.filter((m) => new Date(m.expiresAt).getTime() > now);
      }
      return { messages: next };
    }),
  reset: () => set({ messages: {}, connection: 'idle' }),
}));
