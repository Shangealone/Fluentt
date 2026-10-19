import { ApiError, apiClient } from '../../api/client';
import { readPronunciationResult, submitPronunciation } from '../api';
import { metadata, payload } from '../testFixtures';
import en from '../../i18n/locales/en.json';
import fil from '../../i18n/locales/fil.json';

jest.mock('../../api/client', () => ({ ...jest.requireActual('../../api/client'), apiClient: jest.fn() }));

it('submits multipart metadata and a cache URI with the authenticated owner', async () => {
  jest.mocked(apiClient).mockResolvedValueOnce(payload());
  const append = jest.spyOn(FormData.prototype, 'append');
  const signal = new AbortController().signal;
  await submitPronunciation('owner', metadata, 'file:///cache/a.m4a', signal);
  expect(apiClient).toHaveBeenCalledWith('/pronunciation/attempts', expect.objectContaining({ method: 'POST', body: expect.any(FormData), expectedUserId: 'owner', signal }));
  expect(append).toHaveBeenCalledWith('metadata', JSON.stringify(metadata));
  expect(append).toHaveBeenCalledWith('audio', { uri: 'file:///cache/a.m4a', name: 'recording.m4a', type: 'audio/mp4' });
  append.mockRestore();
});

it('decodes the stored failure embedded in a non-2xx envelope', async () => {
  jest.mocked(apiClient).mockRejectedValueOnce(new ApiError(503, { result: payload('failed') }));
  expect((await submitPronunciation('owner', metadata, 'file:///cache/a.m4a', new AbortController().signal)).status).toBe('failed');
});

it('rejects wrong attempt identities and fabricated performance on unscorable results', () => {
  expect(() => readPronunciationResult({ ...payload(), client_pronunciation_attempt_id: 'other' }, metadata)).toThrow();
  const invalid = payload('unscorable'); invalid.assessment.category = 'D';
  expect(() => readPronunciationResult(invalid, metadata)).toThrow();
});

it('provides matching pronunciation translation keys in both languages', () => {
  function keys(value: object, prefix = ''): string[] {
    return Object.entries(value).flatMap(([key, child]) => typeof child === 'object' ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`]);
  }
  expect(keys(en.pronunciation)).toEqual(keys(fil.pronunciation));
  expect(en.pronunciation.feedback.B).toBeTruthy();
  expect(fil.pronunciation.feedback.unscorable).toBeTruthy();
});
