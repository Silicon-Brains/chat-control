import { bs, fromB64, randomBytes, textEncoder, toB64 } from './encoding';

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;
const IV_BYTES = 12;

export const generateConversationKey = (): Uint8Array => randomBytes(32);

async function deriveWrappingKey(
  privateKey: CryptoKey,
  peerSpki: Uint8Array,
  keyVersion: number,
): Promise<CryptoKey> {
  const peer = await crypto.subtle.importKey('spki', bs(peerSpki), ECDH, false, []);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, privateKey, 256);
  const ikm = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: bs(textEncoder.encode(`vaultchat:wrap:v1:k${keyVersion}`)),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface WrappedResult {
  wrappedKey: string; // base64(iv || ciphertext)
  wrapperPub: string; // base64 SPKI of the one-time ephemeral key
}

/** Wrap a raw conversation key for one member using a fresh ephemeral ECDH key. */
export async function wrapConversationKey(
  rawKey: Uint8Array,
  memberPublicKeyB64: string,
  keyVersion: number,
): Promise<WrappedResult> {
  const eph = await crypto.subtle.generateKey(ECDH, false, ['deriveBits']);
  const wrapKey = await deriveWrappingKey(eph.privateKey, fromB64(memberPublicKeyB64), keyVersion);
  const iv = randomBytes(IV_BYTES);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(iv) }, wrapKey, bs(rawKey)),
  );
  const out = new Uint8Array(IV_BYTES + ct.length);
  out.set(iv, 0);
  out.set(ct, IV_BYTES);
  return {
    wrappedKey: toB64(out),
    wrapperPub: toB64(await crypto.subtle.exportKey('spki', eph.publicKey)),
  };
}

/** Unwrap into a NON-extractable AES-GCM key. */
export async function unwrapConversationKey(
  privateKey: CryptoKey,
  wrappedKeyB64: string,
  wrapperPubB64: string,
  keyVersion: number,
): Promise<CryptoKey> {
  const blob = fromB64(wrappedKeyB64);
  const wrapKey = await deriveWrappingKey(privateKey, fromB64(wrapperPubB64), keyVersion);
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bs(blob.slice(0, IV_BYTES)) },
    wrapKey,
    bs(blob.slice(IV_BYTES)),
  );
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
