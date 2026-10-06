import { DatabaseSync } from 'node:sqlite';
import { runMigrations, CREATE_PENDING_REVIEW_EVENTS_TABLE } from '../migrations';

it('migrates legacy SQLite without assigning or deleting rows, and can run again', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => { sqlite.exec(sql); },
    getAllAsync: async <T,>(sql: string) => sqlite.prepare(sql).all() as T[],
  };
  try {
    // The deployed schema has no owner column.
    sqlite.exec(CREATE_PENDING_REVIEW_EVENTS_TABLE);
    sqlite.prepare(`INSERT INTO pending_review_events
      (client_event_id, payload_json, status, created_at, updated_at)
      VALUES ('legacy-event', '{}', 'pending', '2026-10-06', '2026-10-06')`).run();
    await runMigrations(db);
    const columns = sqlite.prepare('PRAGMA table_info(pending_review_events)').all();
    expect(columns.map((column) => column.name)).toContain('owner_user_id');
    expect(columns.map((column) => column.name)).toEqual(expect.arrayContaining(['failure_kind', 'next_retry_at', 'lease_id']));
    expect(sqlite.prepare('SELECT * FROM pending_review_events').all()).toEqual([
      expect.objectContaining({ client_event_id: 'legacy-event', owner_user_id: null, attempt_count: 0,
        failure_kind: null, next_retry_at: null, lease_id: null }),
    ]);
    await runMigrations({ ...db });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM pending_review_events').get()?.count).toBe(1);
  } finally {
    sqlite.close();
  }
});
