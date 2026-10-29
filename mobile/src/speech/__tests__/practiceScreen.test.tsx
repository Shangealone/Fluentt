import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import SpeechPracticeScreen from '../SpeechPracticeScreen';
import { setInterfaceLanguage } from '../../i18n';
import { assessRecording, getSpeechCapabilities, recognizeSnapshot } from '../api';

const mockBack = jest.fn();
const mockStart = jest.fn(async () => {});
const mockCancel = jest.fn();
let mockOptions: any;
let mockCounter = 0;
let mockTerm = 'hello world';
jest.mock('expo-crypto', () => ({ randomUUID: () => `11111111-1111-4111-8111-${String(++mockCounter).padStart(12, '0')}` }), { virtual: true });
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({ itemId: 'item', lessonId: 'lesson', revisionId: 'revision', releaseId: 'release' }) }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'signedIn', user: { id: 'owner' } }) }));
jest.mock('../../auth/tokenStore', () => ({ getSessionEpoch: () => 1, getVerifiedAccountId: () => 'owner' }));
jest.mock('../useSpeechCapture', () => ({ useSpeechCapture: (options: unknown) => {
  mockOptions = options;
  return { start: mockStart, cancel: mockCancel, stop: jest.fn(), status: 'idle', durationMs: 0, isSupported: true };
} }));
jest.mock('../../content/api', () => ({ fetchLessonDetail: async () => ({ isOffline: false, lesson: {
  id: 'lesson', languageCode: 'en', contentReleaseId: 'release', vocabularyItems: [{
    id: 'item', term: mockTerm, lessonId: 'lesson', contentRevisionId: 'revision', contentReleaseId: 'release',
  }],
} }) }));
jest.mock('../api');
const cap = { mode: 'internal_qa', reason: 'ready', model_id: 'candidate', model_revision: 'abc', validation_status: 'unvalidated_model_prediction' };
const metadata = { model_id: 'candidate', model_revision: 'abc', validation_status: 'unvalidated_model_prediction' };

beforeEach(async () => {
  jest.clearAllMocks();
  mockTerm = 'hello world';
  await setInterfaceLanguage('en');
  (getSpeechCapabilities as jest.Mock).mockResolvedValue({ language_code: 'en', recognition: cap, assessment: cap,
    recognition_consent_version: 'speech-recognition-v1', assessment_consent_version: 'speech-assessment-v1' });
  (recognizeSnapshot as jest.Mock).mockImplementation(async input => ({ ...metadata, request_id: input.requestId,
    sequence: input.sequence, is_final: input.isFinal, transcript: 'hello world', decoder_version: 'test',
    words: [{ target_index: 0, expected_word: 'hello', recognized_word: 'hello', state: 'match' },
      { target_index: 1, expected_word: 'world', recognized_word: 'world', state: 'match' }] }));
  (assessRecording as jest.Mock).mockImplementation(async input => ({ ...metadata, request_id: input.requestId,
    status: 'scored', overall_score: 86.5, n_errors: 0, duration_ms: 1000, words: [] }));
});

test('requires deliberate consent and labels internal model output', async () => {
  const view = await render(<SpeechPracticeScreen />);
  await waitFor(() => expect(view.getByText('Internal model test — not a learner score.')).toBeTruthy());
  await fireEvent.press(view.getByTestId('speech-record'));
  expect(mockStart).not.toHaveBeenCalled();
  await fireEvent.press(view.getByTestId('speech-recognition-consent'));
  await fireEvent.press(view.getByTestId('speech-record'));
  await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
  await act(async () => { mockOptions.onFinished({ pcm: new ArrayBuffer(32000), sampleRateHz: 16000, channels: 1, durationMs: 1000 }); });
  await waitFor(() => expect(view.getByTestId('speech-transcript')).toHaveTextContent(/hello world/));
  expect(view.queryByTestId('speech-score')).toBeNull();
  expect(view.getByText('Send this recording for pronunciation feedback.')).toBeTruthy();
  await fireEvent.press(view.getByTestId('speech-assessment-consent'));
  await fireEvent.press(view.getByTestId('speech-assess'));
  await waitFor(() => expect(view.getByTestId('speech-score')).toHaveTextContent('86.5/100'));
});

test('an uncertain assessment outcome clears the clip and requires recording again', async () => {
  (assessRecording as jest.Mock).mockRejectedValue(new Error('Connection lost'));
  const view = await render(<SpeechPracticeScreen />);
  await waitFor(() => expect(view.getByTestId('speech-record')).toBeTruthy());
  await fireEvent.press(view.getByTestId('speech-recognition-consent'));
  await fireEvent.press(view.getByTestId('speech-record'));
  await waitFor(() => expect(mockStart).toHaveBeenCalled());
  await act(async () => { mockOptions.onFinished({ pcm: new ArrayBuffer(32000), sampleRateHz: 16000, channels: 1, durationMs: 1000 }); });
  await waitFor(() => expect(view.getByTestId('speech-assessment-consent')).toBeTruthy());
  await fireEvent.press(view.getByTestId('speech-assessment-consent'));
  await fireEvent.press(view.getByTestId('speech-assess'));
  await waitFor(() => expect(view.getByText('We could not finish this recording. Please record again.')).toBeTruthy());
  expect(view.queryByTestId('speech-assess')).toBeNull();
  expect(view.queryByTestId('speech-score')).toBeNull();
  expect(assessRecording).toHaveBeenCalledTimes(1);
});

