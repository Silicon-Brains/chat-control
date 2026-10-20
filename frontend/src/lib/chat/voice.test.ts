import { describe, expect, it } from 'vitest';
import { MAX_VOICE_AUDIO_BYTES } from '@/lib/constants';
import { parseVoiceMessage, serializeVoiceMessage, voicePayloadToBlob } from './voice';

describe('voice messages', () => {
  it('serializes recorded audio and restores its format and duration', async () => {
    const recording = new Blob([new Uint8Array([0, 1, 2, 3, 255])], { type: 'audio/webm;codecs=opus' });
    const serialized = await serializeVoiceMessage(recording, 4200);
    const parsed = parseVoiceMessage(serialized);

    expect(parsed).not.toBeNull();
    expect(parsed?.mimeType).toBe('audio/webm;codecs=opus');
    expect(parsed?.durationMs).toBe(4200);
    if (!parsed) throw new Error('serialized voice payload did not parse');
    const blob = voicePayloadToBlob(parsed);
    expect(blob).not.toBeNull();
    if (!blob) throw new Error('serialized voice payload did not decode');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(
      new Uint8Array([0, 1, 2, 3, 255]),
    );
  });

  it('rejects malformed payloads and oversized recordings', async () => {
    expect(parseVoiceMessage('vaultchat-voice-v1\n999999\n audio/webm\nAAAA')).toBeNull();
    expect(parseVoiceMessage('vaultchat-voice-v1\n1000\naudio/webm\nnot base64!')).toBeNull();
    await expect(
      serializeVoiceMessage(new Blob([new Uint8Array(MAX_VOICE_AUDIO_BYTES + 1)], { type: 'audio/webm' }), 1000),
    ).rejects.toThrow('too large');
  });
});
