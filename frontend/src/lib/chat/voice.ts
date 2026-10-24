import { MAX_VOICE_AUDIO_BYTES, MAX_VOICE_DURATION_SECONDS } from '@/lib/constants';
import { fromB64, toB64 } from '@/lib/crypto/encoding';

const VOICE_PREFIX = 'vaultchat-voice-v1\n';

export interface VoicePayload {
  mimeType: string;
  durationMs: number;
  data: string;
}

export function isVoiceMessage(value: string | null): boolean {
  return value?.startsWith(VOICE_PREFIX) ?? false;
}

export function parseVoiceMessage(value: string | null): VoicePayload | null {
  if (!value?.startsWith(VOICE_PREFIX)) return null;
  const metadataStart = VOICE_PREFIX.length;
  const durationEnd = value.indexOf('\n', metadataStart);
  const mimeEnd = value.indexOf('\n', durationEnd + 1);
  if (durationEnd < 0 || mimeEnd < 0) return null;

  const durationMs = Number(value.slice(metadataStart, durationEnd));
  let mimeType: string;
  try {
    mimeType = decodeURIComponent(value.slice(durationEnd + 1, mimeEnd));
  } catch {
    return null;
  }
  const data = value.slice(mimeEnd + 1);
  if (
    !Number.isInteger(durationMs) ||
    durationMs < 1 ||
    durationMs > MAX_VOICE_DURATION_SECONDS * 1000 ||
    // MediaRecorder MIME strings may contain whitespace and quoted codec values
    // (for example: audio/mp4; codecs="mp4a.40.2"). Keep the subtype and
    // parameter syntax constrained, but accept valid browser variations.
    !/^audio\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:\s*;\s*[a-z0-9!#$&^_.+-]+\s*=\s*(?:[a-z0-9!#$&^_.+-]+|"[^"\r\n]*"))*$/i.test(mimeType) ||
    data.length === 0 ||
    data.length > Math.ceil(MAX_VOICE_AUDIO_BYTES / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)
  ) {
    return null;
  }
  return { mimeType, durationMs, data };
}

export function voicePayloadToBlob(payload: VoicePayload): Blob | null {
  try {
    const bytes = fromB64(payload.data);
    if (bytes.length > MAX_VOICE_AUDIO_BYTES) return null;
    const audio = new ArrayBuffer(bytes.length);
    new Uint8Array(audio).set(bytes);
    return new Blob([audio], { type: payload.mimeType });
  } catch {
    return null;
  }
}

export async function serializeVoiceMessage(blob: Blob, durationMs: number): Promise<string> {
  if (blob.size === 0) throw new Error('The recording is empty');
  if (blob.size > MAX_VOICE_AUDIO_BYTES) throw new Error('Voice message is too large');
  if (!blob.type.startsWith('audio/')) throw new Error('This audio format is not supported');
  if (durationMs < 1 || durationMs > MAX_VOICE_DURATION_SECONDS * 1000) {
    throw new Error('Voice messages must be 30 seconds or shorter');
  }
  const data = toB64(new Uint8Array(await blob.arrayBuffer()));
  return `${VOICE_PREFIX}${Math.round(durationMs)}\n${encodeURIComponent(blob.type)}\n${data}`;
}
