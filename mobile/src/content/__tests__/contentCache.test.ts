import {
  initContentDatabase,
  cacheLessons,
  getCachedLessons,
  cacheLessonDetail,
  getCachedLessonDetail,
  resetCacheForTesting,
} from '../contentCache';
import { LessonDetail, LessonSummary } from '../types';

describe('ContentCache (Expo SQLite)', () => {
  beforeEach(async () => {
    await initContentDatabase();
    await resetCacheForTesting();
  });

  it('stores and retrieves cached lessons for target language', async () => {
    const lessons: LessonSummary[] = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        languageCode: 'en',
        title: 'Lesson 1',
        description: 'First lesson',
        contentVersion: 'sample-en-v0.1',
        sortOrder: 1,
        itemCount: 2,
        isActive: true,
      },
    ];

    await cacheLessons('en', lessons);
    const cached = await getCachedLessons('en');
    expect(cached).toHaveLength(1);
    expect(cached[0].title).toBe('Lesson 1');
    expect(cached[0].contentVersion).toBe('sample-en-v0.1');

    // Language isolation: querying 'fil' returns empty
    const cachedFil = await getCachedLessons('fil');
    expect(cachedFil).toHaveLength(0);
  });

  it('a newer server content version replaces the cached version', async () => {
    const v1: LessonSummary[] = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        languageCode: 'en',
        title: 'Lesson 1 (v0.1)',
        description: 'First version',
        contentVersion: 'sample-en-v0.1',
        sortOrder: 1,
        itemCount: 2,
        isActive: true,
      },
    ];
    await cacheLessons('en', v1);

    const v2: LessonSummary[] = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        languageCode: 'en',
        title: 'Lesson 1 (v0.2 Updated)',
        description: 'Newer version',
        contentVersion: 'sample-en-v0.2',
        sortOrder: 1,
        itemCount: 3,
        isActive: true,
      },
    ];
    await cacheLessons('en', v2);

    const cached = await getCachedLessons('en');
    expect(cached).toHaveLength(1);
    expect(cached[0].title).toBe('Lesson 1 (v0.2 Updated)');
    expect(cached[0].contentVersion).toBe('sample-en-v0.2');
  });

  it('an older server response never downgrades a newer cached version', async () => {
    const v2: LessonSummary[] = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        languageCode: 'en',
        title: 'Lesson 1 Newer',
        description: 'Newer',
        contentVersion: 'sample-en-v0.2',
        sortOrder: 1,
        itemCount: 3,
        isActive: true,
      },
    ];
    await cacheLessons('en', v2);

    // Stale v1 response attempts to overwrite v2
    const v1Stale: LessonSummary[] = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        languageCode: 'en',
        title: 'Lesson 1 Stale',
        description: 'Stale',
        contentVersion: 'sample-en-v0.1',
        sortOrder: 1,
        itemCount: 2,
        isActive: true,
      },
    ];
    await cacheLessons('en', v1Stale);

    const cached = await getCachedLessons('en');
    expect(cached[0].contentVersion).toBe('sample-en-v0.2');
    expect(cached[0].title).toBe('Lesson 1 Newer');
  });

  it('caches and retrieves detailed lesson with vocabulary items', async () => {
    const detail: LessonDetail = {
      id: '11111111-1111-1111-1111-111111111111',
      languageCode: 'en',
      title: 'Lesson 1',
      description: 'First lesson',
      contentVersion: 'sample-en-v0.1',
      sortOrder: 1,
      vocabularyItems: [
        {
          id: '22222222-2222-2222-2222-222222222221',
          lessonId: '11111111-1111-1111-1111-111111111111',
          term: 'hello',
          definition: 'greeting',
          exampleSentence: 'Hello world',
          difficulty: 'beginner',
          category: 'basics',
          translation: 'kumusta',
          contentVersion: 'sample-en-v0.1',
          sortOrder: 1,
          isActive: true,
        },
      ],
    };

    await cacheLessonDetail(detail);
    const retrieved = await getCachedLessonDetail('11111111-1111-1111-1111-111111111111');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.vocabularyItems).toHaveLength(1);
    expect(retrieved?.vocabularyItems[0].term).toBe('hello');
    expect(retrieved?.vocabularyItems[0].translation).toBe('kumusta');
  });
});
