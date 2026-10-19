/** Key-free text interactions only. No fetching, normalization, scoring or submission. */
export type TextItem = { id: string; prompt: string; instructions: string | null } & (
  | { method: "identification"; content: { input_max_length?: number } }
  | { method: "fill_in_the_blank"; content: { blank_ids: string[]; input_max_length?: number; template_syntax?: "double-brace-v1" } }
);
export type TextResponse = { method: "identification"; answer: { text: string } }
  | { method: "fill_in_the_blank"; answer: { blanks: { blank_id: string; text: string }[] } };
export type TextValues = Record<string, string>;
export const codepoints = (value: string) => Array.from(value).length;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function templateIds(prompt: string): string[] {
  const ids: string[] = []; let cursor = 0;
  for (const match of prompt.matchAll(/\{\{([A-Za-z0-9_-]{1,80})\}\}/g)) {
    if (/[{}]/.test(prompt.slice(cursor, match.index))) throw new Error("Malformed blank placeholder");
    ids.push(match[1]); cursor = match.index! + match[0].length;
  }
  if (/[{}]/.test(prompt.slice(cursor))) throw new Error("Malformed blank placeholder");
  return ids;
}
export function textItemFromRevision(value: unknown): TextItem | null {
  if (!object(value) || typeof value.id !== "string" || !value.id || !object(value.definition)) return null;
  const d = value.definition;
  if (typeof d.prompt !== "string" || !d.prompt.trim() || !object(d.content)
    || !(d.instructions === undefined || d.instructions === null || typeof d.instructions === "string")) return null;
  const common = { id: value.id, prompt: d.prompt, instructions: (d.instructions as string | null) ?? null };
  const limit = d.content.input_max_length;
  if (limit !== undefined && (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 2000)) return null;
  const limits = limit === undefined ? {} : { input_max_length: limit };
  if (d.method === "identification") return { ...common, method: d.method, content: limits };
  if (d.method !== "fill_in_the_blank" || !Array.isArray(d.content.blank_ids)) return null;
  const ids = d.content.blank_ids;
  if (!ids.length || ids.some(id => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) || new Set(ids).size !== ids.length) return null;
  const syntax = d.content.template_syntax;
  if (syntax !== undefined) {
    if (syntax !== "double-brace-v1") return null;
    try { if (JSON.stringify(templateIds(d.prompt)) !== JSON.stringify(ids)) return null; } catch { return null; }
  }
  return { ...common, method: d.method, content: { ...limits, blank_ids: [...ids], ...(syntax ? { template_syntax: syntax } : {}) } };
}
export const fieldIds = (item: TextItem) => item.method === "identification" ? ["text"] : item.content.blank_ids;
export function textErrors(item: TextItem, values: TextValues): Record<string, string> {
  const errors: Record<string, string> = Object.create(null);
  const ids = fieldIds(item), limit = item.content.input_max_length;
  if (Object.keys(values).some(id => !ids.includes(id))) errors._response = "Unknown response field.";
  for (const id of ids) {
    const value = Object.hasOwn(values, id) ? values[id] : "";
    if (typeof value !== "string" || !value.trim()) errors[id] = "Enter an answer.";
    else if (limit !== undefined && codepoints(value) > limit) errors[id] = `Use at most ${limit} Unicode code points. Your text is kept for correction.`;
  }
  return errors;
}
/** Complete, exact mapping in item order; raw buffers are never trimmed or transformed. */
export function textResponse(item: TextItem, values: TextValues): TextResponse | null {
  if (Object.keys(textErrors(item, values)).length) return null;
  return item.method === "identification" ? { method: item.method, answer: { text: values.text } }
    : { method: item.method, answer: { blanks: item.content.blank_ids.map(blank_id => ({ blank_id, text: values[blank_id] })) } };
}
export function textPrompt(item: TextItem): string {
  return item.method === "fill_in_the_blank" && item.content.template_syntax
    ? item.prompt.replace(/\{\{([A-Za-z0-9_-]{1,80})\}\}/g, (_, id) => `[Gap ${item.content.blank_ids.indexOf(id) + 1}]`) : item.prompt;
}
