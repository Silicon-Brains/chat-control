import { describe, expect, it } from 'vitest';
import { generateIdentityKeyPair } from './keys';
import { buildAad, decryptMessage, encryptMessage } from './message';
import { fromB64, toB64 } from './encoding';
import { generateConversationKey, unwrapConversationKey, wrapConversationKey } from './wrap';

async function setup() {
  const alice = await generateIdentityKeyPair();
  const raw = generateConversationKey();
  const wrapped = await wrapConversationKey(raw, toB64(alice.spki), 1);
  const key = await unwrapConversationKey(alice.privateKey, wrapped.wrappedKey, wrapped.wrapperPub, 1);
  return { alice, key, wrapped };
}

describe('conversation key wrapping', () => {
  it('round-trips a message', async () => {
    const { key } = await setup();
    const aad = buildAad('c1', 'u1', 1);
    const { ciphertext, nonce } = await encryptMessage(key, 'héllo 👋', aad);
    expect(await decryptMessage(key, ciphertext, nonce, aad)).toBe('héllo 👋');
  });

  it('detects tampered ciphertext', async () => {
    const { key } = await setup();
    const aad = buildAad('c1', 'u1', 1);
    const { ciphertext, nonce } = await encryptMessage(key, 'secret', aad);
    const bytes = fromB64(ciphertext);
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    await expect(decryptMessage(key, toB64(bytes), nonce, aad)).rejects.toThrow();
  });

  it('rejects mismatched AAD (replay into another conversation)', async () => {
    const { key } = await setup();
    const { ciphertext, nonce } = await encryptMessage(key, 'secret', buildAad('c1', 'u1', 1));
    await expect(decryptMessage(key, ciphertext, nonce, buildAad('c2', 'u1', 1))).rejects.toThrow();
  });

  it('cannot be unwrapped by a different identity', async () => {
    const { wrapped } = await setup();
    const mallory = await generateIdentityKeyPair();
    await expect(
      unwrapConversationKey(mallory.privateKey, wrapped.wrappedKey, wrapped.wrapperPub, 1),
    ).rejects.toThrow();
  });

  it('rejects oversized plaintext', async () => {
    const { key } = await setup();
    await expect(encryptMessage(key, 'a'.repeat(9000), buildAad('c', 'u', 1))).rejects.toThrow();
  });
});
