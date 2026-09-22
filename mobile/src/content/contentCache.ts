import { getDatabase, resetDatabaseForTesting } from '../offline/db';
import { runMigrations } from '../offline/migrations';
import { LessonDetail, LessonSummary, VocabularyItem } from './types';

/**
 * Compares two content versions.
 * Returns > 0 if vA is newer than vB, < 0 if vA is older than vB, and 0 if equal.
 */
export function compareContentVersions(vA: string, vB: string): number {
  if (vA === vB) return 0;

  const extractNumbers = (v: string): number[] => {
    const matches = v.match(/\d+/g);
    return matches ? matches.map(Number) : [];
  };

  const numsA = extractNumbers(vA);
  const numsB = extractNumbers(vB);

  const maxLen = Math.max(numsA.length, numsB.length);
  for (let i = 0; i < maxLen; i++) {
    const numA = numsA[i] ?? 0;
    const numB = numsB[i] ?? 0;
    if (numA !== numB) {
      return numA - numB;
    }
  }

  return vA.localeCompare(vB);
}

export async function initContentDatabase(): Promise<void> {
  const db = await getDatabase();
  await runMigrations(db);
}

export async function resetCacheForTesting(): Promise<void> {
  await resetDatabaseForTesting();
}

/**
 * Cache an array of lesson summaries for a given language.
 * Rule: Newer server version replaces older cached version. Older server response never downgrades newer cache.
 */
export async function cacheLessons(languageCode: string, lessons: LessonSummary[]): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  for (const lesson of lessons) {
    const existing = await db.getFirstAsync<{ id: string; content_version: string }>(
      'SELECT id, content_version FROM cached_lessons WHERE id = ?',
      [lesson.id]
    );

    if (existing && existing.content_version) {
      if (compareContentVersions(lesson.contentVersion, existing.content_version) < 0) {
        // Stale server response; do not downgrade newer cache
        continue;
      }
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO cached_lessons (
        id, language_code, title, description, content_version, sort_order, item_count, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  }>(
    'SELECT * FROM cached_lessons WHERE language_code = ? AND is_active = 1 ORDER BY sort_order ASC',
    [languageCode]
  );

  return rows.map((row) => ({
    id: row.id,
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
export async function cacheLessonDetail(detail: LessonDetail): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const existingLesson = await db.getFirstAsync<{ id: string; content_version: string }>(
    'SELECT id, content_version FROM cached_lessons WHERE id = ?',
    [detail.id]
  );

  const shouldUpdateLesson =
    !existingLesson ||
    !existingLesson.content_version ||
    compareContentVersions(detail.contentVersion, existingLesson.content_version) >= 0;

  if (shouldUpdateLesson) {
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_lessons (
        id, language_code, title, description, content_version, sort_order, item_count, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    );
  }

  for (const item of detail.vocabularyItems) {
    const existingItem = await db.getFirstAsync<{ id: string; content_version: string }>(
      'SELECT id, content_version FROM cached_vocabulary_items WHERE id = ?',
      [item.id]
    );

    if (existingItem && existingItem.content_version) {
      if (compareContentVersions(item.contentVersion, existingItem.content_version) < 0) {
        continue;
      }
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO cached_vocabulary_items (
        id, lesson_id, term, definition, example_sentence, difficulty, category, translation, content_version, sort_order, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    );
  }
}

/**
 * Retrieve cached lesson detail including vocabulary items.
 */
export async function getCachedLessonDetail(lessonId: string): Promise<LessonDetail | null> {
  const db = await getDatabase();
  const lessonRow = await db.getFirstAsync<{
    id: string;
    language_code: string;
    title: string;
    description: string | null;
    content_version: string;
    sort_order: number;
    is_active: number;
  }>('SELECT * FROM cached_lessons WHERE id = ? AND is_active = 1', [lessonId]);

  if (!lessonRow) {
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
  }>('SELECT * FROM cached_vocabulary_items WHERE lesson_id = ? AND is_active = 1 ORDER BY sort_order ASC', [
    lessonId,
  ]);

  const vocabularyItems: VocabularyItem[] = vocabRows.map((v) => ({
    id: v.id,
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

  return {
    id: lessonRow.id,
    languageCode: lessonRow.language_code,
    title: lessonRow.title,
    description: lessonRow.description,
    contentVersion: lessonRow.content_version,
    sortOrder: lessonRow.sort_order,
    vocabularyItems,
    isActive: lessonRow.is_active === 1,
  };
}
