import type { WrappedKey } from '@/types';
import { getPrivateKey } from './keys';
import { unwrapConversationKey } from './wrap';

/** In-memory only. Cleared on logout. */
const cache = new Map<string, CryptoKey>();
const id = (conversationId: string, version: number) => `${conversationId}:${version}`;

export const getConversationKey = (conversationId: string, version: number) =>
  cache.get(id(conversationId, version));

export async function ensureKeys(
  userId: string,
  conversation: { id: string; keys: WrappedKey[] },
): Promise<void> {
  const missing = conversation.keys.filter((k) => !cache.has(id(conversation.id, k.keyVersion)));
  if (missing.length === 0) return;
  const priv = await getPrivateKey(userId);
  if (!priv) return; // messages will render as "can't decrypt on this device"
  for (const k of missing) {
    try {
      cache.set(
        id(conversation.id, k.keyVersion),
        await unwrapConversationKey(priv, k.wrappedKey, k.wrapperPub, k.keyVersion),
      );
    } catch {
      /* wrong device key or corrupted wrap — leave unset */
    }
  }
}

export const clearKeyring = () => cache.clear();
