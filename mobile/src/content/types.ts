import { arrayField, booleanField, ContractError, integerField, nullableString, object, stringField } from '../api/contracts';

/** Legacy-compatible SQLite/domain representation; absent references mean legacy. */
export interface VocabularyItem {
  id: string;
  contentRevisionId?: string | null;
  contentReleaseId?: string | null;
  lessonId: string;
  term: string;
  definition: string;
  exampleSentence: string;
  difficulty: string;
  category?: string | null;
  translation?: string | null;
  contentVersion: string;
  sortOrder: number;
  isActive?: boolean;
}

export interface LessonSummary {
  id: string;
  contentReleaseId?: string | null;
  languageCode: string;
  title: string;
  description?: string | null;
  contentVersion: string;
  sortOrder: number;
  itemCount: number;
  isActive?: boolean;
}

export interface LessonDetail {
  id: string;
  contentReleaseId?: string | null;
  languageCode: string;
  title: string;
  description?: string | null;
  contentVersion: string;
  sortOrder: number;
  vocabularyItems: VocabularyItem[];
  isActive?: boolean;
}

export interface PublishedVocabularyItem extends VocabularyItem { contentRevisionId: string; contentReleaseId: string; isActive: boolean; }
export interface PublishedLessonSummary extends LessonSummary { contentReleaseId: string; isActive: boolean; }
export interface PublishedLessonDetail extends LessonDetail { contentReleaseId: string; isActive: boolean; vocabularyItems: PublishedVocabularyItem[]; }

// Published API snake_case contracts. Legacy null cache rows are not these types.
export interface ApiVocabularyItem {
  id: string;
  content_revision_id: string;
  content_release_id: string;
  lesson_id: string;
  term: string;
  definition: string;
  example_sentence: string;
  difficulty: string;
  category: string | null;
  translation: string | null;
  content_version: string;
  sort_order: number;
  is_active: boolean;
}

export interface ApiLessonSummary {
  id: string;
  content_release_id: string;
  language_code: string;
  title: string;
  description: string | null;
  content_version: string;
  sort_order: number;
  item_count: number;
  is_active: boolean;
}

export interface ApiLessonDetail {
  id: string;
  content_release_id: string;
  language_code: string;
  title: string;
  description: string | null;
  content_version: string;
  sort_order: number;
  vocabulary_items: ApiVocabularyItem[];
  is_active: boolean;
}

/**
 * Adapter functions converting snake_case API data to camelCase client models.
 */
export function adaptVocabularyItemFromApi(value: unknown): PublishedVocabularyItem {
  const api = object(value);
  return {
    id: stringField(api, 'id'), contentRevisionId: stringField(api, 'content_revision_id'), contentReleaseId: stringField(api, 'content_release_id'),
    lessonId: stringField(api, 'lesson_id'), term: stringField(api, 'term'), definition: stringField(api, 'definition'),
    exampleSentence: stringField(api, 'example_sentence'), difficulty: stringField(api, 'difficulty'),
    category: nullableString(api, 'category'), translation: nullableString(api, 'translation'),
    contentVersion: stringField(api, 'content_version'), sortOrder: integerField(api, 'sort_order', Number.MIN_SAFE_INTEGER), isActive: booleanField(api, 'is_active'),
  };
}

export function adaptLessonSummaryFromApi(value: unknown): PublishedLessonSummary {
  const api = object(value);
  return {
    ...adaptLessonContext(api), itemCount: integerField(api, 'item_count'),
  };
}

function adaptLessonContext(api: Record<string, unknown>) {
  return { id: stringField(api, 'id'), contentReleaseId: stringField(api, 'content_release_id'), languageCode: stringField(api, 'language_code'),
    title: stringField(api, 'title'), description: nullableString(api, 'description'), contentVersion: stringField(api, 'content_version'),
    sortOrder: integerField(api, 'sort_order', Number.MIN_SAFE_INTEGER), isActive: booleanField(api, 'is_active') };
}
export function adaptLessonDetailFromApi(value: unknown): PublishedLessonDetail {
  const api = object(value);
  const context = adaptLessonContext(api);
  const vocabularyItems = arrayField(api, 'vocabulary_items').map(adaptVocabularyItemFromApi);
  if (vocabularyItems.some((item) => item.lessonId !== context.id || item.contentReleaseId !== context.contentReleaseId)) {
    throw new ContractError('Vocabulary does not belong to the returned lesson/release.');
  }
  return {
    ...context, vocabularyItems,
  };
}
