import { runMigrations } from './migrations';

export interface DatabaseInterface {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null>;
  closeAsync?(): Promise<void>;
}

// In-memory fallback mock for testing / non-native environments
class InMemoryDatabase implements DatabaseInterface {
  private lessons = new Map<string, any>();
  private vocabItems = new Map<string, any>();

  async execAsync(sql: string): Promise<void> {
    if (sql.includes('DELETE FROM cached_lessons') || sql.includes('DELETE FROM cached_vocabulary_items')) {
      this.lessons.clear();
      this.vocabItems.clear();
    }
  }

  async runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }> {
    const flatParams = params.flat();
    const upper = sql.toUpperCase();

    if (upper.includes('INSERT OR REPLACE INTO CACHED_LESSONS') || upper.includes('INSERT INTO CACHED_LESSONS')) {
      const [id, language_code, title, description, content_version, sort_order, item_count, is_active, updated_at] = flatParams;
      this.lessons.set(id, {
        id,
        language_code,
        title,
        description,
        content_version,
        sort_order,
        item_count,
        is_active,
        updated_at,
      });
      return { lastInsertRowId: 1, changes: 1 };
    }

    if (upper.includes('INSERT OR REPLACE INTO CACHED_VOCABULARY_ITEMS') || upper.includes('INSERT INTO CACHED_VOCABULARY_ITEMS')) {
      const [id, lesson_id, term, definition, example_sentence, difficulty, category, translation, content_version, sort_order, is_active, updated_at] = flatParams;
      this.vocabItems.set(id, {
        id,
        lesson_id,
        term,
        definition,
        example_sentence,
        difficulty,
        category,
        translation,
        content_version,
        sort_order,
        is_active,
        updated_at,
      });
      return { lastInsertRowId: 1, changes: 1 };
    }

    if (upper.includes('DELETE FROM CACHED_VOCABULARY_ITEMS WHERE LESSON_ID')) {
      const lessonId = flatParams[0];
      let changes = 0;
      for (const [id, item] of this.vocabItems.entries()) {
        if (item.lesson_id === lessonId) {
          this.vocabItems.delete(id);
          changes++;
        }
      }
      return { lastInsertRowId: 0, changes };
    }

    if (upper.includes('DELETE FROM CACHED_LESSONS')) {
      const changes = this.lessons.size;
      this.lessons.clear();
      return { lastInsertRowId: 0, changes };
    }

    return { lastInsertRowId: 0, changes: 0 };
  }

  async getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]> {
    const flatParams = params.flat();
    const upper = sql.toUpperCase();

    if (upper.includes('FROM CACHED_LESSONS')) {
      const lang = flatParams[0];
      const results: any[] = [];
      for (const lesson of this.lessons.values()) {
        if (lesson.language_code === lang && (lesson.is_active === 1 || lesson.is_active === true)) {
          results.push({ ...lesson });
        }
      }
      results.sort((a, b) => a.sort_order - b.sort_order);
      return results as T[];
    }

    if (upper.includes('FROM CACHED_VOCABULARY_ITEMS')) {
      const lessonId = flatParams[0];
      const results: any[] = [];
      for (const item of this.vocabItems.values()) {
        if (item.lesson_id === lessonId && (item.is_active === 1 || item.is_active === true)) {
          results.push({ ...item });
        }
      }
      results.sort((a, b) => a.sort_order - b.sort_order);
      return results as T[];
    }

    return [];
  }

  async getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null> {
    const flatParams = params.flat();
    const upper = sql.toUpperCase();

    if (upper.includes('FROM CACHED_LESSONS WHERE ID = ?')) {
      const id = flatParams[0];
      const lesson = this.lessons.get(id);
      if (!lesson) return null;
      if (upper.includes('IS_ACTIVE = 1') && !(lesson.is_active === 1 || lesson.is_active === true)) {
        return null;
      }
      return { ...lesson } as T;
    }

    if (upper.includes('FROM CACHED_VOCABULARY_ITEMS WHERE ID = ?')) {
      const id = flatParams[0];
      const item = this.vocabItems.get(id);
      if (!item) return null;
      return { ...item } as T;
    }

    return null;
  }

  clear() {
    this.lessons.clear();
    this.vocabItems.clear();
  }
}

let dbPromise: Promise<DatabaseInterface> | null = null;
let inMemoryInstance: InMemoryDatabase | null = null;

export async function getDatabase(): Promise<DatabaseInterface> {
  if (process.env.NODE_ENV === 'test') {
    if (!inMemoryInstance) {
      inMemoryInstance = new InMemoryDatabase();
    }
    return inMemoryInstance;
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const SQLite = await import('expo-sqlite');
        const db = await SQLite.openDatabaseAsync('fluentt.db');
        await runMigrations(db);
        return db;
      } catch (err) {
        console.warn('Native SQLite unavailable, falling back to in-memory store:', err);
        if (!inMemoryInstance) {
          inMemoryInstance = new InMemoryDatabase();
        }
        return inMemoryInstance;
      }
    })();
  }
  return dbPromise;
}

export async function resetDatabaseForTesting(): Promise<void> {
  if (inMemoryInstance) {
    inMemoryInstance.clear();
  } else {
    const db = await getDatabase();
    await db.execAsync('DELETE FROM cached_vocabulary_items;');
    await db.execAsync('DELETE FROM cached_lessons;');
  }
}
