import { apiClient } from '../api/client';
import { arrayField, ContractError, integerField, object, stateField, stringField, timestampField } from '../api/contracts';
import { adaptVocabularyItemFromApi, ApiVocabularyItem, PublishedVocabularyItem } from '../content/types';
import { ApiSchedulingResult, SchedulingResult } from './types';

export interface ApiCurrentSchedule extends ApiSchedulingResult { id: string; }
export interface CurrentSchedule extends SchedulingResult { id: string; }
export interface ApiReviewEligibility {
  lesson_id: string;
  content_release_id: string;
  evaluated_at: string;
  items: { vocabulary_item: ApiVocabularyItem; eligibility: 'new' | 'due'; current_schedule: ApiCurrentSchedule | null }[];
}
export interface EligibleReviewItem {
  vocabularyItem: PublishedVocabularyItem;
  eligibility: 'new' | 'due';
  currentSchedule: CurrentSchedule | null;
}
export interface ReviewEligibility {
  lessonId: string;
  contentReleaseId: string;
  evaluatedAt: string;
  items: EligibleReviewItem[];
}

export function adaptReviewEligibility(value: unknown): ReviewEligibility {
  const row = object(value);
  const lessonId = stringField(row, 'lesson_id');
  const contentReleaseId = stringField(row, 'content_release_id');
  const evaluatedAt = timestampField(row, 'evaluated_at');
  const items = arrayField(row, 'items').map((entry): EligibleReviewItem => {
    const item = object(entry);
    const vocabularyItem = adaptVocabularyItemFromApi(item.vocabulary_item);
    const eligibility = stringField(item, 'eligibility');
    if (eligibility !== 'new' && eligibility !== 'due') throw new ContractError('Unknown review eligibility.');
    let currentSchedule: CurrentSchedule | null = null;
    if (item.current_schedule !== null) {
      const schedule = object(item.current_schedule);
      currentSchedule = { id: stringField(schedule, 'id'), schedulerType: stringField(schedule, 'scheduler_type'),
        algorithmVersion: stringField(schedule, 'algorithm_version'), nextIntervalSeconds: integerField(schedule, 'next_interval_seconds'),
        nextDueAt: timestampField(schedule, 'next_due_at'), schedulerState: stateField(schedule, 'scheduler_state') };
    }
    if ((eligibility === 'new') !== (currentSchedule === null) || !vocabularyItem.isActive ||
        vocabularyItem.lessonId !== lessonId || vocabularyItem.contentReleaseId !== contentReleaseId) {
      throw new ContractError('Inconsistent eligible review context.');
    }
    return { vocabularyItem, eligibility, currentSchedule };
  });
  if (new Set(items.map((item) => item.vocabularyItem.id)).size !== items.length) throw new ContractError('Duplicate eligible item.');
  return { lessonId, contentReleaseId, evaluatedAt, items };
}

/** Fresh backend assessment only: no cached eligibility or device-clock fallback. */
export async function fetchReviewEligibility(lessonId: string, ownerUserId: string, contentReleaseId?: string): Promise<ReviewEligibility> {
  const releaseQuery = contentReleaseId ? `&content_release_id=${encodeURIComponent(contentReleaseId)}` : '';
  const raw = await apiClient<unknown>(`/reviews/eligible-items?lesson_id=${encodeURIComponent(lessonId)}${releaseQuery}`, { expectedUserId: ownerUserId });
  const result = adaptReviewEligibility(raw);
  if (result.lessonId !== lessonId || (contentReleaseId && result.contentReleaseId !== contentReleaseId)) throw new ContractError('Unexpected review lesson/release.');
  return result;
}
