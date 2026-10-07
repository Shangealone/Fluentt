import { apiClient } from '../api/client';
import { ContractError, nullableString, object, stringField, timestampField } from '../api/contracts';
import {
  ApiLearnerProfile,
  ApiUpdatePreferencesRequest,
  LearnerProfile,
  UpdatePreferencesPayload,
  LanguageCode,
} from './types';

/**
 * Maps backend snake_case LearnerProfile to mobile camelCase model.
 */
export function adaptProfileFromApi(value: unknown): LearnerProfile {
  const api = object(value);
  const language = (field: string): LanguageCode | null => {
    const value = nullableString(api, field);
    if (value !== null && value !== 'en' && value !== 'fil') throw new ContractError(`Invalid ${field}.`);
    return value;
  };
  return {
    id: stringField(api, 'id'), userId: stringField(api, 'user_id'),
    email: stringField(api, 'email'), participantCode: stringField(api, 'participant_code'),
    interfaceLanguage: language('interface_language'), targetLearningLanguage: language('target_learning_language'),
    createdAt: timestampField(api, 'created_at'), updatedAt: timestampField(api, 'updated_at'),
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
