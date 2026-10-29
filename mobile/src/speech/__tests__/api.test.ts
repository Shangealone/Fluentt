import { bindAuthenticatedAccount, clearTokens, saveTokens } from '../../auth/tokenStore';
import { recognizeSnapshot, assessRecording } from '../api';
import { parseRecognition, parseAssessment } from '../types';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return { getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => { store.set(k, v); },
    deleteItemAsync: async (k: string) => { store.delete(k); } };
});

const identity = { model_id: 'candidate', model_revision: 'abc', validation_status: 'unvalidated_model_prediction' };
const input = { requestId: '11111111-1111-4111-8111-111111111111', sessionId: '22222222-2222-4222-8222-222222222222',
  sequence: 0, isFinal: true, sampleRateHz: 16000, channels: 1 as const,
  itemId: 'item', revisionId: 'rev', releaseId: 'release', expectedUserId: 'owner', consentVersion: 'speech-recognition-v1' };
const result = { ...identity, transcript: 'hello', decoder_version: 'test', request_id: input.requestId,
  sequence: 0, is_final: true, words: [{ target_index: 0, expected_word: 'hello', recognized_word: 'hello', state: 'match' }] };

beforeEach(async () => {
  await clearTokens();
  const tokens = { accessToken: 'access', refreshToken: 'refresh' };
  await saveTokens(tokens);
  await bindAuthenticatedAccount('owner', tokens);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('sends PCM as binary with bearer ownership and explicit metadata', async () => {
  const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => result } as Response);
  const pcm = new ArrayBuffer(100);
  expect((await recognizeSnapshot(input, pcm)).transcript).toBe('hello');
  const options = fetch.mock.calls[0][1]!;
  expect(options.body).toBe(pcm);
  expect(options.headers).toMatchObject({ 'Content-Type': 'application/octet-stream', Authorization: 'Bearer access',
    'X-Content-Revision-Id': 'rev', 'X-Recognition-Consent': 'speech-recognition-v1' });
  expect(JSON.stringify(options.headers)).not.toContain('expectedUserId');
});

test('a late response after signing in again as the same learner is rejected', async () => {
  let resolve!: (value: Response) => void;
  jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(r => { resolve = r; }));
  const pending = recognizeSnapshot(input, new ArrayBuffer(100));
  while (!resolve) await Promise.resolve();
  const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
  await saveTokens(tokens);
  await bindAuthenticatedAccount('owner', tokens);
  resolve({ ok: true, status: 200, json: async () => result } as Response);
  await expect(pending).rejects.toThrow(/session|account/i);
});

test('assessment is not replayed after 401', async () => {
  const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: 'Expired' }) } as Response);
  await expect(assessRecording({ ...input, consentVersion: 'speech-assessment-v1' }, new ArrayBuffer(100))).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('a stalled audio upload is aborted without replay', async () => {
  jest.useFakeTimers();
  const fetch = jest.spyOn(global, 'fetch').mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    if (!options?.signal) { reject(new Error('Missing request deadline')); return; }
    options.signal.addEventListener('abort', () => reject(new Error('Aborted')));
  }));
  const pending = recognizeSnapshot(input, new ArrayBuffer(100)).catch(error => error);
  await jest.advanceTimersByTimeAsync(0);
  expect(fetch.mock.calls[0][1]?.signal).toBeDefined();
  await jest.advanceTimersByTimeAsync(45001);
  expect((await pending).message).toMatch(/abort/i);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('release builds refuse to send speech over plain HTTP', async () => {
  const fetch = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Unsafe network call'));
  const previous = __DEV__;
  Object.defineProperty(globalThis, '__DEV__', { value: false, configurable: true });
  try {
    await expect(assessRecording({ ...input, consentVersion: 'speech-assessment-v1' }, new ArrayBuffer(100))).rejects.toThrow(/secure|https/i);
    expect(fetch).not.toHaveBeenCalled();
  } finally { Object.defineProperty(globalThis, '__DEV__', { value: previous, configurable: true }); }
});

test('rejects recognition scores and malformed assessment scores', () => {
  expect(() => parseRecognition({ ...result, overall_score: 100 })).toThrow();
  expect(() => parseAssessment({ ...identity, status: 'scored', overall_score: null, words: [] })).toThrow();
  expect(() => parseAssessment({ ...identity, status: 'scored', overall_score: Infinity, words: [] })).toThrow();
});
