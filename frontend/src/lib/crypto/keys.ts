import { bs, toB64, toHex } from './encoding';

/**
 * Device identity = ECDH P-256 keypair.
 * The private key is generated with extractable:false and persisted as a CryptoKey
 * object in IndexedDB (structured clone) — its raw bytes are never readable by JS.
 */
const DB_NAME = 'vaultchat';
const STORE = 'identity';
const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;

interface StoredIdentity {
  privateKey: CryptoKey;
  spki: ArrayBuffer;
}

export interface Identity {
  publicKeyB64: string;
  fingerprint: string;
  created: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function generateIdentityKeyPair(): Promise<{ privateKey: CryptoKey; spki: ArrayBuffer }> {
  const pair = await crypto.subtle.generateKey(ECDH, false, ['deriveBits']);
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey); // public keys are always exportable
  return { privateKey: pair.privateKey, spki };
}

export async function fingerprintOf(spki: ArrayBuffer | Uint8Array): Promise<string> {
  const data = spki instanceof Uint8Array ? spki : new Uint8Array(spki);
  const digest = await crypto.subtle.digest('SHA-256', bs(data));
  return toHex(digest).slice(0, 32);
}

export async function ensureIdentity(userId: string): Promise<Identity> {
  let stored = await withStore<StoredIdentity | undefined>('readonly', (s) => s.get(userId));
  let created = false;
  if (!stored) {
    stored = await generateIdentityKeyPair();
    await withStore('readwrite', (s) => s.put(stored as StoredIdentity, userId));
    created = true;
  }
  return {
    publicKeyB64: toB64(stored.spki),
    fingerprint: await fingerprintOf(stored.spki),
    created,
  };
}

export async function getPrivateKey(userId: string): Promise<CryptoKey | null> {
  const stored = await withStore<StoredIdentity | undefined>('readonly', (s) => s.get(userId));
  return stored?.privateKey ?? null;
}

export async function removeIdentity(userId: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(userId));
}
