import { usersApi } from '@/lib/api/endpoints';
import { ensureIdentity } from '@/lib/crypto';
import type { User } from '@/types';

/**
 * Make sure this browser has an identity key and the server knows its public half.
 * A different fingerprint on the server (new device / admin reset) triggers re-registration.
 */
export async function ensureDeviceKey(user: User): Promise<string> {
  const identity = await ensureIdentity(user.id);
  if (identity.fingerprint !== user.keyFingerprint) {
    await usersApi.registerKey(identity.publicKeyB64);
  }
  return identity.fingerprint;
}

export async function resetDeviceKey(user: User): Promise<string> {
  const identity = await ensureIdentity(user.id);
  await usersApi.resetKey(identity.publicKeyB64);
  return identity.fingerprint;
}
