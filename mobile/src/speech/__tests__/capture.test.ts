import { act, renderHook } from '@testing-library/react-native';
import { PcmBuffer } from '../pcmBuffer';
import { useSpeechCapture } from '../useSpeechCapture';
import { bindAuthenticatedAccount, clearTokens, saveTokens } from '../../auth/tokenStore';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { AppState, type AppStateStatus } from 'react-native';

let mockOnBuffer: (buffer: { data: ArrayBuffer; sampleRate: number; channels: number }) => void;
const mockStream = { start: jest.fn(async () => {}), stop: jest.fn() };
jest.mock('expo-audio', () => ({
  useAudioStream: (options: { onBuffer: typeof mockOnBuffer }) => { mockOnBuffer = options.onBuffer; return { stream: mockStream, isStreaming: false }; },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async () => {}),
}), { virtual: true });
jest.mock('expo', () => ({ requireOptionalNativeModule: () => ({ AudioStream: class {} }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(callback, [callback]) }));
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return { getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => { store.set(k, v); },
    deleteItemAsync: async (k: string) => { store.delete(k); } };
});

beforeEach(async () => {
  jest.clearAllMocks();
  (requestRecordingPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  await clearTokens();
  const tokens = { accessToken: 'access', refreshToken: 'refresh' };
  await saveTokens(tokens);
  await bindAuthenticatedAccount('owner', tokens);
});
afterEach(() => jest.restoreAllMocks());

test('preserves actual PCM format, caps duration, and clears owned audio', () => {
  const buffer = new PcmBuffer();
  expect(buffer.append({ data: new ArrayBuffer(48000 * 2 * 11), sampleRate: 48000, channels: 1 })).toBe(true);
  expect(buffer.snapshot()!.pcm.byteLength).toBe(960000);
  expect(buffer.snapshot()!.sampleRateHz).toBe(48000);
  buffer.clear();
  expect(buffer.snapshot()).toBeNull();
  expect(() => buffer.append({ data: new ArrayBuffer(100), sampleRate: 16000, channels: 2 })).toThrow();
});

test('denied microphone permission never starts capture', async () => {
  (requestRecordingPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
  const { result } = await renderHook(() => useSpeechCapture({ expectedUserId: 'owner' }));
  await act(async () => { await expect(result.current.start()).rejects.toThrow(); });
  expect(mockStream.start).not.toHaveBeenCalled();
});

test('stops at ten seconds and emits one finished recording', async () => {
  const onFinished = jest.fn();
  const { result, unmount } = await renderHook(() => useSpeechCapture({ expectedUserId: 'owner', onFinished }));
  await act(async () => { await result.current.start(); });
  await act(() => { mockOnBuffer({ data: new ArrayBuffer(320000), sampleRate: 16000, channels: 1 }); });
  expect(onFinished).toHaveBeenCalledTimes(1);
  expect(mockStream.stop).toHaveBeenCalled();
  expect(result.current.status).toBe('idle');
  await unmount();
});

test('cancel while permission is pending prevents a late microphone start', async () => {
  let resolve!: (value: { granted: boolean }) => void;
  (requestRecordingPermissionsAsync as jest.Mock).mockImplementation(() => new Promise(r => { resolve = r; }));
  const { result } = await renderHook(() => useSpeechCapture({ expectedUserId: 'owner' }));
  let pending!: Promise<void>;
  await act(() => { pending = result.current.start(); });
  await act(() => { result.current.cancel(); });
  await act(async () => { resolve({ granted: true }); await pending; });
  expect(mockStream.start).not.toHaveBeenCalled();
});

test('backgrounding stops recording and prevents further snapshots', async () => {
  let change!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    change = listener;
    return { remove: jest.fn() };
  });
  const onInterrupted = jest.fn(), onSnapshot = jest.fn(), onFinished = jest.fn();
  const { result } = await renderHook(() => useSpeechCapture({ expectedUserId: 'owner', onInterrupted, onSnapshot, onFinished }));
  await act(async () => { await result.current.start(); });
  await act(() => { change('background'); });
  await act(() => { mockOnBuffer({ data: new ArrayBuffer(32000), sampleRate: 16000, channels: 1 }); });
  expect(mockStream.stop).toHaveBeenCalled();
  expect(onInterrupted).toHaveBeenCalled();
  expect(onSnapshot).not.toHaveBeenCalled();
  expect(onFinished).not.toHaveBeenCalled();
  expect(result.current.status).toBe('idle');
});

test('signing out cancels the microphone and clears the recording', async () => {
  const onInterrupted = jest.fn();
  const { result } = await renderHook(() => useSpeechCapture({ expectedUserId: 'owner', onInterrupted }));
  await act(async () => { await result.current.start(); });
  await act(async () => { await clearTokens(); });
  expect(onInterrupted).toHaveBeenCalled();
  expect(result.current.status).toBe('idle');
  expect(mockStream.stop).toHaveBeenCalled();
});
