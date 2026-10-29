import { PCMClip } from './types';

export class PcmBuffer {
  private chunks: Uint8Array[] = [];
  private bytes = 0;
  private rate = 0;

  append(buffer: { data: ArrayBuffer; sampleRate: number; channels: number }): boolean {
    const { data, sampleRate, channels } = buffer;
    if (channels !== 1 || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 48000 ||
        data.byteLength % 2 || (this.rate && this.rate !== sampleRate)) throw new Error('Unsupported microphone format.');
    this.rate = sampleRate;
    const limit = Math.min(1000000, sampleRate * 2 * 10);
    const length = Math.min(data.byteLength, limit - this.bytes);
    if (length > 0) { this.chunks.push(new Uint8Array(data.slice(0, length))); this.bytes += length; }
    return this.bytes >= limit;
  }
  snapshot(): PCMClip | null {
    if (!this.bytes || !this.rate) return null;
    const pcm = new Uint8Array(this.bytes);
    let offset = 0;
    for (const chunk of this.chunks) { pcm.set(chunk, offset); offset += chunk.length; }
    return { pcm: pcm.buffer, sampleRateHz: this.rate, channels: 1, durationMs: this.bytes / 2 / this.rate * 1000 };
  }
  get durationMs() { return this.rate ? this.bytes / 2 / this.rate * 1000 : 0; }
  clear() {
    for (const chunk of this.chunks) chunk.fill(0);
    this.chunks = []; this.bytes = 0; this.rate = 0;
  }
}

export function discardClip(clip: PCMClip | null) { if (clip) new Uint8Array(clip.pcm).fill(0); }
