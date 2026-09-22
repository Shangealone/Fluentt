import { apiClient } from '../api/client';
import {
  ApiLearnerProfile,
  ApiUpdatePreferencesRequest,
  LearnerProfile,
  UpdatePreferencesPayload,
} from './types';

/**
 * Maps backend snake_case LearnerProfile to mobile camelCase model.
 */
export function adaptProfileFromApi(api: ApiLearnerProfile): LearnerProfile {
  return {
    id: api.id,
    email: api.email,
    participantCode: api.participant_code,
    interfaceLanguage: api.interface_language,
    targetLearningLanguage: api.target_learning_language,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

/**
 * Maps mobile camelCase preferences to backend snake_case request payload.
 */
export function adaptPreferencesToApi(
  prefs: UpdatePreferencesPayload
): ApiUpdatePreferencesRequest {
  const payload: ApiUpdatePreferencesRequest = {};
  if (prefs.interfaceLanguage !== undefined) {
    payload.interface_language = prefs.interfaceLanguage;
  }
  if (prefs.targetLearningLanguage !== undefined) {
    payload.target_learning_language = prefs.targetLearningLanguage;
  }
  return payload;
}

export async function getLearnerProfile(): Promise<LearnerProfile> {
  const data = await apiClient<ApiLearnerProfile>('/users/me');
  return adaptProfileFromApi(data);
}

export async function updateLearnerPreferences(
  prefs: UpdatePreferencesPayload
): Promise<LearnerProfile> {
  const body = adaptPreferencesToApi(prefs);
  const data = await apiClient<ApiLearnerProfile>('/users/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return adaptProfileFromApi(data);
}
