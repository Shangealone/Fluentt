import { apiClient, AuthenticationError, ApiError } from '../api/client';
import {
  cacheLessonDetail,
  cacheLessons,
  getCachedLessonDetail,
  getCachedLessons,
} from './contentCache';
import {
  adaptLessonDetailFromApi,
  adaptLessonSummaryFromApi,
  ApiLessonDetail,
  ApiLessonSummary,
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
    const rawLessons = await apiClient<ApiLessonSummary[]>(
      `/content/lessons?language=${encodeURIComponent(languageCode)}`
    );
    const adapted = rawLessons.map(adaptLessonSummaryFromApi);
    await cacheLessons(languageCode, adapted);
    return {
      lessons: adapted,
      isOffline: false,
    };
  } catch (error: any) {
    // Under no circumstances should auth errors fall back to cached content
    if (error instanceof AuthenticationError || error?.status === 401 || error?.status === 403) {
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
export async function fetchLessonDetail(lessonId: string): Promise<LessonDetailFetchResult> {
  try {
    const rawDetail = await apiClient<ApiLessonDetail>(
      `/content/lessons/${encodeURIComponent(lessonId)}`
    );
    const adapted = adaptLessonDetailFromApi(rawDetail);
    await cacheLessonDetail(adapted);
    return {
      lesson: adapted,
      isOffline: false,
    };
  } catch (error: any) {
    // Under no circumstances should auth errors fall back to cached content
    if (error instanceof AuthenticationError || error?.status === 401 || error?.status === 403) {
      throw error;
    }

    // Attempt offline read from SQLite cache
    const cached = await getCachedLessonDetail(lessonId);
    if (cached) {
      return {
        lesson: cached,
        isOffline: true,
      };
    }

    throw error;
  }
}
