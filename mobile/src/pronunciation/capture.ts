import { generateUUID } from '../utils/uuid';

export const MAX_DURATION_MS = 10_000;
export const MAX_AUDIO_BYTES = 262_144;
export const CAPTURE_PROFILE = 'expo57-term-m4a-v1';

export type CaptureState = 'ready' | 'permission_required' | 'permission_denied' | 'preparing' | 'recording' | 'stopping' | 'recorded' | 'error';
export type CaptureError = 'recording' | 'invalidRecording' | 'cleanup';
export interface CaptureSnapshot { state: CaptureState; durationMs: number; error?: CaptureError; recording?: { uri: string; durationMs: number; completedAt: string; clientAttemptId: string }; }
export interface RecorderSession {
  prepare(): Promise<void>;
  record(options: { forDuration: number }): void;
  stop(): Promise<void>;
  status(): { durationMs: number; isRecording: boolean };
  uri(): string | null;
  release(): void;
}
export interface CaptureDependencies {
  permission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  requestPermission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  create(): RecorderSession;
  size(uri: string): number;
  remove(uri: string): void;
}

export function validRecording(durationMs: number, bytes: number): boolean {
  return Number.isFinite(durationMs) && durationMs > 0 && durationMs <= MAX_DURATION_MS
    && Number.isSafeInteger(bytes) && bytes > 0 && bytes <= MAX_AUDIO_BYTES;
}

/** Capture stays in cache until submit, rerecord, cancellation, or disposal. */
export class CaptureController {
  private snapshot: CaptureSnapshot = { state: 'ready', durationMs: 0 };
  private session: RecorderSession | null = null;
  private pendingUri: string | null = null;
  private generation = 0;
  private disposed = false;
  private operation: Promise<void> | null = null;

  constructor(private deps: CaptureDependencies, private changed: (value: CaptureSnapshot) => void) {}

  private publish(value: CaptureSnapshot) {
    this.snapshot = value;
    if (!this.disposed) this.changed(value);
  }

  private run(work: () => Promise<void>): Promise<void> {
    if (this.operation || this.disposed) return this.operation ?? Promise.resolve();
    const pending = work().finally(() => { if (this.operation === pending) this.operation = null; });
    this.operation = pending;
    return pending;
  }

  private async cleanup() {
    const session = this.session;
    if (session) {
      // Save the URI before releasing the native object; failed deletion is retried.
      this.pendingUri = session.uri() ?? this.pendingUri;
      await session.stop();
      this.pendingUri = session.uri() ?? this.pendingUri;
      session.release();
      this.session = null;
    }
    if (this.pendingUri) {
      this.deps.remove(this.pendingUri);
      this.pendingUri = null;
    }
  }

  start(): Promise<void> {
    if (!['ready', 'permission_required', 'permission_denied', 'recorded', 'error'].includes(this.snapshot.state)) return Promise.resolve();
    const generation = this.generation;
    return this.run(async () => {
      this.publish({ state: 'preparing', durationMs: 0 });
      try {
        await this.cleanup();
        let permission = await this.deps.permission();
        if (generation !== this.generation) return;
        if (!permission.granted) {
          if (permission.canAskAgain) permission = await this.deps.requestPermission();
          if (generation !== this.generation) return;
          this.publish({ state: permission.granted ? 'ready' : permission.canAskAgain ? 'permission_required' : 'permission_denied', durationMs: 0 });
          return; // Permission grant never starts the microphone automatically.
        }
        this.session = this.deps.create();
        await this.session.prepare();
        if (generation !== this.generation) return;
        this.session.record({ forDuration: MAX_DURATION_MS / 1000 });
        this.publish({ state: 'recording', durationMs: 0 });
      } catch {
        if (generation === this.generation) this.publish({ state: 'error', durationMs: 0, error: 'recording' });
      } finally {
        if (generation !== this.generation || this.snapshot.state === 'error') {
          try { await this.cleanup(); } catch { this.publish({ state: 'error', durationMs: 0, error: 'cleanup' }); }
        }
      }
    });
  }

  tick() {
    if (this.snapshot.state !== 'recording' || !this.session) return;
    try {
      const status = this.session.status();
      this.publish({ state: 'recording', durationMs: status.durationMs });
      if (!status.isRecording) void this.stop();
    } catch { void this.cancel(); }
  }

  stop(): Promise<void> {
    if (this.snapshot.state !== 'recording' || !this.session) return Promise.resolve();
    const generation = this.generation;
    return this.run(async () => {
      const session = this.session!;
      this.publish({ state: 'stopping', durationMs: this.snapshot.durationMs });
      let durationMs = this.snapshot.durationMs;
      let valid = false;
      try {
        durationMs = session.status().durationMs;
        await session.stop();
        const uri = session.uri();
        valid = !!uri && validRecording(durationMs, this.deps.size(uri));
        if (valid && uri) {
          this.pendingUri = uri;
          session.release();
          this.session = null;
        } else await this.cleanup();
        if (generation === this.generation) this.publish({ state: valid ? 'recorded' : 'error', durationMs,
          ...(valid && uri ? { recording: { uri, durationMs, completedAt: new Date().toISOString(), clientAttemptId: generateUUID() } } : { error: 'invalidRecording' as const }) });
      } catch {
        try { await this.cleanup(); } catch { /* Keep session/URI for a later cleanup retry. */ }
        if (generation === this.generation) this.publish({ state: 'error', durationMs: 0, error: this.session || this.pendingUri ? 'cleanup' : 'recording' });
      }
    });
  }

  async cancel(): Promise<void> {
    ++this.generation; // Fence permission/preparation/stop completions immediately.
    this.publish({ state: 'stopping', durationMs: 0 });
    await this.operation;
    try {
      await this.cleanup();
      this.publish({ state: 'ready', durationMs: 0 });
    } catch { this.publish({ state: 'error', durationMs: 0, error: 'cleanup' }); }
  }

  async dispose() { this.disposed = true; await this.cancel(); }
}

