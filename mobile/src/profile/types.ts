export type LanguageCode = 'en' | 'fil';

export interface LearnerProfile {
  id: string;
  email: string;
  participantCode: string;
  interfaceLanguage: LanguageCode | null;
  targetLearningLanguage: LanguageCode | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePreferencesPayload {
  interfaceLanguage?: LanguageCode | null;
  targetLearningLanguage?: LanguageCode | null;
}

// Backend snake_case wire representations
export interface ApiLearnerProfile {
  id: string;
  email: string;
  participant_code: string;
  interface_language: LanguageCode | null;
  target_learning_language: LanguageCode | null;
  created_at: string;
  updated_at: string;
}

export interface ApiUpdatePreferencesRequest {
  interface_language?: string | null;
  target_learning_language?: string | null;
}
