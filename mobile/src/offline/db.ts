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
  private pendingReviews = new Map<string, any>();

  async execAsync(sql: string): Promise<void> {
    if (sql.includes('DELETE FROM cached_lessons') || sql.includes('DELETE FROM cached_vocabulary_items')) {
      this.lessons.clear();
      this.vocabItems.clear();
    }
    if (sql.includes('DELETE FROM pending_review_events')) {
      this.pendingReviews.clear();
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

    if (upper.includes('INSERT OR REPLACE INTO PENDING_REVIEW_EVENTS') || upper.includes('INSERT OR IGNORE INTO PENDING_REVIEW_EVENTS') || upper.includes('INSERT INTO PENDING_REVIEW_EVENTS')) {
      const [client_event_id, payload_json, status, attempt_count, last_error, created_at, updated_at, owner_user_id] = flatParams;
      if (upper.includes('INSERT OR IGNORE') && this.pendingReviews.has(client_event_id)) {
        return { lastInsertRowId: 0, changes: 0 };
      }
      const existing = this.pendingReviews.get(client_event_id);
      this.pendingReviews.set(client_event_id, {
        client_event_id,
        owner_user_id: owner_user_id ?? null,
        payload_json,
        status: status ?? 'pending',
        attempt_count: attempt_count !== undefined ? attempt_count : (existing?.attempt_count ?? 0),
        last_error: last_error !== undefined ? last_error : (existing?.last_error ?? null),
        created_at: existing ? existing.created_at : (created_at ?? new Date().toISOString()),
        updated_at: updated_at ?? new Date().toISOString(),
      });
      return { lastInsertRowId: 1, changes: 1 };
    }

    if (upper.includes('UPDATE PENDING_REVIEW_EVENTS')) {
      if (upper.includes('SET STATUS = ?') && upper.includes('ATTEMPT_COUNT = ATTEMPT_COUNT + 1')) {
        const [status, last_error, updated_at, client_event_id] = flatParams;
        const item = this.pendingReviews.get(client_event_id);
        if (item && (!upper.includes('AND OWNER_USER_ID = ?') || item.owner_user_id === flatParams[4])) {
          item.status = status;
          item.attempt_count = (item.attempt_count || 0) + 1;
          item.last_error = last_error;
          item.updated_at = updated_at;
          return { lastInsertRowId: 0, changes: 1 };
        }
      } else if (upper.includes('SET STATUS = ?') && upper.includes('LAST_ERROR = ?')) {
        const [status, last_error, updated_at, client_event_id] = flatParams;
        const item = this.pendingReviews.get(client_event_id);
        if (item && (!upper.includes('AND OWNER_USER_ID = ?') || item.owner_user_id === flatParams[4])) {
          item.status = status;
          item.last_error = last_error;
          item.updated_at = updated_at;
          return { lastInsertRowId: 0, changes: 1 };
        }
      } else if (upper.includes('SET STATUS = ?')) {
        const [status, updated_at, client_event_id] = flatParams;
        const item = this.pendingReviews.get(client_event_id);
        if (item) {
          item.status = status;
          item.updated_at = updated_at;
          return { lastInsertRowId: 0, changes: 1 };
        }
      }
      return { lastInsertRowId: 0, changes: 0 };
    }

    if (upper.includes('DELETE FROM PENDING_REVIEW_EVENTS WHERE CLIENT_EVENT_ID = ?')) {
      const client_event_id = flatParams[0];
      if (upper.includes('AND OWNER_USER_ID = ?') && this.pendingReviews.get(client_event_id)?.owner_user_id !== flatParams[1]) {
        return { lastInsertRowId: 0, changes: 0 };
      }
      const deleted = this.pendingReviews.delete(client_event_id);
      return { lastInsertRowId: 0, changes: deleted ? 1 : 0 };
    }

    if (upper.includes('DELETE FROM PENDING_REVIEW_EVENTS')) {
      const changes = this.pendingReviews.size;
      this.pendingReviews.clear();
      return { lastInsertRowId: 0, changes };
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

    if (upper.includes('FROM PENDING_REVIEW_EVENTS')) {
      let results: any[] = Array.from(this.pendingReviews.values());
      if (upper.includes('WHERE OWNER_USER_ID = ?')) {
        results = results.filter((r) => r.owner_user_id === flatParams[0]);
        if (upper.includes('AND STATUS = ?')) results = results.filter((r) => r.status === flatParams[1]);
      } else if (upper.includes('WHERE STATUS = ?')) {
        const targetStatus = flatParams[0];
        results = results.filter((r) => r.status === targetStatus);
      }
      results.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return results as T[];
    }

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

    if (upper.includes('COUNT(*)') && upper.includes('FROM PENDING_REVIEW_EVENTS')) {
      let count = this.pendingReviews.size;
      if (upper.includes('WHERE OWNER_USER_ID = ?')) {
        count = Array.from(this.pendingReviews.values()).filter((r) =>
          r.owner_user_id === flatParams[0] && ['pending', 'syncing', 'failed'].includes(r.status)
        ).length;
      } else if (upper.includes('WHERE STATUS = ?')) {
        const targetStatus = flatParams[0];
        count = Array.from(this.pendingReviews.values()).filter((r) => r.status === targetStatus).length;
      } else if (upper.includes("WHERE STATUS = 'PENDING'")) {
        count = Array.from(this.pendingReviews.values()).filter((r) => r.status === 'pending').length;
      } else if (upper.includes('WHERE STATUS IN')) {
        count = Array.from(this.pendingReviews.values()).filter((r) =>
          ['pending', 'syncing', 'failed'].includes(r.status)
        ).length;
      }
      return { count } as T;
    }

    if (upper.includes('FROM PENDING_REVIEW_EVENTS WHERE CLIENT_EVENT_ID = ?')) {
      const id = flatParams[0];
      const item = this.pendingReviews.get(id);
      return item ? ({ ...item } as T) : null;
    }

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
    this.pendingReviews.clear();
  }
}

let dbPromise: Promise<DatabaseInterface> | null = null;
let inMemoryInstance: InMemoryDatabase | null = null;

let SQLiteModule: typeof import('expo-sqlite') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SQLiteModule = require('expo-sqlite');
} catch {
  // Native SQLite module not available in test/Node environments
}

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
        if (SQLiteModule && typeof SQLiteModule.openDatabaseAsync === 'function') {
          const db = await SQLiteModule.openDatabaseAsync('fluentt.db');
          await runMigrations(db);
          return db;
        }
        throw new Error('Native SQLiteModule unavailable');
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

export async function closeDatabaseForTesting(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      if (db.closeAsync) {
        await db.closeAsync();
      }
    } catch {
      // Ignore
    }
    dbPromise = null;
  }
  // In test environments, clear singleton pointer so getDatabase recreates or re-evaluates
  // but note that resetDatabaseForTesting() is what clears table contents.
}

export async function resetDatabaseForTesting(): Promise<void> {
  if (inMemoryInstance) {
    inMemoryInstance.clear();
  } else {
    const db = await getDatabase();
    await db.execAsync('DELETE FROM pending_review_events;');
    await db.execAsync('DELETE FROM cached_vocabulary_items;');
    await db.execAsync('DELETE FROM cached_lessons;');
  }
}
