/** Existing V1 one-to-one matching. No key, grader or delivery capability. */
export type MatchUnit = { id: string; text: string };
export type MatchPair = { left_id: string; right_id: string };
export type MatchingItem = { id: string; method: "matching_type"; prompt: string; instructions: string | null;
  content: { left: MatchUnit[]; right: MatchUnit[] } };
export type MatchingResponse = { method: "matching_type"; answer: { pairs: MatchPair[] } };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function matchingItemFromRevision(value: unknown): MatchingItem | null {
  if (!object(value) || typeof value.id !== "string" || !value.id || !object(value.definition)) return null;
  const d = value.definition;
  if (d.method !== "matching_type" || typeof d.prompt !== "string" || !d.prompt.trim() || !object(d.content)
    || !(d.instructions === undefined || d.instructions === null || typeof d.instructions === "string")) return null;
  function side(rows: unknown): MatchUnit[] | null {
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const result: MatchUnit[] = [];
    for (const row of rows) {
      if (!object(row) || typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(row.id) || /[\r\n]/.test(row.id)
        || result.some(other => other.id === row.id) || typeof row.text !== "string" || !row.text.trim()) return null;
      result.push({ id: row.id, text: row.text });
    }
    return result;
  }
  const left = side(d.content.left), right = side(d.content.right);
  if (!left || !right || left.length !== right.length) return null;
  return { id: value.id, method: d.method, prompt: d.prompt, instructions: d.instructions as string | null ?? null, content: { left, right } };
}
export function validMatches(item: MatchingItem, pairs: unknown): pairs is MatchPair[] {
  return Array.isArray(pairs) && pairs.every(pair => object(pair) && typeof pair.left_id === "string" && typeof pair.right_id === "string"
    && item.content.left.some(row => row.id === pair.left_id) && item.content.right.some(row => row.id === pair.right_id))
    && new Set(pairs.map(pair => pair.left_id)).size === pairs.length && new Set(pairs.map(pair => pair.right_id)).size === pairs.length;
}
/** Reassigning a used target clears its previous owner; retain authored left order. */
export function assignMatch(item: MatchingItem, pairs: MatchPair[], left: string, right: string): MatchPair[] {
  if (!validMatches(item, pairs) || !item.content.left.some(row => row.id === left) || !item.content.right.some(row => row.id === right)) return pairs;
  if (pairs.some(pair => pair.left_id === left && pair.right_id === right)) return pairs;
  const next = [...pairs.filter(pair => pair.left_id !== left && pair.right_id !== right), { left_id: left, right_id: right }];
  return item.content.left.flatMap(row => next.filter(pair => pair.left_id === row.id).map(pair => ({ ...pair })));
}
/** Readiness only. Partial local buffers do not produce a complete response. */
export function matchingResponse(item: MatchingItem, pairs: MatchPair[]): MatchingResponse | null {
  if (!validMatches(item, pairs) || pairs.length !== item.content.left.length || pairs.length !== item.content.right.length) return null;
  return { method: "matching_type", answer: { pairs: item.content.left.map(row => ({ ...pairs.find(pair => pair.left_id === row.id)! })) } };
}
