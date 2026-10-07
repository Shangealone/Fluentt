import { DatabaseSync } from 'node:sqlite';
import * as storage from '../../offline/db';
import { runMigrations } from '../../offline/migrations';
import { apiClient } from '../../api/client';
import { fetchLessonDetail } from '../api';
import { adaptLessonDetailFromApi, ApiVocabularyItem } from '../types';
import { cacheLessonDetail, cacheLessons, getCachedLessonDetail, getCachedLessons } from '../contentCache';
import { detailWire, LESSON, RELEASE, REVISION } from '../../testUtils/contracts';

jest.mock('../../api/client', () => ({ ...jest.requireActual('../../api/client'), apiClient: jest.fn() }));

let sqlite: DatabaseSync;
beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:');
  const db: storage.DatabaseInterface = {
    execAsync: async (sql) => { sqlite.exec(sql); },
    runAsync: async (sql, ...params) => {
      const result = sqlite.prepare(sql).run(...params.flat());
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getAllAsync: async <T,>(sql: string, ...params: unknown[]) => sqlite.prepare(sql).all(...params.flat() as never[]) as T[],
    getFirstAsync: async <T,>(sql: string, ...params: unknown[]) => (sqlite.prepare(sql).get(...params.flat() as never[]) ?? null) as T | null,
  };
  await runMigrations(db);
  jest.spyOn(storage, 'getDatabase').mockResolvedValue(db);
  (apiClient as jest.Mock).mockReset();
});
afterEach(() => { jest.restoreAllMocks(); sqlite.close(); });

it('caches a pinned current detail after its summary so the same release remains available offline', async () => {
  const detail = adaptLessonDetailFromApi(detailWire());
  await cacheLessons('en', [{ ...detail, itemCount: 1 }]);
  expect(await getCachedLessonDetail(LESSON, RELEASE)).toBeNull();
  (apiClient as jest.Mock).mockResolvedValueOnce(detailWire());
  await fetchLessonDetail(LESSON, RELEASE);
  (apiClient as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  expect(await fetchLessonDetail(LESSON, RELEASE)).toMatchObject({ isOffline: true, lesson: detail });
});

it('requires published network provenance without defaulting missing fields', () => {
  for (const raw of [
    { ...detailWire(), content_release_id: null },
    { ...detailWire(), vocabulary_items: [{ ...detailWire().vocabulary_items[0], content_revision_id: null }] },
    { ...detailWire(), vocabulary_items: undefined },
    { ...detailWire(), vocabulary_items: [{ ...detailWire().vocabulary_items[0], content_release_id: REVISION }] },
  ]) expect(() => adaptLessonDetailFromApi(raw)).toThrow();
});

it('keeps legacy cache provenance null while rejecting it as current published network content', async () => {
  const legacy = { ...adaptLessonDetailFromApi(detailWire()), contentReleaseId: null,
    vocabularyItems: detailWire().vocabulary_items.map((item) => ({
      id: item.id, lessonId: LESSON, term: item.term, definition: item.definition, exampleSentence: item.example_sentence,
      difficulty: item.difficulty, contentVersion: 'lesson-label', sortOrder: 0, isActive: true,
      contentRevisionId: null, contentReleaseId: null,
    })) };
  await cacheLessonDetail(legacy);
  expect((await getCachedLessonDetail(LESSON))!.vocabularyItems[0]).toMatchObject({ contentRevisionId: null, contentReleaseId: null });
  expect(await getCachedLessonDetail(LESSON, RELEASE)).toBeNull();
});

it('refreshes from server context regardless of lexical or numeric version-label order', async () => {
  await cacheLessonDetail(adaptLessonDetailFromApi(detailWire('z-v999')));
  const next = { ...detailWire('a-v1'), content_release_id: REVISION,
    vocabulary_items: [{ ...detailWire().vocabulary_items[0], content_release_id: REVISION, content_version: 'a-v0' }] };
  await cacheLessonDetail(adaptLessonDetailFromApi(next));
  expect(await getCachedLessonDetail(LESSON)).toMatchObject({ contentVersion: 'a-v1', contentReleaseId: REVISION });
  expect((await getCachedLessonDetail(LESSON))!.vocabularyItems[0].contentVersion).toBe('a-v0');
  expect(await getCachedLessonDetail(LESSON, RELEASE)).toBeNull();
});

it('cannot satisfy an exact release request with another cached release', async () => {
  await cacheLessonDetail(adaptLessonDetailFromApi(detailWire()));
  (apiClient as jest.Mock).mockRejectedValue(new TypeError('offline'));
  await expect(fetchLessonDetail(LESSON, REVISION)).rejects.toThrow('offline');
  expect((apiClient as jest.Mock).mock.calls[0][0]).toContain(`content_release_id=${REVISION}`);
  const result = await fetchLessonDetail(LESSON, RELEASE);
  expect(result.isOffline).toBe(true);
  expect(result.lesson.contentReleaseId).toBe(RELEASE);
});

it('returns exact historical server content without replacing the current cache', async () => {
  const current = adaptLessonDetailFromApi(detailWire());
  await cacheLessonDetail(current);
  const historical = { ...detailWire('older-label'), content_release_id: REVISION,
    vocabulary_items: [{ ...detailWire().vocabulary_items[0], content_release_id: REVISION }] };
  (apiClient as jest.Mock).mockResolvedValue(historical);
  expect((await fetchLessonDetail(LESSON, REVISION)).lesson.contentReleaseId).toBe(REVISION);
  expect((await getCachedLessonDetail(LESSON))!.contentReleaseId).toBe(RELEASE);
  (apiClient as jest.Mock).mockResolvedValue(detailWire());
  await expect(fetchLessonDetail(LESSON, REVISION)).rejects.toThrow();
});

it('does not hide malformed network facts with cached content or mix summary/detail releases', async () => {
  const detail = adaptLessonDetailFromApi(detailWire());
  await cacheLessonDetail(detail);
  (apiClient as jest.Mock).mockResolvedValue({ ...detailWire(), content_release_id: null });
  await expect(fetchLessonDetail(LESSON)).rejects.toThrow();
  await cacheLessons('en', [{ ...detail, contentReleaseId: REVISION, itemCount: 1 }]);
  expect(await getCachedLessonDetail(LESSON)).toBeNull();
  await cacheLessons('en', []);
  expect(await getCachedLessons('en')).toHaveLength(0);
});

// A published wire type must require a non-null revision; runtime validation also checks it.
type RevisionRequired = undefined extends ApiVocabularyItem['content_revision_id'] ? false :
  null extends ApiVocabularyItem['content_revision_id'] ? false : true;
const requiresRevision: RevisionRequired = true;
void requiresRevision;
