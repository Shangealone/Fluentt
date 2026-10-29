/** Unscored whole-unit sequencing. Presentation order never comes from the private key. */
export type ArrangementItem = { id: string; prompt: string; instructions: string | null;
  method: "word_arrangement" | "sentence_arrangement"; content: { items: { id: string; text: string }[] } };
export type ArrangementResponse = { method: "word_arrangement"; answer: { ordered_token_ids: string[] } }
  | { method: "sentence_arrangement"; answer: { ordered_sentence_ids: string[] } };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function arrangementItemFromRevision(value: unknown): ArrangementItem | null {
  if (!object(value) || typeof value.id !== "string" || !value.id || !object(value.definition)) return null;
  const d = value.definition;
  if ((d.method !== "word_arrangement" && d.method !== "sentence_arrangement") || typeof d.prompt !== "string" || !d.prompt.trim()
    || !(d.instructions === undefined || d.instructions === null || typeof d.instructions === "string") || !object(d.content)
    || !Array.isArray(d.content.items) || d.content.items.length < 2) return null;
  const items: { id: string; text: string }[] = [];
  for (const row of d.content.items) {
    if (!object(row) || typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(row.id) || /[\r\n]/.test(row.id)
      || items.some(other => other.id === row.id) || typeof row.text !== "string" || !row.text.trim()) return null;
    items.push({ id: row.id, text: row.text });
  }
  return { id: value.id, method: d.method, prompt: d.prompt, instructions: (d.instructions as string | null) ?? null, content: { items } };
}
export function validSequence(item: ArrangementItem, ids: unknown): ids is string[] {
  return Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => typeof id === "string" && item.content.items.some(row => row.id === id));
}
export function appendUnit(item: ArrangementItem, ids: string[], id: string): string[] {
  if (!validSequence(item, ids) || ids.includes(id) || !item.content.items.some(row => row.id === id)) return ids;
  return [...ids, id];
}
export function moveUnit(ids: string[], index: number, delta: number): string[] {
  const target = index + delta;
  if (!Number.isInteger(index) || !Number.isInteger(target) || index < 0 || target < 0 || index >= ids.length || target >= ids.length) return ids;
  const next = [...ids]; [next[index], next[target]] = [next[target], next[index]]; return next;
}
export function removeUnit(ids: string[], id: string): string[] { return ids.includes(id) ? ids.filter(key => key !== id) : ids; }
/** Complete structural readiness only, never correctness. Partial buffers remain local. */
export function arrangementResponse(item: ArrangementItem, ids: string[]): ArrangementResponse | null {
  if (!validSequence(item, ids) || ids.length !== item.content.items.length) return null;
  return item.method === "word_arrangement" ? { method: item.method, answer: { ordered_token_ids: [...ids] } }
    : { method: item.method, answer: { ordered_sentence_ids: [...ids] } };
}
