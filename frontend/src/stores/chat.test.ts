import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from './chat';
import type { ChatMessage } from '@/types';

const pendingMessage: ChatMessage = {
  id: 'message-1',
  conversationId: 'conversation-1',
  senderId: 'user-1',
  keyVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-01T10:00:00.000Z',
  text: 'hello',
  status: 'pending',
};

describe('chat delivery status', () => {
  beforeEach(() => useChatStore.getState().reset());

  it('marks a message sent when its server acknowledgement arrives', () => {
    useChatStore.getState().upsert('conversation-1', [pendingMessage]);

    useChatStore.getState().markSent(
      'conversation-1',
      'message-1',
      '2026-01-01T00:00:01.000Z',
      '2026-01-01T10:00:01.000Z',
    );

    expect(useChatStore.getState().messages['conversation-1']?.[0]).toMatchObject({
      ...pendingMessage,
      createdAt: '2026-01-01T00:00:01.000Z',
      expiresAt: '2026-01-01T10:00:01.000Z',
      status: 'ok',
    });
  });

  it('marks the correlated message failed when the server rejects it', () => {
    useChatStore.getState().upsert('conversation-1', [pendingMessage]);

    useChatStore.getState().markFailedById('message-1');

    expect(useChatStore.getState().messages['conversation-1']?.[0]?.status).toBe('failed');
  });
});
