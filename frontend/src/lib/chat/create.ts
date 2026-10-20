import { conversationsApi } from '@/lib/api/endpoints';
import { generateConversationKey, wrapConversationKey } from '@/lib/crypto';
import type { ConversationType, DirectoryUser } from '@/types';

interface CreateInput {
  type: Exclude<ConversationType, 'broadcast'>;
  name?: string;
  self: DirectoryUser;
  others: DirectoryUser[];
}

/** Generates a fresh AES key client-side and wraps it for every member (including the creator). */
export async function createConversation({ type, name, self, others }: CreateInput) {
  const everyone = [self, ...others.filter((u) => u.id !== self.id)];
  const notReady = everyone.find((u) => !u.publicKey);
  if (notReady) throw new Error(`${notReady.displayName} hasn’t signed in yet, so has no encryption key.`);

  const raw = generateConversationKey();
  const members = await Promise.all(
    everyone.map(async (u) => ({
      userId: u.id,
      ...(await wrapConversationKey(raw, u.publicKey as string, 1)),
    })),
  );
  raw.fill(0);
  return conversationsApi.create({ type, name, members });
}
