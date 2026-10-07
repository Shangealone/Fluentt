import { apiClient, AuthenticationError } from '../api/client';
import { ContractError } from '../api/contracts';
import {
  cacheLessonDetail,
  cacheLessons,
  getCachedLessonDetail,
  getCachedLessons,
} from './contentCache';
import {
  adaptLessonDetailFromApi,
  adaptLessonSummaryFromApi,
  LessonDetail,
  LessonSummary,
} from './types';

export interface LessonsFetchResult {
  lessons: LessonSummary[];
  isOffline: boolean;
}

export interface LessonDetailFetchResult {
  lesson: LessonDetail;
  isOffline: boolean;
}

/**
 * Fetch lessons for the target learning language.
 * Falls back to SQLite cached lessons on network/server failure.
 * Never falls back to cache on 401/403 authentication failures.
 */
export async function fetchLessons(languageCode: string): Promise<LessonsFetchResult> {
  try {
    const rawLessons = await apiClient<unknown>(
      `/content/lessons?language=${encodeURIComponent(languageCode)}`
    );
    if (!Array.isArray(rawLessons)) throw new ContractError('Expected a lesson list.');
    const adapted = rawLessons.map(adaptLessonSummaryFromApi);
    if (adapted.some((lesson) => lesson.languageCode !== languageCode || !lesson.isActive) || new Set(adapted.map((lesson) => lesson.contentReleaseId)).size > 1) {
      throw new ContractError('Inconsistent current lesson feed.');
    }
    await cacheLessons(languageCode, adapted);
    return {
      lessons: adapted,
      isOffline: false,
    };
  } catch (error: unknown) {
    // Under no circumstances should auth errors fall back to cached content
    if (!canUseCache(error)) {
      throw error;
    }

    // Attempt offline read from SQLite cache
    const cached = await getCachedLessons(languageCode);
    if (cached && cached.length > 0) {
      return {
        lessons: cached,
        isOffline: true,
      };
    }

    // If cache is also empty or unavailable, rethrow original error
    throw error;
  }
}

/**
 * Fetch detailed lesson with vocabulary items.
 * Falls back to SQLite cached lesson on network/server failure.
 * Never falls back to cache on 401/403 authentication failures.
 */
export async function fetchLessonDetail(lessonId: string, contentReleaseId?: string): Promise<LessonDetailFetchResult> {
  try {
    const query = contentReleaseId ? `?content_release_id=${encodeURIComponent(contentReleaseId)}` : '';
    const rawDetail = await apiClient<unknown>(
      `/content/lessons/${encodeURIComponent(lessonId)}${query}`
    );
    const adapted = adaptLessonDetailFromApi(rawDetail);
    if (adapted.id !== lessonId || !adapted.isActive || (contentReleaseId && adapted.contentReleaseId !== contentReleaseId)) {
      throw new ContractError('Server returned a different lesson/release.');
    }
    // Pinned current reads fill the cache; historical reads cannot replace its release.
    await cacheLessonDetail(adapted, contentReleaseId);
    return {
      lesson: adapted,
      isOffline: false,
    };
  } catch (error: unknown) {
    // Under no circumstances should auth errors fall back to cached content
    if (!canUseCache(error)) {
      throw error;
    }

    // Attempt offline read from SQLite cache
    const cached = await getCachedLessonDetail(lessonId, contentReleaseId);
    if (cached) {
      return {
        lesson: cached,
        isOffline: true,
      };
    }

    throw error;
  }
}

function canUseCache(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return !(error instanceof ContractError || error instanceof AuthenticationError || (status && status >= 400 && status < 500));
}
