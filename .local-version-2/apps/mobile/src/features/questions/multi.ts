/** Whole-ID sets in content order. No delivery, correction entry, scoring or inferred bounds. */
export type MultiItem = { id: string; prompt: string; instructions: string | null } & (
  | { method: "multiple_select"; content: { options: { id: string; text: string }[] } }
  | { method: "error_identification"; content: { tokens: { id: string; text: string }[] } }
);
export type MultiResponse = { method: "multiple_select"; answer: { option_ids: string[] } }
  | { method: "error_identification"; answer: { selected_token_ids: string[] } };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const identifier = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id) && !/[\r\n]/.test(id);
export const selectionRows = (item: MultiItem) => item.method === "multiple_select" ? item.content.options : item.content.tokens;

export function multiItemFromRevision(value: unknown): MultiItem | null {
  if (!object(value) || typeof value.id !== "string" || !value.id || !object(value.definition)) return null;
  const d = value.definition;
  if (typeof d.prompt !== "string" || !d.prompt.trim() || !object(d.content)
    || !(d.instructions === undefined || d.instructions === null || typeof d.instructions === "string")) return null;
  if (d.method !== "multiple_select" && d.method !== "error_identification") return null;
  const source = d.method === "multiple_select" ? d.content.options : d.content.tokens;
  if (!Array.isArray(source) || source.length < (d.method === "multiple_select" ? 2 : 1)) return null;
  const rows: { id: string; text: string }[] = [];
  for (const row of source) {
    // Offset-based segments are not a supported alternative representation.
    if (!object(row) || Object.keys(row).some(key => !["id", "text"].includes(key))
      || typeof row.id !== "string" || !identifier(row.id) || rows.some(other => other.id === row.id)
      || typeof row.text !== "string" || !row.text.trim()) return null;
    rows.push({ id: row.id, text: row.text });
  }
  const common = { id: value.id, prompt: d.prompt, instructions: (d.instructions as string | null) ?? null };
  return d.method === "multiple_select" ? { ...common, method: d.method, content: { options: rows } }
    : { ...common, method: d.method, content: { tokens: rows } };
}

export function selectedIds(item: MultiItem, value: MultiResponse | null): string[] {
  if (!value || value.method !== item.method) return [];
  const ids = value.method === "multiple_select" ? value.answer.option_ids : value.answer.selected_token_ids;
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => typeof id !== "string" || !selectionRows(item).some(row => row.id === id))) return [];
  return selectionRows(item).filter(row => ids.includes(row.id)).map(row => row.id);
}

export function toggleSelection(item: MultiItem, value: MultiResponse | null, id: string): MultiResponse | null {
  if (!selectionRows(item).some(row => row.id === id)) return value;
  const next = new Set(selectedIds(item, value));
  if (next.has(id)) next.delete(id); else next.add(id);
  const ids = selectionRows(item).filter(row => next.has(row.id)).map(row => row.id);
  return item.method === "multiple_select" ? { method: item.method, answer: { option_ids: ids } }
    : { method: item.method, answer: { selected_token_ids: ids } };
}
