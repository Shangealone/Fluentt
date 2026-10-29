import { ContractError, arrayField, booleanField, integerField, object, stringField } from '../api/contracts';

export type ValidationStatus = 'unvalidated_model_prediction' | 'validated';
export interface ModelIdentity { model_id: string; model_revision: string; validation_status: ValidationStatus }
export interface Capability {
  mode: 'unavailable' | 'learner' | 'internal_qa'; reason: string;
  model_id: string | null; model_revision: string | null; validation_status: ValidationStatus | null;
}
export interface SpeechCapabilities {
  language_code: 'en' | 'fil'; recognition: Capability; assessment: Capability;
  recognition_consent_version: string; assessment_consent_version: string;
}
export interface WordMatch { target_index: number; expected_word: string; recognized_word: string | null; state: 'pending' | 'match' | 'mismatch' }
export interface RecognitionResponse extends ModelIdentity {
  request_id: string; sequence: number; is_final: boolean; transcript: string; decoder_version: string; words: WordMatch[];
}
export interface PhonePrediction { phone: string; score: number; pherr_prob: number; error: boolean }
export interface WordPrediction { word: string; score: number; phonemes: PhonePrediction[] }
export interface AssessmentResponse extends ModelIdentity {
  status: 'scored'; request_id: string; overall_score: number; n_errors: number; words: WordPrediction[]; duration_ms: number;
}
export interface SpeechRequest {
  requestId: string; sessionId: string; sequence: number; isFinal: boolean; sampleRateHz: number; channels: 1;
  itemId: string; revisionId: string; releaseId: string; consentVersion: string; expectedUserId: string; signal?: AbortSignal;
}
export interface PCMClip { pcm: ArrayBuffer; sampleRateHz: number; channels: 1; durationMs: number }

function keys(row: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(row).some(k => !allowed.includes(k))) throw new ContractError('Unexpected speech response.');
}
function text(row: Record<string, unknown>, key: string, max: number, empty = false): string {
  const value = row[key];
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new ContractError(`Invalid ${key}.`);
  return value;
}
function number(row: Record<string, unknown>, key: string, max = 100): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) throw new ContractError(`Invalid ${key}.`);
  return value;
}
function identity(row: Record<string, unknown>): ModelIdentity {
  const status = row.validation_status;
  if (status !== 'validated' && status !== 'unvalidated_model_prediction') throw new ContractError('Invalid model validation.');
  return { model_id: text(row, 'model_id', 200), model_revision: text(row, 'model_revision', 128), validation_status: status };
}
export function parseCapabilities(value: unknown): SpeechCapabilities {
  const row = object(value);
  keys(row, ['language_code', 'recognition', 'assessment', 'recognition_consent_version', 'assessment_consent_version']);
  if (row.language_code !== 'en' && row.language_code !== 'fil') throw new ContractError('Invalid language.');
  const capability = (value: unknown): Capability => {
    const cap = object(value);
    keys(cap, ['mode', 'reason', 'model_id', 'model_revision', 'validation_status']);
    if (!['unavailable', 'learner', 'internal_qa'].includes(cap.mode as string)) throw new ContractError('Invalid speech capability.');
    let meta: ModelIdentity | null = null;
    if (cap.model_id !== null || cap.model_revision !== null || cap.validation_status !== null) meta = identity(cap);
    if (cap.mode !== 'unavailable' && (!meta || (cap.mode === 'learner' && meta.validation_status !== 'validated'))) throw new ContractError('Unavailable model.');
    return { mode: cap.mode as Capability['mode'], reason: stringField(cap, 'reason'),
      model_id: meta?.model_id ?? null, model_revision: meta?.model_revision ?? null, validation_status: meta?.validation_status ?? null };
  };
  return { language_code: row.language_code, recognition: capability(row.recognition), assessment: capability(row.assessment),
    recognition_consent_version: text(row, 'recognition_consent_version', 100), assessment_consent_version: text(row, 'assessment_consent_version', 100) };
}
export function parseRecognition(value: unknown): RecognitionResponse {
  const row = object(value);
  keys(row, ['model_id', 'model_revision', 'validation_status', 'request_id', 'sequence', 'is_final', 'transcript', 'decoder_version', 'words']);
  const words = arrayField(row, 'words').map((value, index): WordMatch => {
    const word = object(value);
    keys(word, ['target_index', 'expected_word', 'recognized_word', 'state']);
    if (integerField(word, 'target_index') !== index || !['pending', 'match', 'mismatch'].includes(word.state as string)) throw new ContractError('Invalid word alignment.');
    return { target_index: index, expected_word: text(word, 'expected_word', 100),
      recognized_word: word.recognized_word === null ? null : text(word, 'recognized_word', 100), state: word.state as WordMatch['state'] };
  });
  if (words.length > 60) throw new ContractError('Too many target words.');
  return { ...identity(row), request_id: stringField(row, 'request_id'), sequence: integerField(row, 'sequence'),
    is_final: booleanField(row, 'is_final'), transcript: text(row, 'transcript', 2000, true), decoder_version: text(row, 'decoder_version', 128), words };
}
export function parseAssessment(value: unknown): AssessmentResponse {
  const row = object(value);
  keys(row, ['model_id', 'model_revision', 'validation_status', 'status', 'request_id', 'overall_score', 'n_errors', 'words', 'duration_ms']);
  if (row.status !== 'scored') throw new ContractError('Assessment is unavailable.');
  const words = arrayField(row, 'words').map((value): WordPrediction => {
    const word = object(value);
    keys(word, ['word', 'score', 'phonemes']);
    const phonemes = arrayField(word, 'phonemes').map((value): PhonePrediction => {
      const phone = object(value);
      keys(phone, ['phone', 'score', 'pherr_prob', 'error']);
      const probability = number(phone, 'pherr_prob', 1);
      const error = booleanField(phone, 'error');
      if (error !== (probability >= 0.70)) throw new ContractError('Invalid phoneme output.');
      return { phone: text(phone, 'phone', 12), score: number(phone, 'score'), pherr_prob: probability, error };
    });
    if (!phonemes.length || phonemes.length > 100) throw new ContractError('Incomplete phoneme output.');
    return { word: text(word, 'word', 100), score: number(word, 'score'), phonemes };
  });
  const phones = words.flatMap(w => w.phonemes);
  const n_errors = integerField(row, 'n_errors');
  const duration_ms = integerField(row, 'duration_ms', 1);
  if (!words.length || words.length > 60 || phones.length > 600 || n_errors !== phones.filter(p => p.error).length || duration_ms > 10000) throw new ContractError('Incomplete assessment.');
  return { ...identity(row), status: 'scored', request_id: stringField(row, 'request_id'), overall_score: number(row, 'overall_score'), n_errors, words, duration_ms };
}
