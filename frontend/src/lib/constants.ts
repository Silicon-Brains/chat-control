export const SESSION_COOKIE = 'vc_refresh';
export const MESSAGE_TTL_MS = 10 * 60 * 60 * 1000;
export const EXPIRY_WARNING_MS = 60 * 60 * 1000;
export const MAX_CIPHERTEXT_BYTES = 8192;
export const AES_GCM_TAG_BYTES = 16;
/** Largest plaintext (UTF-8 bytes) that still fits the 8 KB ciphertext cap. */
export const MAX_PLAINTEXT_BYTES = MAX_CIPHERTEXT_BYTES - AES_GCM_TAG_BYTES;
export const HISTORY_PAGE_SIZE = 50;
export const CODE_REVEAL_SECONDS = 30;
