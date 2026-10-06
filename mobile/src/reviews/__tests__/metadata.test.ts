import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { captureReviewAttempt } from '../metadata';

jest.mock('expo-constants', () => {
  const configuration = require('../../../app.json');
  return { __esModule: true, default: { expoConfig: { ...configuration.expo } } };
});

const facts = {
  client_session_id: '11111111-1111-4111-8111-111111111111',
  session_id: '22222222-2222-4222-8222-222222222222',
  vocabulary_item_id: '33333333-3333-4333-8333-333333333333',
  correct: false, response_time_ms: 1234, submitted_answer: 'incorrect',
};

afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

it.each(['ios', 'android', 'web'] as const)('captures actual %s runtime and configured Expo app version', (platform) => {
  jest.replaceProperty(Platform, 'OS', platform);
  jest.useFakeTimers().setSystemTime(new Date('2025-01-01T11:22:33.456Z'));
  const captured = captureReviewAttempt(facts);
  expect(captured).toMatchObject({ ...facts, device_platform: platform,
    application_version: Constants.expoConfig!.version,
    client_interaction_at: '2025-01-01T11:22:33.456Z' });
  expect(captured.client_event_id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(captured.client_session_id).not.toBe(captured.session_id);
});

it.each([undefined, '', ' ', 'x'.repeat(33)])('fails explicitly when the configured version is unusable: %s', (version) => {
  jest.replaceProperty(Constants.expoConfig!, 'version', version);
  expect(() => captureReviewAttempt(facts)).toThrow('configured application version is unavailable');
});
