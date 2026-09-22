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

export async function runMigrations(db: { execAsync: (sql: string) => Promise<void> }): Promise<void> {
  await db.execAsync(CREATE_CACHED_LESSONS_TABLE);
  await db.execAsync(CREATE_CACHED_VOCABULARY_ITEMS_TABLE);
}
