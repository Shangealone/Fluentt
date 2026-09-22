export interface VocabularyItem {
  id: string;
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
  languageCode: string;
  title: string;
  description?: string | null;
  contentVersion: string;
  sortOrder: number;
  vocabularyItems: VocabularyItem[];
  isActive?: boolean;
}

// API snake_case wire contracts
export interface ApiVocabularyItem {
  id: string;
  lesson_id: string;
  term: string;
  definition: string;
  example_sentence: string;
  difficulty: string;
  category?: string | null;
  translation?: string | null;
  content_version: string;
  sort_order: number;
  is_active?: boolean;
}

export interface ApiLessonSummary {
  id: string;
  language_code: string;
  title: string;
  description?: string | null;
  content_version: string;
  sort_order: number;
  item_count: number;
  is_active?: boolean;
}

export interface ApiLessonDetail {
  id: string;
  language_code: string;
  title: string;
  description?: string | null;
  content_version: string;
  sort_order: number;
  vocabulary_items: ApiVocabularyItem[];
  is_active?: boolean;
}

/**
 * Adapter functions converting snake_case API data to camelCase client models.
 */
export function adaptVocabularyItemFromApi(api: ApiVocabularyItem): VocabularyItem {
  return {
    id: api.id,
    lessonId: api.lesson_id,
    term: api.term,
    definition: api.definition,
    exampleSentence: api.example_sentence,
    difficulty: api.difficulty,
    category: api.category ?? null,
    translation: api.translation ?? null,
    contentVersion: api.content_version,
    sortOrder: api.sort_order,
    isActive: api.is_active ?? true,
  };
}

export function adaptLessonSummaryFromApi(api: ApiLessonSummary): LessonSummary {
  return {
    id: api.id,
    languageCode: api.language_code,
    title: api.title,
    description: api.description ?? null,
    contentVersion: api.content_version,
    sortOrder: api.sort_order,
    itemCount: api.item_count,
    isActive: api.is_active ?? true,
  };
}

export function adaptLessonDetailFromApi(api: ApiLessonDetail): LessonDetail {
  return {
    id: api.id,
    languageCode: api.language_code,
    title: api.title,
    description: api.description ?? null,
    contentVersion: api.content_version,
    sortOrder: api.sort_order,
    vocabularyItems: (api.vocabulary_items || []).map(adaptVocabularyItemFromApi),
    isActive: api.is_active ?? true,
  };
}
