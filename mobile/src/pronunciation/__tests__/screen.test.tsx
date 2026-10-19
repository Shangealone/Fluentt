import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import PronunciationScreen from '../../../app/(app)/pronunciation/[lessonId]';
import { setInterfaceLanguage } from '../../i18n';
import { fetchLessonDetail } from '../../content/api';
import { nativeCapture } from '../nativeCapture';
import { readPronunciationResult, submitPronunciation } from '../api';
import { metadata, payload } from '../testFixtures';

let mockOwner = 'owner';
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ lessonId: 'lesson', contentReleaseId: '22222222-2222-4222-8222-222222222222', vocabularyItemId: '44444444-4444-4444-8444-444444444444' }),
  useFocusEffect: (callback: () => (() => void)) => { const React = jest.requireActual('react'); React.useEffect(callback, [callback]); },
}));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: mockOwner }, status: 'signedIn' }) }));
jest.mock('../../content/api', () => ({ fetchLessonDetail: jest.fn() }));
jest.mock('../api', () => ({ ...jest.requireActual('../api'), submitPronunciation: jest.fn(), checkPronunciation: jest.fn() }));
jest.mock('../nativeCapture', () => ({ nativeCapture: {
  permission: async () => ({ granted: true, canAskAgain: true }),
  requestPermission: async () => ({ granted: true, canAskAgain: true }),
  create: () => ({ prepare: async () => undefined, record: () => undefined, stop: async () => undefined, status: () => ({ durationMs: 1200, isRecording: true }), uri: () => 'file:///cache/practice.m4a', release: () => undefined }),
  size: () => 1024, remove: jest.fn(),
} }));

beforeEach(async () => {
  jest.clearAllMocks(); mockOwner = 'owner';
  jest.replaceProperty(Platform, 'OS', 'android');
  await setInterfaceLanguage('en');
  jest.mocked(fetchLessonDetail).mockResolvedValue({ lesson: {
    id: 'lesson', contentReleaseId: metadata.content_release_id, languageCode: 'en', title: 'Practice', contentVersion: 'dev', sortOrder: 0,
    vocabularyItems: [{ id: metadata.vocabulary_item_id, contentReleaseId: metadata.content_release_id, contentRevisionId: metadata.content_revision_id, lessonId: 'lesson', term: 'water', exampleSentence: 'May I have water?', definition: 'Water', difficulty: 'easy', contentVersion: 'dev', sortOrder: 0 }],
  }, isOffline: false });
});

afterEach(() => jest.restoreAllMocks());

async function record(view: Awaited<ReturnType<typeof render>>) {
  await waitFor(() => expect(view.getByText('water')).toBeTruthy());
  await fireEvent.press(view.getByText('Record'));
  await waitFor(() => expect(view.getByText('Stop recording')).toBeTruthy());
  await fireEvent.press(view.getByText('Stop recording'));
  await waitFor(() => expect(view.getByText('Assess recording')).toBeTruthy());
}

it('records, submits the retained URI and shows server score/category/feedback', async () => {
  jest.mocked(submitPronunciation).mockResolvedValueOnce(readPronunciationResult(payload(), metadata));
  const view = await render(<PronunciationScreen />);
  await record(view);
  expect(nativeCapture.remove).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText('Assess recording'));
  await waitFor(() => expect(view.getByText('Accuracy: 90.00 / 100')).toBeTruthy());
  expect(view.getByText('Category B')).toBeTruthy();
  expect(view.getByText('Good pronunciation. Focus on the highlighted sounds.')).toBeTruthy();
  expect(submitPronunciation).toHaveBeenCalledWith('owner', expect.objectContaining({ target_kind: 'term', vocabulary_item_id: metadata.vocabulary_item_id }), 'file:///cache/practice.m4a', expect.any(AbortSignal));
  await waitFor(() => expect(nativeCapture.remove).toHaveBeenCalledWith('file:///cache/practice.m4a'));
  await view.unmount();
});

it('shows unscorable guidance with no numeric result and permits a fresh recording', async () => {
  jest.mocked(submitPronunciation).mockResolvedValueOnce(readPronunciationResult(payload('unscorable'), metadata));
  const view = await render(<PronunciationScreen />);
  await record(view); await fireEvent.press(view.getByText('Assess recording'));
  await waitFor(() => expect(view.getByText('Recording could not be scored')).toBeTruthy());
  expect(view.queryByText(/Accuracy:/)).toBeNull();
  await fireEvent.press(view.getByText('New recording'));
  await waitFor(() => expect(view.getByText('Record')).toBeTruthy());
  await view.unmount();
});

it('fences late assessment results when the authenticated owner changes', async () => {
  let resolve!: (value: ReturnType<typeof readPronunciationResult>) => void;
  jest.mocked(submitPronunciation).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const view = await render(<PronunciationScreen />);
  await record(view); await fireEvent.press(view.getByText('Assess recording'));
  mockOwner = 'other-owner'; await view.rerender(<PronunciationScreen />);
  resolve(readPronunciationResult(payload(), metadata));
  await waitFor(() => expect(view.getByText('Record')).toBeTruthy());
  expect(view.queryByText(/Accuracy:/)).toBeNull();
  await view.unmount();
});
