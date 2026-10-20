export const SESSION_COOKIE = 'vc_refresh';
export const MESSAGE_TTL_MS = 10 * 60 * 60 * 1000;
export const EXPIRY_WARNING_MS = 60 * 60 * 1000;
export const MAX_CIPHERTEXT_BYTES = 262_144;
export const AES_GCM_TAG_BYTES = 16;
/** Voice messages use the enlarged encrypted payload limit. */
export const MAX_PLAINTEXT_BYTES = MAX_CIPHERTEXT_BYTES - AES_GCM_TAG_BYTES;
export const MAX_TEXT_PLAINTEXT_BYTES = 8192 - AES_GCM_TAG_BYTES;
export const MAX_VOICE_AUDIO_BYTES = 160 * 1024;
export const MAX_VOICE_DURATION_SECONDS = 30;
export const HISTORY_PAGE_SIZE = 50;
export const CODE_REVEAL_SECONDS = 30;
