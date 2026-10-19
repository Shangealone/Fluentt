import { ApiError, apiClient } from '../api/client';
import { arrayField, ContractError, nullableString, object, stringField } from '../api/contracts';

export type TargetKind = 'term' | 'sentence';
export interface AttemptMetadata {
  client_pronunciation_attempt_id: string;
  vocabulary_item_id: string;
  content_revision_id: string;
  content_release_id: string;
  target_kind: TargetKind;
  original_interaction_at: string;
  capture_profile_version: 'expo57-term-m4a-v1';
  device_platform: 'android';
  application_version: string;
}
export interface PronunciationResult {
  status: 'processing' | 'scored' | 'unscorable' | 'failed';
  assessment: { accuracy_score_display: string | null; category: 'A' | 'B' | 'C' | 'D' | null };
  feedbackKey: string | null;
  issues: { id: string; level: 'word' | 'phoneme'; target_unit: string; provider_error_type: string | null }[];
  recovery: 'rerecord' | 'check_status' | 'retry_later' | 'operator_action' | null;
}

/** Validate identity and display fields; never reclassify rounded JS scores. */
export function readPronunciationResult(value: unknown, metadata: AttemptMetadata): PronunciationResult {
  const row = object(value);
  if (row.schema_version !== 'pronunciation-result-v1' || row.client_pronunciation_attempt_id !== metadata.client_pronunciation_attempt_id) throw new ContractError('Pronunciation attempt mismatch.');
  const target = object(row.target);
  for (const key of ['vocabulary_item_id', 'content_revision_id', 'content_release_id', 'target_kind'] as const) {
    if (target[key] !== metadata[key]) throw new ContractError('Pronunciation target mismatch.');
  }
  const status = row.status;
  if (status !== 'processing' && status !== 'scored' && status !== 'unscorable' && status !== 'failed') throw new ContractError('Invalid pronunciation status.');
  const assessment = object(row.assessment);
  const category = nullableString(assessment, 'category');
  const display = nullableString(assessment, 'accuracy_score_display');
  if (status === 'scored') {
    if (!['A', 'B', 'C', 'D'].includes(category ?? '') || !/^\d{1,3}\.\d{2}$/.test(display ?? '') || Number(display) > 100) throw new ContractError('Invalid pronunciation score.');
  } else if (category !== null || display !== null) throw new ContractError('Unscored response contains a score.');
  const feedbackKey = nullableString(object(row.feedback), 'general_feedback_key');
  const expectedKey = status === 'scored' ? `pronunciation.feedback.${category}` : status === 'unscorable' ? 'pronunciation.feedback.unscorable' : null;
  if (expectedKey && feedbackKey !== expectedKey) throw new ContractError('Invalid pronunciation feedback.');
  if (feedbackKey && !['pronunciation.errors.recorded', 'pronunciation.errors.service', expectedKey].includes(feedbackKey)) throw new ContractError('Unknown pronunciation feedback.');
  const rawIssues = arrayField(row, 'issues');
  if (rawIssues.length > 66) throw new ContractError('Too many pronunciation issues.');
  const issues = rawIssues.map((value) => {
    const issue = object(value);
    const level = stringField(issue, 'level');
    if (level !== 'word' && level !== 'phoneme') throw new ContractError('Invalid pronunciation issue.');
    const error = nullableString(issue, 'provider_error_type');
    if (error && !['None', 'Mispronunciation', 'Omission', 'Insertion'].includes(error)) throw new ContractError('Invalid word issue.');
    return { id: stringField(issue, 'id'), level, target_unit: stringField(issue, 'target_unit'), provider_error_type: error };
  });
  const recovery = row.reason === null ? null : stringField(object(row.reason), 'recovery');
  if (recovery !== null && !['rerecord', 'check_status', 'retry_later', 'operator_action'].includes(recovery)) throw new ContractError('Invalid pronunciation recovery.');
  return { status, assessment: { accuracy_score_display: display, category: category as PronunciationResult['assessment']['category'] },
    feedbackKey, issues: issues as PronunciationResult['issues'], recovery: recovery as PronunciationResult['recovery'] };
}

export async function submitPronunciation(ownerId: string, metadata: AttemptMetadata, uri: string, signal: AbortSignal): Promise<PronunciationResult> {
  const body = new FormData();
  body.append('metadata', JSON.stringify(metadata));
  // React Native's FormData accepts a file URI; fetch supplies the multipart boundary.
  body.append('audio', { uri, name: 'recording.m4a', type: 'audio/mp4' } as unknown as Blob);
  try {
    const value = await apiClient<unknown>('/pronunciation/attempts', { method: 'POST', body, signal, expectedUserId: ownerId });
    return readPronunciationResult(value, metadata);
  } catch (error) {
    if (error instanceof ApiError && error.data?.result) return readPronunciationResult(error.data.result, metadata);
    throw error;
  }
}

export async function checkPronunciation(ownerId: string, metadata: AttemptMetadata, signal: AbortSignal): Promise<PronunciationResult> {
  return readPronunciationResult(await apiClient<unknown>(`/pronunciation/attempts/by-client/${metadata.client_pronunciation_attempt_id}`, { expectedUserId: ownerId, signal }), metadata);
}
