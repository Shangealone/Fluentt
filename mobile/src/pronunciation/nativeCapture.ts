import { AudioModule, NativeAudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import { CaptureDependencies } from './capture';

export const nativeCapture: CaptureDependencies = {
  permission: () => AudioModule.getRecordingPermissionsAsync(),
  requestPermission: () => AudioModule.requestRecordingPermissionsAsync(),
  create() {
    const module: NativeAudioModule = AudioModule;
    const recorder = new module.AudioRecorder(RecordingPresets.HIGH_QUALITY);
    let durationMs = 0;
    return {
      async prepare() {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false, allowsBackgroundRecording: false });
        await recorder.prepareToRecordAsync({ ...RecordingPresets.HIGH_QUALITY, directory: 'cache' });
      },
      record: (options) => recorder.record(options),
      async stop() { if (recorder.isRecording) await recorder.stop(); },
      status() {
        const status = recorder.getStatus();
        durationMs = Math.max(durationMs, status.durationMillis);
        return { durationMs, isRecording: status.isRecording };
      },
      uri: () => recorder.uri,
      release: () => recorder.release(),
    };
  },
  size: (uri) => new File(uri).size,
  remove(uri) { const file = new File(uri); if (file.exists) file.delete(); },
};
