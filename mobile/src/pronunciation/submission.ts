import { ApiError, AuthenticationError } from '../api/client';
import { AttemptMetadata, PronunciationResult } from './api';

export interface SubmissionSnapshot {
  state: 'idle' | 'submitting' | 'uncertain' | 'error' | PronunciationResult['status'];
  result?: PronunciationResult;
  error?: 'service' | 'recorded' | 'auth';
}
export interface SubmissionDependencies {
  submit(owner: string, metadata: AttemptMetadata, uri: string, signal: AbortSignal): Promise<PronunciationResult>;
  check(owner: string, metadata: AttemptMetadata, signal: AbortSignal): Promise<PronunciationResult>;
}

/** In-memory pronunciation only; retries reconcile the same attempt before resending. */
export class SubmissionController {
  private attempt?: { metadata: AttemptMetadata; uri: string };
  private request?: AbortController;
  private interrupt?: () => void;
  private generation = 0;
  private disposed = false;

  constructor(private owner: string, private deps: SubmissionDependencies, private changed: (snapshot: SubmissionSnapshot) => void) {}

  private publish(value: SubmissionSnapshot) { if (!this.disposed) this.changed(value); }

  async submit(metadata: AttemptMetadata, uri: string) {
    if (this.attempt || this.request || this.disposed) return;
    this.attempt = { metadata: Object.freeze({ ...metadata }), uri };
    await this.run(false);
  }

  async check() { if (this.attempt && !this.request && !this.disposed) await this.run(true); }

  private async run(reconcile: boolean) {
    const attempt = this.attempt!;
    const generation = this.generation;
    const controller = new AbortController();
    this.request = controller;
    this.publish({ state: 'submitting' });
    let rejectRequest!: (error: Error) => void;
    const interruption = new Promise<never>((_resolve, reject) => { rejectRequest = reject; });
    const interrupt = () => { controller.abort(); rejectRequest(new Error('Assessment interrupted.')); };
    this.interrupt = interrupt;
    const timer = setTimeout(interrupt, 45_000);
    try {
      const work = async (): Promise<PronunciationResult> => {
        try {
          return reconcile ? await this.deps.check(this.owner, attempt.metadata, controller.signal)
            : await this.deps.submit(this.owner, attempt.metadata, attempt.uri, controller.signal);
        } catch (error) {
          // A missing server claim is the only condition that permits resending.
          if (!reconcile || !(error instanceof ApiError) || error.status !== 404 || generation !== this.generation || controller.signal.aborted) throw error;
          return this.deps.submit(this.owner, attempt.metadata, attempt.uri, controller.signal);
        }
      };
      const result = await Promise.race([work(), interruption]);
      if (generation === this.generation && !controller.signal.aborted) this.publish({ state: result.status, result });
    } catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof AuthenticationError) this.publish({ state: 'error', error: 'auth' });
      else if (error instanceof ApiError && [409, 413, 415, 422].includes(error.status)) this.publish({ state: 'error', error: 'recorded' });
      else this.publish({ state: 'uncertain', error: 'service' });
    } finally {
      clearTimeout(timer);
      if (this.request === controller) { this.request = undefined; this.interrupt = undefined; }
    }
  }

  cancel() {
    ++this.generation;
    this.interrupt?.();
    this.request = undefined;
    this.interrupt = undefined;
    this.attempt = undefined;
    this.publish({ state: 'idle' });
  }

  dispose() { this.disposed = true; this.cancel(); }
}
