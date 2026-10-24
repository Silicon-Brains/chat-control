import { buildAad, decryptMessage, encryptMessage, getConversationKey } from '@/lib/crypto';
import type { ChatMessage, Conversation, EncryptedMessage } from '@/types';

export async function toChatMessage(m: EncryptedMessage): Promise<ChatMessage> {
  const base = {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    keyVersion: m.keyVersion,
    createdAt: m.createdAt,
    expiresAt: m.expiresAt,
    updatedAt: m.updatedAt,
  };
  if (m.deletedAt) return { ...base, text: null, status: 'deleted' };
  if (!m.ciphertext || !m.nonce) return { ...base, text: null, status: 'undecryptable' };
  const key = getConversationKey(m.conversationId, m.keyVersion);
  if (!key) return { ...base, text: null, status: 'undecryptable' };
  try {
    const text = await decryptMessage(key, m.ciphertext, m.nonce, buildAad(m.conversationId, m.senderId, m.keyVersion));
    return { ...base, text, status: 'ok' };
  } catch {
    return { ...base, text: null, status: 'undecryptable' };
  }
}

export async function prepareOutgoing(conversation: Conversation, senderId: string, text: string, id: string) {
  return { id, ...(await prepareOutgoingPayload(conversation, senderId, text)) };
}

export async function prepareOutgoingPayload(conversation: Conversation, senderId: string, text: string) {
  const key = getConversationKey(conversation.id, conversation.currentKeyVersion);
  if (!key) throw new Error('Encryption key unavailable on this device');
  const keyVersion = conversation.currentKeyVersion;
  const sealed = await encryptMessage(key, text, buildAad(conversation.id, senderId, keyVersion));
  return { keyVersion, ...sealed };
}
