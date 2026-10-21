import type { WholePhraseRecording } from "./liveWordTracking";

/** Encode actual audio samples, never create samples from recognized text. */
export function pcm16Wav(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => { const value = Math.max(-1, Math.min(1, sample)); view.setInt16(44 + i * 2, value < 0 ? value * 32768 : value * 32767, true); });
  return buffer;
}

/** Memory-only browser capture, explicitly enabled by the learner before recording. */
export async function startWholePhraseCapture() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined" || typeof AudioContext === "undefined" || typeof OfflineAudioContext === "undefined")
    throw new Error("Whole-sentence audio recording is unavailable in this browser.");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
  const chunks: Blob[] = [];
  let recorder: MediaRecorder;
  try { recorder = new MediaRecorder(stream); } catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
  let discarded = false, size = 0;
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = event => {
      size += event.data.size;
      if (size <= 5_000_000) chunks.push(event.data);
    };
    recorder.onerror = () => { stream.getTracks().forEach(track => track.stop()); reject(new Error("The recording could not be completed.")); };
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      if (discarded || size > 5_000_000) { resolve(new Blob()); return; }
      resolve(new Blob(chunks, { type: recorder.mimeType })); chunks.length = 0;
    };
  });
  // A recording error is delivered through finish; never create an unhandled rejection.
  void finished.catch(() => {});
  try { recorder.start(250); } catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
  return {
    async finish(): Promise<WholePhraseRecording> {
      if (recorder.state !== "inactive") recorder.stop();
      const clip = await finished;
      if (discarded || !clip.size) throw new Error("The whole recording was discarded or was too large. Please record again.");
      const context = new AudioContext();
      try {
        const decoded = await context.decodeAudioData(await clip.arrayBuffer());
        if (decoded.duration < 0.5 || decoded.duration > 30) throw new Error("Record one complete sentence lasting 0.5 to 30 seconds.");
        const offline = new OfflineAudioContext(1, Math.round(decoded.duration * 16000), 16000);
        const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
        const rendered = await offline.startRendering();
        if (discarded) throw new Error("The recording was cancelled.");
        const audio = new Blob([pcm16Wav(rendered.getChannelData(0))], { type: "audio/wav" });
        return { audio, durationMs: Math.round(rendered.duration * 1000), release() {} };
      } finally { await context.close(); }
    },
    dispose() {
      discarded = true; chunks.length = 0;
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach(track => track.stop());
    },
  };
}
