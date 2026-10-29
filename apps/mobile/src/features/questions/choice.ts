/** Key-free, unscored presentation contract. No bank retrieval or submission client. */
export type ChoiceItem = {
  id: string;
  prompt: string;
  instructions: string | null;
} & (
  | { method: "multiple_choice"; content: { options: { id: string; text: string }[] } }
  | { method: "true_false"; content: Record<string, never> }
);
export type ChoiceResponse =
  | { method: "multiple_choice"; answer: { option_id: string } }
  | { method: "true_false"; answer: { value: boolean } };

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Explicit projection, so even an editor payload cannot spread private keys into a view. */
export function choiceItemFromRevision(value: unknown): ChoiceItem | null {
  if (!object(value) || typeof value.id !== "string" || !value.id || !object(value.definition)) return null;
  const d = value.definition;
  if (typeof d.prompt !== "string" || !d.prompt.trim() || !object(d.content)
    || (d.instructions !== undefined && d.instructions !== null && typeof d.instructions !== "string")) return null;
  const common = { id: value.id, prompt: d.prompt, instructions: (d.instructions as string | null) ?? null };
  if (d.method === "true_false" && Object.keys(d.content).length === 0)
    return { ...common, method: "true_false", content: {} };
  if (d.method !== "multiple_choice" || !Array.isArray(d.content.options) || d.content.options.length < 2) return null;
  const options: { id: string; text: string }[] = [];
  for (const option of d.content.options) {
    if (!object(option) || typeof option.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(option.id)
      || typeof option.text !== "string" || !option.text.trim() || options.some(row => row.id === option.id)) return null;
    options.push({ id: option.id, text: option.text });
  }
  return { ...common, method: "multiple_choice", content: { options } };
}

export function selectChoice(item: ChoiceItem, current: ChoiceResponse | null, choice: string | boolean): ChoiceResponse | null {
  if (item.method === "multiple_choice") {
    if (typeof choice !== "string" || !item.content.options.some(option => option.id === choice)) return current;
    if (current?.method === item.method && current.answer.option_id === choice) return current;
    return { method: item.method, answer: { option_id: choice } };
  }
  if (typeof choice !== "boolean") return current;
  if (current?.method === item.method && current.answer.value === choice) return current;
  return { method: item.method, answer: { value: choice } };
}

export function selectedChoice(item: ChoiceItem, response: ChoiceResponse | null): string | boolean | null {
  if (item.method === "true_false" && response?.method === item.method && typeof response.answer.value === "boolean")
    return response.answer.value;
  if (item.method === "multiple_choice" && response?.method === item.method
    && item.content.options.some(option => option.id === response.answer.option_id)) return response.answer.option_id;
  return null;
}
