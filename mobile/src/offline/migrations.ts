export const CREATE_CACHED_LESSONS_TABLE = `
CREATE TABLE IF NOT EXISTS cached_lessons (
  id TEXT PRIMARY KEY,
  language_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_version TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cached_lessons_lang ON cached_lessons (language_code);
`;

export const CREATE_CACHED_VOCABULARY_ITEMS_TABLE = `
CREATE TABLE IF NOT EXISTS cached_vocabulary_items (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  example_sentence TEXT,
  difficulty TEXT,
  category TEXT,
  translation TEXT,
  content_version TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (lesson_id) REFERENCES cached_lessons (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cached_vocab_lesson ON cached_vocabulary_items (lesson_id);
`;

export const CREATE_PENDING_REVIEW_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS pending_review_events (
  client_event_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'syncing', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pending_reviews_status ON pending_review_events (status);
`;

interface MigrationDatabase {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T>(sql: string): Promise<T[]>;
}

const migrations = new WeakMap<MigrationDatabase, Promise<void>>();

export async function runMigrations(db: MigrationDatabase): Promise<void> {
  let migration = migrations.get(db);
  if (!migration) {
    migration = migrate(db).catch((error) => {
      migrations.delete(db);
      throw error;
    });
    migrations.set(db, migration);
  }
  await migration;
}

async function migrate(db: MigrationDatabase): Promise<void> {
  await db.execAsync(CREATE_CACHED_LESSONS_TABLE);
  await db.execAsync(CREATE_CACHED_VOCABULARY_ITEMS_TABLE);
  await db.execAsync(CREATE_PENDING_REVIEW_EVENTS_TABLE);
  const lessonColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(cached_lessons)');
  if (!lessonColumns.some((column) => column.name === 'content_release_id')) {
    await db.execAsync('ALTER TABLE cached_lessons ADD COLUMN content_release_id TEXT;');
  }
  const vocabularyColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(cached_vocabulary_items)');
  for (const name of ['content_revision_id', 'content_release_id']) {
    if (!vocabularyColumns.some((column) => column.name === name)) {
      // NULL distinguishes old caches; never infer a revision from a logical ID.
      await db.execAsync(`ALTER TABLE cached_vocabulary_items ADD COLUMN ${name} TEXT;`);
    }
  }
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(pending_review_events)');
  if (!columns.some((column) => column.name === 'owner_user_id')) {
    // NULL is deliberately retained for deployed ownerless rows. Never backfill
    // from the current login: there is no reliable evidence of their creator.
    await db.execAsync('ALTER TABLE pending_review_events ADD COLUMN owner_user_id TEXT;');
  }
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_pending_reviews_owner_status ON pending_review_events (owner_user_id, status);');
  // Operational synchronization fields only; payload_json is never rewritten.
  for (const [name, type] of [['failure_kind', 'TEXT'], ['next_retry_at', 'INTEGER'], ['lease_id', 'TEXT']]) {
    if (!columns.some((column) => column.name === name)) {
      await db.execAsync(`ALTER TABLE pending_review_events ADD COLUMN ${name} ${type};`);
    }
  }
}

