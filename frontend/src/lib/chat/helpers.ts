import type { Conversation } from '@/types';

export function conversationTitle(c: Conversation, myId: string): string {
  if (c.type !== 'direct') return c.name ?? 'Untitled';
  return c.members.find((m) => m.userId !== myId)?.displayName ?? 'Direct chat';
}

export const canPost = (c: Conversation) => c.type !== 'broadcast' || c.myRole === 'sender' || c.myRole === 'owner';
