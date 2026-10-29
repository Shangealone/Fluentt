/** Speech-display matching only. This is not the question-bank or pronunciation grading policy. */
export function speechWords(text: string): string[] {
  return text.normalize("NFC").toLocaleLowerCase().replace(/[’‘]/g, "'").match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu) ?? [];
}

/** Track words in spoken order; fillers/restarts do not advance an unheard target word. */
export function spokenWordCount(target: string, transcript: string): number {
  const expected = speechWords(target), heard = speechWords(transcript);
  let position = 0;
  for (const word of heard) if (position < expected.length && word === expected[position]) position++;
  return position;
}

export type SpeechWordMatch = "matched" | "mismatched" | "pending";

/** Align recognized words to the phrase so one mismatch does not block later words. */
export function alignSpokenWords(target: string, transcript: string, finalized = false): SpeechWordMatch[] {
  const expected = speechWords(target), heard = speechWords(transcript);
  const matches: SpeechWordMatch[] = expected.map(() => "pending");
  if (!expected.length || !heard.length) return matches;

  const costs = Array.from({ length: expected.length + 1 }, () => Array<number>(heard.length + 1).fill(0));
  for (let i = 0; i <= expected.length; i++) costs[i][0] = i;
  for (let j = 0; j <= heard.length; j++) costs[0][j] = j;
  for (let i = 1; i <= expected.length; i++) {
    for (let j = 1; j <= heard.length; j++) {
      const substitution = costs[i - 1][j - 1] + (expected[i - 1] === heard[j - 1] ? 0 : 1);
      costs[i][j] = Math.min(substitution, costs[i - 1][j] + 1, costs[i][j - 1] + 1);
    }
  }

  let i = expected.length, j = heard.length;
  while (i > 0 || j > 0) {
    const best = costs[i][j];
    if (i > 0 && j > 0 && expected[i - 1] === heard[j - 1] && costs[i - 1][j - 1] === best) {
      matches[i - 1] = "matched";
      i--; j--;
    } else if (j > 0 && costs[i][j - 1] + 1 === best) {
      // Ignore extra recognized words while preserving later exact matches.
      j--;
    } else if (i > 0 && j > 0 && costs[i - 1][j - 1] + 1 === best) {
      matches[i - 1] = "mismatched";
      i--; j--;
    } else if (i > 0 && costs[i - 1][j] + 1 === best) {
      // Missing words stay neutral until recognition has settled.
      matches[i - 1] = finalized ? "mismatched" : "pending";
      i--;
    } else if (j > 0) {
      j--;
    } else {
      i--;
    }
  }

  return matches;
}

export type WholePhraseRecording = {
  audio: import("../../services/api/pronunciation").AudioUploadPayload;
  durationMs: number;
  release: () => void | Promise<void>;
};
export type LiveSpeechOptions = { captureAudio?: boolean };
export type LiveSpeechCallbacks = {
  onStart: () => void;
  onResult: (transcript: string, final: boolean) => void;
  onError: (message: string) => void;
  onEnd: () => void;
  onRecording?: (recording: WholePhraseRecording) => void;
};
export type LiveSpeechSession = { start: () => Promise<void>; stop: () => void; dispose: () => void };
