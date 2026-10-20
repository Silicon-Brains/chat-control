import { MAX_PLAINTEXT_BYTES } from '@/lib/constants';
import { bs, fromB64, randomBytes, textDecoder, textEncoder, toB64 } from './encoding';

/** AAD binds ciphertext to its context so it can't be replayed elsewhere. */
export const buildAad = (conversationId: string, senderId: string, keyVersion: number) =>
  textEncoder.encode(`${conversationId}|${senderId}|${keyVersion}`);

export const plaintextBytes = (text: string) => textEncoder.encode(text).length;

export async function encryptMessage(
  key: CryptoKey,
  plaintext: string,
  aad: Uint8Array,
): Promise<{ ciphertext: string; nonce: string }> {
  const data = textEncoder.encode(plaintext);
  if (data.length === 0) throw new Error('Message is empty');
  if (data.length > MAX_PLAINTEXT_BYTES) throw new Error('Message is too long');
  const nonce = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bs(nonce), additionalData: bs(aad), tagLength: 128 },
    key,
    bs(data),
  );
  return { ciphertext: toB64(ct), nonce: toB64(nonce) };
}

/** Throws if the ciphertext, nonce or AAD were tampered with. */
export async function decryptMessage(
  key: CryptoKey,
  ciphertextB64: string,
  nonceB64: string,
  aad: Uint8Array,
): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bs(fromB64(nonceB64)), additionalData: bs(aad), tagLength: 128 },
    key,
    bs(fromB64(ciphertextB64)),
  );
  return textDecoder.decode(pt);
}