test('disabled capability offers no recording control and no score', async () => {
  (getSpeechCapabilities as jest.Mock).mockResolvedValue({ recognition: { ...cap, mode: 'unavailable' }, assessment: { ...cap, mode: 'unavailable' } });
  const view = await render(<SpeechPracticeScreen />);
  await waitFor(() => expect(view.getByText('Speech practice is not available yet. You can keep learning with lessons.')).toBeTruthy());
  expect(view.queryByTestId('speech-record')).toBeNull();
  expect(view.queryByTestId('speech-score')).toBeNull();
});

test('a refreshed assessment consent version requires a fresh choice', async () => {
  const view = await render(<SpeechPracticeScreen />);
  await waitFor(() => expect(view.getByTestId('speech-record')).toBeTruthy());
  await fireEvent.press(view.getByTestId('speech-recognition-consent'));
  await fireEvent.press(view.getByTestId('speech-record'));
  await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
  await act(() => { mockOptions.onFinished({ pcm: new ArrayBuffer(32000), sampleRateHz: 16000, channels: 1, durationMs: 1000 }); });
  await waitFor(() => expect(view.getByTestId('speech-assessment-consent')).toBeTruthy());
  await fireEvent.press(view.getByTestId('speech-assessment-consent'));
  expect(view.getByTestId('speech-assessment-consent').props.accessibilityState.checked).toBe(true);
  (getSpeechCapabilities as jest.Mock).mockResolvedValue({ language_code: 'en', recognition: cap, assessment: cap,
    recognition_consent_version: 'speech-recognition-v1', assessment_consent_version: 'speech-assessment-v2' });
  await fireEvent.press(view.getByTestId('speech-record'));
  await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(2));
  await act(() => { mockOptions.onFinished({ pcm: new ArrayBuffer(32000), sampleRateHz: 16000, channels: 1, durationMs: 1000 }); });
  await waitFor(() => expect(view.getByTestId('speech-assessment-consent')).toBeTruthy());
  expect(view.getByTestId('speech-assessment-consent').props.accessibilityState.checked).toBe(false);
  await fireEvent.press(view.getByTestId('speech-assess'));
  expect(assessRecording).not.toHaveBeenCalled();
});

test('the Filipino assessment choice explains that the recording is sent', async () => {
  await setInterfaceLanguage('fil');
  const view = await render(<SpeechPracticeScreen />);
  await waitFor(() => expect(view.getByTestId('speech-record')).toBeTruthy());
  await fireEvent.press(view.getByTestId('speech-recognition-consent'));
  await fireEvent.press(view.getByTestId('speech-record'));
  await waitFor(() => expect(mockStart).toHaveBeenCalled());
  await act(() => { mockOptions.onFinished({ pcm: new ArrayBuffer(32000), sampleRateHz: 16000, channels: 1, durationMs: 1000 }); });
  await waitFor(() => expect(view.getByText('Ipadala ang recording na ito para sa puna sa pagbigkas.')).toBeTruthy());
});

test('lost model availability does not suggest changing microphone permission', async () => {
  const view = await render(<SpeechPracticeScreen />);
  await waitFor(() => expect(view.getByTestId('speech-record')).toBeTruthy());
  await fireEvent.press(view.getByTestId('speech-recognition-consent'));
  (getSpeechCapabilities as jest.Mock).mockResolvedValue({ language_code: 'en', recognition: { ...cap, mode: 'unavailable' }, assessment: { ...cap, mode: 'unavailable' },
    recognition_consent_version: 'speech-recognition-v1', assessment_consent_version: 'speech-assessment-v1' });
  await fireEvent.press(view.getByTestId('speech-record'));
  await waitFor(() => expect(view.getByText('Speech practice is not available yet. You can keep learning with lessons.')).toBeTruthy());
  expect(view.queryByText('We could not start recording. Allow microphone access and try again.')).toBeNull();
  expect(mockStart).not.toHaveBeenCalled();
});

test('the speaking prompt keeps contractions together like the server reference', async () => {
  mockTerm = 'don’t';
  const view = await render(<SpeechPracticeScreen />);
  await waitFor(() => expect(view.getByText("don't")).toBeTruthy());
  expect(view.queryByText('don')).toBeNull();
});
