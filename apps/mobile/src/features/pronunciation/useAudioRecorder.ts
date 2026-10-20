import { useState, useRef, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import { AudioUploadPayload } from "../../services/api/pronunciation";

export type RecorderStatus =
  | "idle"
  | "permission_denied"
  | "permission_blocked"
  | "ready"
  | "recording"
  | "recorded"
  | "playing"
  | "uploading"
  | "success"
  | "error";

export type AudioRecorderState = {
  status: RecorderStatus;
  durationMs: number;
  playbackPositionMs: number;
  playbackDurationMs: number;
  error: string | null;
  audioPayload: AudioUploadPayload | null;
  audioPreviewUri: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  playRecording: () => Promise<void>;
  pausePlayback: () => Promise<void>;
  discardRecording: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
};

const MAX_RECORDING_MS = 60000; // 60 seconds
const MIN_RECORDING_MS = 500;   // 0.5 seconds

export function useAudioRecorder(): AudioRecorderState {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [durationMs, setDurationMs] = useState<number>(0);
  const [playbackPositionMs, setPlaybackPositionMs] = useState<number>(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [audioPayload, setAudioPayload] = useState<AudioUploadPayload | null>(null);
  const [audioPreviewUri, setAudioPreviewUri] = useState<string | null>(null);

  // Web Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const webAudioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Native Refs
  const nativeRecordingRef = useRef<Audio.Recording | null>(null);
  const nativeSoundRef = useRef<Audio.Sound | null>(null);

  // Timer Ref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const cleanupTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupPlayback = useCallback(async () => {
    if (Platform.OS === "web") {
      if (webAudioPlayerRef.current) {
        webAudioPlayerRef.current.pause();
        webAudioPlayerRef.current = null;
      }
    } else {
      if (nativeSoundRef.current) {
        try {
          await nativeSoundRef.current.unloadAsync();
        } catch {
          // ignore cleanup errors
        }
        nativeSoundRef.current = null;
      }
    }
  }, []);

  const discardRecording = useCallback(async () => {
    cleanupTimer();
    await cleanupPlayback();

    if (Platform.OS === "web") {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (audioPreviewUri && audioPreviewUri.startsWith("blob:")) {
        URL.revokeObjectURL(audioPreviewUri);
      }
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    } else {
      if (nativeRecordingRef.current) {
        try {
          await nativeRecordingRef.current.stopAndUnloadAsync();
        } catch {
          // ignore error on discard
        }
        nativeRecordingRef.current = null;
      }
    }

    setAudioPayload(null);
    setAudioPreviewUri(null);
    setDurationMs(0);
    setPlaybackPositionMs(0);
    setPlaybackDurationMs(0);
    setError(null);
    setStatus("ready");
  }, [cleanupPlayback, cleanupTimer, audioPreviewUri]);

  // Request Microphone Permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (Platform.OS === "web") {
      if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("permission_denied");
        setError("Microphone recording is not supported in this browser environment.");
        return false;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop()); // release test stream
        setStatus("ready");
        return true;
      } catch (err: unknown) {
        const errObj = err as { name?: string };
        if (errObj && (errObj.name === "NotAllowedError" || errObj.name === "PermissionDeniedError")) {
          setStatus("permission_blocked");
          setError("Microphone permission was denied. Please allow microphone access in your browser settings.");
        } else {
          setStatus("permission_denied");
          setError("Unable to access microphone. Please check your audio input device.");
        }
        return false;
      }
    } else {
      try {
        const response = await Audio.requestPermissionsAsync();
        if (response.granted) {
          setStatus("ready");
          return true;
        } else if (!response.canAskAgain) {
          setStatus("permission_blocked");
          setError("Microphone permission is blocked. Please enable it in system app settings.");
          return false;
        } else {
          setStatus("permission_denied");
          setError("Microphone permission was denied.");
          return false;
        }
      } catch {
        setStatus("permission_denied");
        setError("Error requesting microphone permission.");
        return false;
      }
    }
  }, []);

  // Stop Recording
  const stopRecording = useCallback(async () => {
    cleanupTimer();
    const recordedDuration = Date.now() - startTimeRef.current;

    if (recordedDuration < MIN_RECORDING_MS) {
      await discardRecording();
      setError("Recording too short. Speak clearly for at least 1 second.");
      return;
    }

    setDurationMs(recordedDuration);
    setPlaybackDurationMs(recordedDuration);

    if (Platform.OS === "web") {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.onstop = () => {
          const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          setAudioPayload(blob);
          setAudioPreviewUri(url);
          setStatus("recorded");

          if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
          }
        };
        mediaRecorderRef.current.stop();
      }
    } else {
      if (nativeRecordingRef.current) {
        try {
          await nativeRecordingRef.current.stopAndUnloadAsync();
          const uri = nativeRecordingRef.current.getURI();
          if (uri) {
            setAudioPayload({
              uri,
              name: "recording.m4a",
              type: "audio/m4a",
            });
            setAudioPreviewUri(uri);
            setStatus("recorded");
          } else {
            setError("Could not retrieve recorded audio.");
            setStatus("ready");
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Error stopping recording";
          setError(message);
          setStatus("ready");
        }
        nativeRecordingRef.current = null;
      }
    }
  }, [cleanupTimer, discardRecording]);

  // Start Recording
  const startRecording = useCallback(async () => {
    setError(null);
    await discardRecording();

    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    startTimeRef.current = Date.now();
    setDurationMs(0);

    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        audioChunksRef.current = [];

        const options: MediaRecorderOptions = {};
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          options.mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          options.mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          options.mimeType = "audio/mp4";
        }

        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.start(250); // timeslice 250ms
        setStatus("recording");

        // Duration timer
        timerRef.current = setInterval(() => {
          const elapsed = Date.now() - startTimeRef.current;
          setDurationMs(elapsed);
          if (elapsed >= MAX_RECORDING_MS) {
            void stopRecording();
          }
        }, 100);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Could not start recording";
        setError(message);
        setStatus("ready");
      }
    } else {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await recording.startAsync();
        nativeRecordingRef.current = recording;
        setStatus("recording");

        timerRef.current = setInterval(() => {
          const elapsed = Date.now() - startTimeRef.current;
          setDurationMs(elapsed);
          if (elapsed >= MAX_RECORDING_MS) {
            void stopRecording();
          }
        }, 100);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Could not start native audio recording";
        setError(message);
        setStatus("ready");
      }
    }
  }, [discardRecording, requestPermission, stopRecording]);

  // Play Recording
  const playRecording = useCallback(async () => {
    if (!audioPreviewUri) return;
    await cleanupPlayback();

    if (Platform.OS === "web") {
      const audio = new window.Audio(audioPreviewUri);
      webAudioPlayerRef.current = audio;

      audio.ontimeupdate = () => {
        setPlaybackPositionMs(Math.round(audio.currentTime * 1000));
      };
      audio.onended = () => {
        setStatus("recorded");
        setPlaybackPositionMs(0);
      };
      audio.onerror = () => {
        setError("Error during audio playback preview.");
        setStatus("recorded");
      };

      try {
        await audio.play();
        setStatus("playing");
      } catch {
        setError("Playback failed. Please retry.");
        setStatus("recorded");
      }
    } else {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioPreviewUri },
          { shouldPlay: true },
          status => {
            if (status.isLoaded) {
              setPlaybackPositionMs(status.positionMillis || 0);
              if (status.didJustFinish) {
                setStatus("recorded");
                setPlaybackPositionMs(0);
              }
            }
          }
        );
        nativeSoundRef.current = sound;
        setStatus("playing");
      } catch {
        setError("Playback failed on device.");
        setStatus("recorded");
      }
    }
  }, [audioPreviewUri, cleanupPlayback]);

  // Pause Playback
  const pausePlayback = useCallback(async () => {
    if (Platform.OS === "web") {
      if (webAudioPlayerRef.current) {
        webAudioPlayerRef.current.pause();
      }
    } else {
      if (nativeSoundRef.current) {
        try {
          await nativeSoundRef.current.pauseAsync();
        } catch {
          // ignore pause error
        }
      }
    }
    setStatus("recorded");
  }, []);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      cleanupTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (webAudioPlayerRef.current) {
        webAudioPlayerRef.current.pause();
      }
      if (nativeSoundRef.current) {
        void nativeSoundRef.current.unloadAsync().catch(() => {});
      }
      if (nativeRecordingRef.current) {
        void nativeRecordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [cleanupTimer]);

  return {
    status,
    durationMs,
    playbackPositionMs,
    playbackDurationMs,
    error,
    audioPayload,
    audioPreviewUri,
    startRecording,
    stopRecording,
    playRecording,
    pausePlayback,
    discardRecording,
    requestPermission,
  };
}
