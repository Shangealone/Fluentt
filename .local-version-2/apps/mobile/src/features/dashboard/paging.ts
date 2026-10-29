export type ListState<T> = {
  phase: "loading" | "ready" | "error";
  rows: T[];
  error: string | null;
  hasMore: boolean;
};

// Shared by instructor and student reads. Late results never publish after blur/logout.
export class PagedList<T extends { id: string }> {
  private state: ListState<T> = { phase: "loading", rows: [], error: null, hasMore: false };
  private listeners = new Set<() => void>();
  private revision = 0;
  private busy = false;
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(state: ListState<T>) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  cancel() {
    this.revision += 1;
    this.busy = false;
    this.publish({ phase: "loading", rows: [], error: null, hasMore: false });
  }
  async load(fetchPage: (offset: number) => Promise<T[]>, offset = 0) {
    if (this.busy) return;
    this.busy = true;
    const revision = ++this.revision;
    const previous = offset === 0 ? [] : this.state.rows;
    this.publish({ phase: "loading", rows: previous, error: null, hasMore: false });
    try {
      const rows = await fetchPage(offset);
      if (revision !== this.revision) return;
      const ids = new Set(previous.map((row) => row.id));
      const merged = [...previous];
      for (const row of rows) if (!ids.has(row.id)) { ids.add(row.id); merged.push(row); }
      this.publish({ phase: "ready", rows: merged, error: null, hasMore: rows.length === 50 });
    } catch (error) {
      if (revision === this.revision) this.publish({ phase: "error", rows: [], hasMore: false,
        error: error instanceof Error ? error.message : "Unable to load your classes. Please retry." });
    } finally { if (revision === this.revision) this.busy = false; }
  }
}

export function selectedClass<T extends { id: string }>(state: ListState<T>, id: string | null): T | null {
  if (state.phase !== "ready") return null;
  return state.rows.find((row) => row.id === id) ?? state.rows[0] ?? null;
}
