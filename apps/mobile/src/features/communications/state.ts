/** One in-memory pending send per fixed class/recipient compose host. */
export class MessageSubmission {
  pending: { content: string; key: string } | null = null;
  busy = false;
  discard() { if (this.busy) return; this.pending = null; }
  async send<T>(content: string, issue: (content: string, key: string) => Promise<T>, randomKey: () => string): Promise<T> {
    if (this.busy) throw new Error("A send is already in progress.");
    this.pending ??= { content, key: randomKey() };
    this.busy = true;
    try {
      const result = await issue(this.pending.content, this.pending.key);
      this.pending = null;
      return result;
    } catch (cause) {
      // Known rejected input was not sent; ambiguous/conflict outcomes retain their original request.
      if ([403, 404, 422, 429].includes((cause as { status?: number }).status ?? 0)) this.pending = null;
      throw cause;
    } finally { this.busy = false; }
  }
}
