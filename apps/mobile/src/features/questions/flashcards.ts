/** Local unscored practice only. Adapters project data; they never authorize access. */
export type Recall = "again" | "hard" | "good" | "easy";
export const recallLabels: Record<Recall, string> = { again: "Again — could not recall", hard: "Hard — recalled with difficulty",
  good: "Good — recalled with some effort", easy: "Easy — recalled readily" };
export type FlashcardFront = { id: string; lesson_id: string; method: "flashcards"; prompt: string; instructions: string | null; cue: string };
/** Supplied separately by a future authorized practice host, never a public bank DTO. */
export type FlashcardBack = { revision_id: string; back: string };
export type FlashcardResponse = { method: "flashcards"; answer: { recall: Recall } };
export type FlashcardState = { revealed: boolean; recall: Recall | null };
export const initialCardState = (): FlashcardState => ({ revealed: false, recall: null });
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function flashcardFrontFromRevision(value: unknown): FlashcardFront | null {
  if (!object(value) || typeof value.id !== "string" || !value.id || !object(value.definition)) return null;
  const d = value.definition;
  if (d.method !== "flashcards" || typeof d.lesson_id !== "string" || !d.lesson_id || typeof d.prompt !== "string" || !d.prompt.trim()
    || !(d.instructions === undefined || d.instructions === null || typeof d.instructions === "string")
    || !object(d.content) || typeof d.content.cue !== "string" || !d.content.cue.trim()) return null;
  return { id: value.id, lesson_id: d.lesson_id, method: "flashcards", prompt: d.prompt, instructions: d.instructions as string | null ?? null, cue: d.content.cue };
}
export function usableBack(front: FlashcardFront, back: unknown): back is FlashcardBack {
  return object(back) && back.revision_id === front.id && typeof back.back === "string" && !!back.back.trim();
}
export function revealCard(front: FlashcardFront, back: FlashcardBack | null, state: FlashcardState): FlashcardState {
  return usableBack(front, back) && !state.revealed ? { ...state, revealed: true } : state;
}
export function rateCard(state: FlashcardState, recall: unknown): FlashcardState {
  if (!state.revealed || state.recall !== null || typeof recall !== "string" || !Object.hasOwn(recallLabels, recall)) return state;
  return { ...state, recall: recall as Recall };
}
export function flashcardResponse(state: FlashcardState): FlashcardResponse | null {
  return state.revealed && state.recall !== null && Object.hasOwn(recallLabels, state.recall)
    ? { method: "flashcards", answer: { recall: state.recall } } : null;
}
export type PracticeCard = { front: FlashcardFront; back: FlashcardBack | null };
export function validDeck(cards: PracticeCard[]): boolean {
  return Array.isArray(cards) && new Set(cards.map(card => card?.front?.id)).size === cards.length
    && cards.every(card => card && flashcardFrontFromRevision({ id: card.front?.id, definition: { ...card.front, content: { cue: card.front?.cue } } }) !== null);
}
