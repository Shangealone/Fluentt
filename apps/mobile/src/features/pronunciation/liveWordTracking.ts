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

export type LiveSpeechCallbacks = {
  onStart: () => void;
  onResult: (transcript: string, final: boolean) => void;
  onError: (message: string) => void;
  onEnd: () => void;
};
export type LiveSpeechSession = { start: () => Promise<void>; stop: () => void; dispose: () => void };
