import { getDatabase, resetDatabaseForTesting } from '../offline/db';
import { runMigrations } from '../offline/migrations';
import { LessonDetail, LessonSummary, VocabularyItem } from './types';

export async function initContentDatabase(): Promise<void> {
  const db = await getDatabase();
  await runMigrations(db);
}

export async function resetCacheForTesting(): Promise<void> {
  await resetDatabaseForTesting();
}

/**
 * Cache an array of lesson summaries for a given language.
 * A current server response replaces the language feed. Labels are facts, not ordering.
 */
export async function cacheLessons(languageCode: string, lessons: LessonSummary[]): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync('UPDATE cached_lessons SET is_active = 0 WHERE language_code = ?', [languageCode]);

  for (const lesson of lessons) {
    await db.runAsync(
      `INSERT INTO cached_lessons (
        id, language_code, title, description, content_version, sort_order, item_count, is_active, updated_at, content_release_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        language_code = excluded.language_code, title = excluded.title, description = excluded.description,
        content_version = excluded.content_version, sort_order = excluded.sort_order, item_count = excluded.item_count,
        is_active = excluded.is_active, updated_at = excluded.updated_at, content_release_id = excluded.content_release_id`,
      [
        lesson.id,
        languageCode,
        lesson.title,
        lesson.description ?? null,
        lesson.contentVersion,
        lesson.sortOrder,
        lesson.itemCount,
        lesson.isActive !== false ? 1 : 0,
        now,
        lesson.contentReleaseId ?? null,
      ]
    );
  }
}

/**
 * Retrieve cached lessons for a target language.
 */
export async function getCachedLessons(languageCode: string): Promise<LessonSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    language_code: string;
    title: string;
    description: string | null;
    content_version: string;
    sort_order: number;
    item_count: number;
    is_active: number;
    content_release_id: string | null;
  }>(
    'SELECT * FROM cached_lessons WHERE language_code = ? AND is_active = 1 ORDER BY sort_order ASC',
    [languageCode]
  );

  return rows.map((row) => ({
    id: row.id,
    contentReleaseId: row.content_release_id ?? null,
    languageCode: row.language_code,
    title: row.title,
    description: row.description,
    contentVersion: row.content_version,
    sortOrder: row.sort_order,
    itemCount: row.item_count,
    isActive: row.is_active === 1,
  }));
}

/**
 * Cache lesson detail along with its vocabulary items.
 */
export async function cacheLessonDetail(detail: LessonDetail, onlyIfCurrentReleaseId?: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  if (onlyIfCurrentReleaseId) {
    // A pinned read may fill the current summary, but cannot establish or replace its release.
    const result = await db.runAsync(
      `UPDATE cached_lessons SET language_code = ?, title = ?, description = ?, content_version = ?,
        sort_order = ?, item_count = ?, updated_at = ?
       WHERE id = ? AND content_release_id = ? AND is_active = 1`,
      [detail.languageCode, detail.title, detail.description ?? null, detail.contentVersion,
        detail.sortOrder, detail.vocabularyItems.length, now, detail.id, onlyIfCurrentReleaseId]
    );
    if (result.changes === 0) return;
  } else {
    await db.runAsync(
      `INSERT INTO cached_lessons (
        id, language_code, title, description, content_version, sort_order, item_count, is_active, updated_at, content_release_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        language_code = excluded.language_code, title = excluded.title, description = excluded.description,
        content_version = excluded.content_version, sort_order = excluded.sort_order, item_count = excluded.item_count,
        is_active = excluded.is_active, updated_at = excluded.updated_at, content_release_id = excluded.content_release_id`,
      [
        detail.id,
        detail.languageCode,
        detail.title,
        detail.description ?? null,
        detail.contentVersion,
        detail.sortOrder,
        detail.vocabularyItems.length,
        detail.isActive !== false ? 1 : 0,
        now,
        detail.contentReleaseId ?? null,
      ]
    );
  }
  for (const item of detail.vocabularyItems) {
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_vocabulary_items (
        id, lesson_id, term, definition, example_sentence, difficulty, category, translation, content_version, sort_order, is_active, updated_at, content_revision_id, content_release_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        detail.id,
        item.term,
        item.definition,
        item.exampleSentence,
        item.difficulty,
        item.category ?? null,
        item.translation ?? null,
        item.contentVersion,
        item.sortOrder,
        item.isActive !== false ? 1 : 0,
        now,
        item.contentRevisionId ?? null,
        item.contentReleaseId ?? null,
      ]
    );
  }
}

/**
 * Retrieve cached lesson detail including vocabulary items.
 */
export async function getCachedLessonDetail(lessonId: string, contentReleaseId?: string): Promise<LessonDetail | null> {
  const db = await getDatabase();
  const lessonRow = await db.getFirstAsync<{
    id: string;
    language_code: string;
    title: string;
    description: string | null;
    content_version: string;
    sort_order: number;
    is_active: number;
    content_release_id: string | null;
    item_count: number;
  }>('SELECT * FROM cached_lessons WHERE id = ? AND is_active = 1', [lessonId]);

  if (!lessonRow || (contentReleaseId && lessonRow.content_release_id !== contentReleaseId)) {
    return null;
  }

  const vocabRows = await db.getAllAsync<{
    id: string;
    lesson_id: string;
    term: string;
    definition: string;
    example_sentence: string;
    difficulty: string;
    category: string | null;
    translation: string | null;
    content_version: string;
    sort_order: number;
    is_active: number;
    content_revision_id: string | null;
    content_release_id: string | null;
  }>('SELECT * FROM cached_vocabulary_items WHERE lesson_id = ? AND is_active = 1 ORDER BY sort_order ASC', [
    lessonId,
  ]);

  const vocabularyItems: VocabularyItem[] = vocabRows.filter((v) =>
    (v.content_release_id ?? null) === (lessonRow.content_release_id ?? null) &&
    (lessonRow.content_release_id != null || v.content_version === lessonRow.content_version)
  ).map((v) => ({
    id: v.id,
    contentRevisionId: v.content_revision_id ?? null,
    contentReleaseId: v.content_release_id ?? null,
    lessonId: v.lesson_id,
    term: v.term,
    definition: v.definition,
    exampleSentence: v.example_sentence,
    difficulty: v.difficulty,
    category: v.category,
    translation: v.translation,
    contentVersion: v.content_version,
    sortOrder: v.sort_order,
    isActive: v.is_active === 1,
  }));

  // A summary from a new release is not a complete cached detail until all its members arrive.
  if (lessonRow.content_release_id && vocabularyItems.length !== lessonRow.item_count) return null;

  return {
    id: lessonRow.id,
    contentReleaseId: lessonRow.content_release_id ?? null,
    languageCode: lessonRow.language_code,
    title: lessonRow.title,
    description: lessonRow.description,
    contentVersion: lessonRow.content_version,
    sortOrder: lessonRow.sort_order,
    vocabularyItems,
    isActive: lessonRow.is_active === 1,
  };
}
