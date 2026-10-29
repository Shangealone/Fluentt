import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { requireOptionalNativeModule } from 'expo';
import type { AudioStreamBuffer, AudioStreamOptions } from 'expo-audio';
import { getSessionEpoch, loadAuthenticatedAccount, subscribeToAuthenticatedAccount } from '../auth/tokenStore';
import { PcmBuffer } from './pcmBuffer';
import { PCMClip } from './types';

// Older native clients must continue opening lessons even if their audio module
// lacks PCM streaming. SDK 57's web implementation also returns a null stream.
let audio: typeof import('expo-audio') | null = null;
if (Platform.OS !== 'web' && typeof requireOptionalNativeModule('ExpoAudio')?.AudioStream === 'function') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Check native support before evaluating the audio module.
  try { audio = require('expo-audio'); } catch { /* Native audio is unavailable. */ }
}
const useCaptureStream = audio?.useAudioStream ?? ((_options: AudioStreamOptions) => ({ stream: null, isStreaming: false }));

interface Options {
  expectedUserId: string;
  onSnapshot?: (clip: PCMClip) => void;
  onFinished?: (clip: PCMClip) => void;
  onInterrupted?: () => void;
}
export function useSpeechCapture(options: Options) {
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; }, [options]);
  const buffer = useRef(new PcmBuffer());
  const running = useRef(false);
  const starting = useRef(false);
  const operation = useRef(0);
  const epoch = useRef(getSessionEpoch());
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const native = useRef<{ start: () => Promise<void>; stop: () => void } | null>(null);
  const finishRef = useRef<() => void>(() => {});
  const lastSnapshot = useRef(0);
  const [status, setStatus] = useState<'idle' | 'starting' | 'recording'>('idle');
  const [durationMs, setDuration] = useState(0);

  const cancel = useCallback((notify = false) => {
    operation.current++; running.current = false; starting.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    try { native.current?.stop(); } catch { /* A released stream is already stopped. */ }
    buffer.current.clear();
    if (mounted.current) { setStatus('idle'); setDuration(0); }
    if (notify) latest.current.onInterrupted?.();
  }, []);

  const finish = useCallback(() => {
    if (!running.current) return;
    const clip = buffer.current.snapshot();
    cancel();
    if (clip) latest.current.onFinished?.(clip);
    else latest.current.onInterrupted?.();
  }, [cancel]);
  useLayoutEffect(() => { finishRef.current = finish; }, [finish]);
  const onBuffer = useCallback((data: AudioStreamBuffer) => {
    if (!running.current) return;
    try {
      const full = buffer.current.append(data);
      if (mounted.current) setDuration(buffer.current.durationMs);
      if (full) { finishRef.current(); return; }
      if (latest.current.onSnapshot && buffer.current.durationMs - lastSnapshot.current >= 1000) {
        lastSnapshot.current = buffer.current.durationMs;
        const clip = buffer.current.snapshot();
        if (clip) latest.current.onSnapshot(clip);
      }
    } catch { cancel(true); }
  }, [cancel]);
  const { stream } = useCaptureStream({ sampleRate: 16000, channels: 1, encoding: 'int16', onBuffer });
  useLayoutEffect(() => { native.current = stream; }, [stream]);

  const start = useCallback(async () => {
    if (running.current || starting.current) throw new Error('Recording is already in progress.');
    const current = ++operation.current;
    epoch.current = getSessionEpoch(); starting.current = true;
    buffer.current.clear(); lastSnapshot.current = 0;
    if (mounted.current) setStatus('starting');
    try {
      if (!audio || !native.current) throw new Error('This app needs updated audio support.');
      const permission = await audio.requestRecordingPermissionsAsync();
      if (operation.current !== current) return;
      if (!permission.granted) throw new Error('Allow microphone access to record.');
      const account = await loadAuthenticatedAccount();
      if (operation.current !== current) return;
      if (!account || account.userId !== latest.current.expectedUserId || epoch.current !== getSessionEpoch()) throw new Error('Authenticated account changed.');
      await audio.setAudioModeAsync({ allowsRecording: true, allowsBackgroundRecording: false, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
      if (operation.current !== current) return;
      running.current = true;
      await native.current!.start();
      if (operation.current !== current) { native.current?.stop(); return; }
      starting.current = false;
      if (mounted.current) setStatus('recording');
      timer.current = setTimeout(() => finishRef.current(), 10000);
    } catch (error) { if (operation.current === current) cancel(); throw error; }
  }, [cancel]);

  useFocusEffect(useCallback(() => () => cancel(true), [cancel]));
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') cancel(true); });
    const unsubscribe = subscribeToAuthenticatedAccount(() => {
      if (epoch.current !== getSessionEpoch()) { cancel(true); return; }
      void loadAuthenticatedAccount().then(account => {
        if (!account || account.userId !== latest.current.expectedUserId) cancel(true);
      }).catch(() => cancel(true));
    });
    return () => { mounted.current = false; cancel(); subscription.remove(); unsubscribe(); };
  }, [cancel]);
  useEffect(() => { cancel(); }, [options.expectedUserId, cancel]);
  return { status, durationMs, start, stop: finish, cancel, isSupported: Boolean(stream) };
}
