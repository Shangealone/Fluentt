export type ChoiceMethod = "multiple_choice" | "true_false";
export type ArrangementMethod = "word_arrangement" | "sentence_arrangement";
export type AuthorMethod = ChoiceMethod | "identification" | "fill_in_the_blank" | "multiple_select" | "error_identification" | ArrangementMethod | "matching_type" | "flashcards";
export type Pair = { left_id: string; right_id: string };
export type TextContent = { input_max_length?: number };
export type BlankContent = TextContent & { blank_ids: string[]; template_syntax?: "double-brace-v1" };
export type Option = { id: string; text: string };
export type PublicDefinition = {
  lesson_id: string; language: "english" | "tagalog"; prompt: string; instructions: string | null;
  difficulty: "easy" | "medium" | "hard"; points: string; schema_version: 1;
} & ({ method: "multiple_choice"; content: { options: Option[] } }
  | { method: "true_false"; content: Record<string, never> }
  | { method: "identification"; content: TextContent }
  | { method: "fill_in_the_blank"; content: BlankContent }
  | { method: "multiple_select"; content: { options: Option[] } }
  | { method: "error_identification"; content: { tokens: Option[] } }
  | { method: "word_arrangement"; content: { items: Option[] } }
  | { method: "sentence_arrangement"; content: { items: Option[] } }
  | { method: "matching_type"; content: { left: Option[]; right: Option[] } }
  | { method: "flashcards"; content: { cue: string } });
export type Definition = PublicDefinition & { competency_ids: string[]; grading_version: "ungraded-v1"; explanation: string | null }
  & ({ method: "multiple_choice"; answer_key: { correct_option_id: string } }
    | { method: "true_false"; answer_key: { value: boolean } }
    | { method: "identification"; answer_key: { accepted_answers: string[]; case_sensitive: boolean } }
    | { method: "fill_in_the_blank"; answer_key: { accepted_answers: Record<string, string[]> } }
    | { method: "multiple_select"; answer_key: { correct_option_ids: string[] } }
    | { method: "error_identification"; answer_key: { error_token_ids: string[]; accepted_corrections: Record<string, string[]> } }
    | { method: ArrangementMethod; answer_key: { ordered_ids: string[] } }
    | { method: "matching_type"; answer_key: { pairs: Pair[] } }
    | { method: "flashcards"; answer_key: { back: string; scoring_rubric_version: string | null } });
export type Revision = { id: string; question_id: string; version: number; revision: string;
  status: "draft" | "published" | "archived"; locked_at: string | null; competency_ids: string[]; definition: PublicDefinition };
export type Item = { id: string; revision: string; status: "draft" | "published" | "archived"; prompt: string | null;
  method: string | null; latest_revision_id: string | null; latest_version: number | null };
export type Page<T> = { items: T[]; has_more: boolean; offset: number; limit: number };
export type Draft = { method: AuthorMethod; lesson_id: string; language: string; prompt: string; instructions: string;
  difficulty: string; points: string; competencies: string; explanation: string; options: Option[];
  correct: string; boolean: string; inputLimit: string; acceptedAnswers: string; caseSensitive: boolean;
  blanks: { id: string; answers: string }[]; templateSyntax: boolean; targets: string[]; corrections: string; order: string[];
  left: Option[]; right: Option[]; pairs: Pair[]; cue: string; back: string; rubricVersion: string };
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const marker = /^[0-9a-f]{64}$/;
export const methods: AuthorMethod[] = ["multiple_choice", "true_false", "identification", "fill_in_the_blank", "multiple_select", "flashcards", "error_identification", "word_arrangement", "sentence_arrangement", "matching_type"];
export const methodName = (method: string) => ({ multiple_choice: "Multiple Choice", true_false: "True or False",
  identification: "Identification", fill_in_the_blank: "Fill in the Blank", multiple_select: "Multiple Select",
  error_identification: "Error Identification", word_arrangement: "Word Arrangement", sentence_arrangement: "Sentence Arrangement", matching_type: "Matching Type", flashcards: "Flashcards" })[method] ?? "Method unavailable in this editor";
export const isArrangement = (method: string): method is ArrangementMethod => method === "word_arrangement" || method === "sentence_arrangement";
export function validOrder(items: Option[], ids: string[], complete = false): boolean {
  return Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => items.some(row => row.id === id))
    && (!complete || ids.length === items.length);
}
export function moveIds(ids: string[], index: number, delta: number): string[] {
  const target = index + delta;
  if (!Number.isInteger(index) || !Number.isInteger(target) || index < 0 || target < 0 || index >= ids.length || target >= ids.length) return ids;
  const next = [...ids]; [next[index], next[target]] = [next[target], next[index]]; return next;
}
export const validIdentifier = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id) && !/[\r\n]/.test(id);
export function validPairs(left: Option[], right: Option[], pairs: Pair[], complete = false): boolean {
  return Array.isArray(pairs) && new Set(pairs.map(pair => pair.left_id)).size === pairs.length
    && new Set(pairs.map(pair => pair.right_id)).size === pairs.length
    && pairs.every(pair => left.some(row => row.id === pair.left_id) && right.some(row => row.id === pair.right_id))
    && (!complete || pairs.length === left.length && pairs.length === right.length);
}
export function assignPair(left: Option[], right: Option[], pairs: Pair[], leftId: string, rightId: string): Pair[] {
  if (!validPairs(left, right, pairs) || !left.some(row => row.id === leftId) || !right.some(row => row.id === rightId)) return pairs;
  const next = [...pairs.filter(pair => pair.left_id !== leftId && pair.right_id !== rightId), { left_id: leftId, right_id: rightId }];
  return left.flatMap(row => next.filter(pair => pair.left_id === row.id).map(pair => ({ ...pair })));
}
export function editMatchSide(d: Draft, side: "left" | "right", rows: Option[]): Draft {
  return { ...d, [side]: rows, pairs: d.pairs.filter(pair => rows.some(row => row.id === (side === "left" ? pair.left_id : pair.right_id))) };
}
export const codepoints = (text: string) => Array.from(text).length;
export function templateIds(prompt: string): string[] {
  const ids: string[] = []; let cursor = 0;
  for (const match of prompt.matchAll(/\{\{([A-Za-z0-9_-]{1,80})\}\}/g)) {
    if (/[{}]/.test(prompt.slice(cursor, match.index))) throw new Error("Use exact {{blank_id}} markers; braces are reserved.");
    ids.push(match[1]); cursor = match.index! + match[0].length;
  }
  if (/[{}]/.test(prompt.slice(cursor))) throw new Error("Use exact {{blank_id}} markers; braces are reserved.");
  return ids;
}
const answers = (text: string) => text.split(/\r?\n/).map(row => row.trim()).filter(Boolean);
export function orderedBlanks(d: Draft): Draft["blanks"] {
  if (!d.templateSyntax) return d.blanks;
  const ids = templateIds(d.prompt);
  if (ids.length !== d.blanks.length || new Set(ids).size !== ids.length || ids.some(id => !d.blanks.some(row => row.id === id)))
    throw new Error("Include every gap exactly once using its stable ID; no unknown gaps.");
  return ids.map(id => d.blanks.find(row => row.id === id)!);
}
// A gateway/server failure cannot establish that a non-idempotent POST did not commit.
export const saveNeedsReconciliation = (status?: number) => status === undefined || status >= 500 || status === 408;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function isRevision(value: unknown): value is Revision {
  if (!record(value) || typeof value.id !== "string" || !uuid.test(value.id) || typeof value.question_id !== "string"
    || !uuid.test(value.question_id) || !Number.isInteger(value.version) || typeof value.revision !== "string" || !marker.test(value.revision)
    || !["draft", "published", "archived"].includes(String(value.status)) || !Array.isArray(value.competency_ids)
    || !(value.locked_at === null || typeof value.locked_at === "string") || !record(value.definition)) return false;
  const d = value.definition;
  if (typeof d.prompt !== "string" || !d.prompt.trim() || !record(d.content) || d.schema_version !== 1
    || typeof d.lesson_id !== "string" || !uuid.test(d.lesson_id) || !["english", "tagalog"].includes(String(d.language))
    || typeof d.points !== "string" || !(d.instructions === null || typeof d.instructions === "string")) return false;
  if (d.method === "true_false") return Object.keys(d.content).length === 0;
  if (d.method === "flashcards") return typeof d.content.cue === "string" && !!d.content.cue.trim()
    && Object.keys(d.content).length === 1;
  if (d.method === "matching_type") {
    const sides = [d.content.left, d.content.right];
    return sides.every(rows => Array.isArray(rows) && rows.length >= 2 && new Set(rows.map(row => record(row) ? row.id : null)).size === rows.length
      && rows.every(row => record(row) && typeof row.id === "string" && validIdentifier(row.id) && typeof row.text === "string" && !!row.text.trim()))
      && (d.content.left as unknown[]).length === (d.content.right as unknown[]).length;
  }
  if (d.method === "identification" || d.method === "fill_in_the_blank") {
    const limit = d.content.input_max_length;
    if (limit !== undefined && (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 2000)) return false;
    if (Object.keys(d.content).some(key => !["input_max_length", ...(d.method === "fill_in_the_blank" ? ["blank_ids", "template_syntax"] : [])].includes(key))) return false;
    if (d.method === "identification") return true;
    const ids = d.content.blank_ids;
    if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) || new Set(ids).size !== ids.length) return false;
    if (d.content.template_syntax === undefined) return true;
    if (d.content.template_syntax !== "double-brace-v1") return false;
    try { return JSON.stringify(templateIds(d.prompt)) === JSON.stringify(ids); } catch { return false; }
  }
  const rows = d.method === "error_identification" ? d.content.tokens : isArrangement(String(d.method)) ? d.content.items : d.content.options;
  if (!["multiple_choice", "multiple_select", "error_identification", "word_arrangement", "sentence_arrangement"].includes(String(d.method)) || !Array.isArray(rows)
    || rows.length < (d.method === "error_identification" ? 1 : 2)) return false;
  const ids = new Set<string>();
  return rows.every(option => {
    if (!record(option) || typeof option.id !== "string" || !validIdentifier(option.id)
      || ids.has(option.id) || typeof option.text !== "string" || !option.text.trim()) return false;
    ids.add(option.id); return true;
  });
}
export function isItem(value: unknown): value is Item {
  return record(value) && typeof value.id === "string" && uuid.test(value.id) && typeof value.revision === "string"
    && marker.test(value.revision) && ["draft", "published", "archived"].includes(String(value.status))
    && (value.prompt === null || typeof value.prompt === "string") && (value.latest_revision_id === null
      || (typeof value.latest_revision_id === "string" && uuid.test(value.latest_revision_id)));
}
export function newDraft(method: AuthorMethod): Draft {
  return { method, lesson_id: "", language: "", prompt: "", instructions: "", difficulty: "medium", points: "1",
    competencies: "", explanation: "", options: isArrangement(method) ? [{ id: "unit_1", text: "" }, { id: "unit_2", text: "" }]
      : method === "error_identification" ? [{ id: "segment_1", text: "" }]
      : [{ id: "option_1", text: "" }, { id: "option_2", text: "" }], correct: "", boolean: "",
    inputLimit: "500", acceptedAnswers: "", caseSensitive: false, blanks: [{ id: "gap_1", answers: "" }], templateSyntax: true,
    targets: [], corrections: "{}", order: [], left: [{ id: "left_1", text: "" }, { id: "left_2", text: "" }],
    right: [{ id: "right_1", text: "" }, { id: "right_2", text: "" }], pairs: [], cue: "", back: "", rubricVersion: "" };
}
export function draftFromDefinition(d: Definition): Draft {
  return { method: d.method, lesson_id: d.lesson_id, language: d.language, prompt: d.prompt, instructions: d.instructions ?? "",
    difficulty: d.difficulty, points: d.points, competencies: d.competency_ids.join("\n"), explanation: d.explanation ?? "",
    options: d.method === "multiple_choice" || d.method === "multiple_select" ? d.content.options.map(option => ({ ...option }))
      : d.method === "error_identification" ? d.content.tokens.map(option => ({ ...option })) : "items" in d.content ? d.content.items.map(option => ({ ...option })) : [],
    correct: d.method === "multiple_choice" ? d.answer_key.correct_option_id : "",
    boolean: d.method === "true_false" ? String(d.answer_key.value) : "",
    inputLimit: (d.method === "identification" || d.method === "fill_in_the_blank") && d.content.input_max_length !== undefined ? String(d.content.input_max_length) : "",
    acceptedAnswers: d.method === "identification" ? d.answer_key.accepted_answers.join("\n") : "",
    caseSensitive: d.method === "identification" ? d.answer_key.case_sensitive : false,
    blanks: d.method === "fill_in_the_blank" ? d.content.blank_ids.map(id => ({ id, answers: d.answer_key.accepted_answers[id].join("\n") })) : [],
    templateSyntax: d.method === "fill_in_the_blank" && d.content.template_syntax === "double-brace-v1",
    targets: d.method === "multiple_select" ? [...d.answer_key.correct_option_ids] : d.method === "error_identification" ? [...d.answer_key.error_token_ids] : [],
    corrections: d.method === "error_identification" ? JSON.stringify(d.answer_key.accepted_corrections ?? {}, null, 2) : "{}",
    order: "ordered_ids" in d.answer_key ? [...d.answer_key.ordered_ids] : [],
    left: d.method === "matching_type" ? d.content.left.map(row => ({ ...row })) : [],
    right: d.method === "matching_type" ? d.content.right.map(row => ({ ...row })) : [],
    pairs: d.method === "matching_type" ? d.answer_key.pairs.map(pair => ({ ...pair })) : [],
    cue: d.method === "flashcards" ? d.content.cue : "", back: d.method === "flashcards" ? d.answer_key.back : "",
    rubricVersion: d.method === "flashcards" ? d.answer_key.scoring_rubric_version ?? "" : "" };
}
export function validateDraft(d: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!uuid.test(d.lesson_id.trim())) errors.lesson_id = "Enter an existing lesson UUID from Curriculum.";
  if (!["english", "tagalog"].includes(d.language)) errors.language = "Choose a learning language.";
  if (!d.prompt.trim() || d.prompt.trim().length > 8000) errors.prompt = "Enter a prompt of 1–8,000 characters.";
  for (const field of ["instructions", "explanation"] as const) if (d[field].trim().length > 8000) errors[field] = "Use at most 8,000 characters.";
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(d.points)) errors.points = "Use a nonnegative amount with at most two decimal places (maximum 99,999,999.99).";
  if (!["easy", "medium", "hard"].includes(d.difficulty)) errors.difficulty = "Choose an existing metadata label.";
  const ids = d.competencies.split(/[\s,]+/).filter(Boolean);
  if (ids.length > 200 || ids.some(id => !uuid.test(id)) || new Set(ids.map(id => id.toLowerCase())).size !== ids.length)
    errors.competencies = "Use at most 200 distinct competency UUIDs from the same lesson.";
  if (d.method === "multiple_choice" || d.method === "multiple_select" || d.method === "error_identification" || isArrangement(d.method)) {
    const token = d.method === "error_identification";
    if (d.options.length < (token ? 1 : 2)) errors.options = token ? "Add at least one segment." : "Add at least two options.";
    const seen = new Set<string>();
    d.options.forEach((option, index) => {
      if (!validIdentifier(option.id) || seen.has(option.id)) errors.options = "Each option/segment needs a unique stable ID.";
      seen.add(option.id);
      if (!option.text.trim()) errors[`option_${index}`] = "Enter this option/segment's text.";
    });
    if (isArrangement(d.method)) {
      if (!validOrder(d.options, d.order, true)) errors.order = "Include every stable unit ID exactly once in the private expected sequence.";
    } else if (d.method === "multiple_choice") {
      if (!d.options.some(option => option.id === d.correct)) errors.correct = "Choose exactly one correct option.";
    } else if (!d.targets.length || new Set(d.targets).size !== d.targets.length || d.targets.some(id => !seen.has(id)))
      errors.correct = "Select at least one distinct existing correct option/target segment.";
    if (token) {
      try {
        const map: unknown = JSON.parse(d.corrections);
        if (!record(map) || Object.entries(map).some(([id, group]) => !seen.has(id) || !Array.isArray(group)
          || group.some(value => typeof value !== "string" || !value.trim()))) throw new Error();
      } catch { errors.corrections = "Use a JSON object mapping known segment IDs to arrays of nonblank strings. Empty object/arrays are valid metadata."; }
    }
  } else if (d.method === "matching_type") {
    for (const side of ["left", "right"] as const) {
      if (d[side].length < 2 || new Set(d[side].map(row => row.id)).size !== d[side].length || d[side].some(row => !validIdentifier(row.id)))
        errors[side] = "Use at least two entries with distinct stable IDs on each side.";
      d[side].forEach((row, index) => { if (!row.text.trim()) errors[`${side}_${index}`] = "Enter this item's text."; });
    }
    if (!validPairs(d.left, d.right, d.pairs, true)) errors.pairs = "Match every left and right item exactly once. Both sides must have the same count.";
  } else if (d.method === "flashcards") {
    if (!d.cue.trim()) errors.cue = "Enter the front/cue text.";
    if (!d.back.trim()) errors.back = "Enter the private back text.";
  } else if (d.method === "true_false") {
    if (!["true", "false"].includes(d.boolean)) errors.boolean = "Choose the defined correct boolean answer.";
  } else {
    if (d.inputLimit !== "" && (!/^[1-9]\d*$/.test(d.inputLimit) || Number(d.inputLimit) > 2000)) errors.inputLimit = "Use 1–2,000 Unicode code points, or leave blank for no declared limit.";
    const check = (text: string, key: string) => {
      const values = answers(text);
      if (!values.length) errors[key] = "Enter at least one expected answer, one per line.";
      else if (d.inputLimit && values.some(value => codepoints(value) > Number(d.inputLimit))) errors[key] = "Expected answers must fit the declared input limit.";
    };
    if (d.method === "identification") check(d.acceptedAnswers, "acceptedAnswers");
    else {
      if (!d.blanks.length || new Set(d.blanks.map(row => row.id)).size !== d.blanks.length || d.blanks.some(row => !/^[A-Za-z0-9_-]{1,80}$/.test(row.id))) errors.blanks = "Define at least one gap with distinct stable IDs.";
      d.blanks.forEach((row, index) => check(row.answers, `blank_${index}`));
      try { orderedBlanks(d); } catch (cause) { errors.prompt = cause instanceof Error ? cause.message : "Invalid gap template."; }
    }
  }
  return errors;
}
export function definitionFromDraft(d: Draft): Definition {
  const errors = validateDraft(d);
  if (Object.keys(errors).length) throw new Error("Complete the marked fields.");
  const common = { lesson_id: d.lesson_id.trim(), language: d.language as "english" | "tagalog", prompt: d.prompt.trim(),
    instructions: d.instructions.trim() || null, difficulty: d.difficulty as Definition["difficulty"], points: d.points,
    schema_version: 1 as const, competency_ids: d.competencies.split(/[\s,]+/).filter(Boolean), grading_version: "ungraded-v1" as const,
    explanation: d.explanation.trim() || null };
  if (d.method === "multiple_choice") return { ...common, method: d.method,
    content: { options: d.options.map(option => ({ id: option.id, text: option.text.trim() })) }, answer_key: { correct_option_id: d.correct } };
  if (d.method === "true_false") return { ...common, method: d.method, content: {}, answer_key: { value: d.boolean === "true" } };
  if (d.method === "flashcards") return { ...common, method: d.method, content: { cue: d.cue.trim() },
    answer_key: { back: d.back.trim(), scoring_rubric_version: d.rubricVersion.trim() || null } };
  if (d.method === "matching_type") return { ...common, method: d.method,
    content: { left: d.left.map(row => ({ id: row.id, text: row.text.trim() })), right: d.right.map(row => ({ id: row.id, text: row.text.trim() })) },
    answer_key: { pairs: d.left.map(row => ({ ...d.pairs.find(pair => pair.left_id === row.id)! })) } };
  if (isArrangement(d.method)) return { ...common, method: d.method,
    content: { items: d.options.map(row => ({ id: row.id, text: row.text.trim() })) }, answer_key: { ordered_ids: [...d.order] } };
  if (d.method === "multiple_select" || d.method === "error_identification") {
    const rows = d.options.map(row => ({ id: row.id, text: row.text.trim() }));
    const targets = rows.filter(row => d.targets.includes(row.id)).map(row => row.id);
    return d.method === "multiple_select" ? { ...common, method: d.method, content: { options: rows }, answer_key: { correct_option_ids: targets } }
      : { ...common, method: d.method, content: { tokens: rows }, answer_key: { error_token_ids: targets, accepted_corrections: JSON.parse(d.corrections) } };
  }
  const limits = d.inputLimit ? { input_max_length: Number(d.inputLimit) } : {};
  if (d.method === "identification") return { ...common, method: d.method, content: limits,
    answer_key: { accepted_answers: answers(d.acceptedAnswers), case_sensitive: d.caseSensitive } };
  const blanks = orderedBlanks(d);
  return { ...common, method: d.method, content: { ...limits, blank_ids: blanks.map(row => row.id), ...(d.templateSyntax ? { template_syntax: "double-brace-v1" as const } : {}) },
    answer_key: { accepted_answers: Object.fromEntries(blanks.map(row => [row.id, answers(row.answers)])) } };
}
/** Allowlist projection for the unscored preview. Never spread an author definition. */
export function publicDefinition(d: PublicDefinition): PublicDefinition {
  const common = { lesson_id: d.lesson_id, language: d.language, prompt: d.prompt, instructions: d.instructions,
    difficulty: d.difficulty, points: d.points, schema_version: d.schema_version };
  if (d.method === "multiple_choice" || d.method === "multiple_select") return { ...common, method: d.method,
    content: { options: d.content.options.map(option => ({ id: option.id, text: option.text })) } };
  if (d.method === "true_false") return { ...common, method: d.method, content: {} };
  if (d.method === "flashcards") return { ...common, method: d.method, content: { cue: d.content.cue } };
  if (d.method === "matching_type") return { ...common, method: d.method, content: {
    left: d.content.left.map(row => ({ id: row.id, text: row.text })), right: d.content.right.map(row => ({ id: row.id, text: row.text })) } };
  if (d.method === "error_identification") return { ...common, method: d.method, content: { tokens: d.content.tokens.map(row => ({ id: row.id, text: row.text })) } };
  if (d.method === "word_arrangement" || d.method === "sentence_arrangement") return { ...common, method: d.method, content: { items: d.content.items.map(row => ({ id: row.id, text: row.text })) } };
  const limits = d.content.input_max_length !== undefined ? { input_max_length: d.content.input_max_length } : {};
  if (d.method === "identification") return { ...common, method: d.method, content: limits };
  return { ...common, method: d.method, content: { ...limits, blank_ids: [...d.content.blank_ids],
    ...(d.content.template_syntax ? { template_syntax: d.content.template_syntax } : {}) } };
}
export function moveOption(d: Draft, index: number, delta: number): Draft {
  const next = index + delta;
  if (index < 0 || next < 0 || index >= d.options.length || next >= d.options.length) return d;
  const options = [...d.options]; [options[index], options[next]] = [options[next], options[index]];
  return { ...d, options };
}

export function toggleTarget(d: Draft, id: string): Draft {
  if (!d.options.some(row => row.id === id)) return d;
  const selected = new Set(d.targets);
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  return { ...d, targets: d.options.filter(row => selected.has(row.id)).map(row => row.id) };
}

export function removeOption(d: Draft, id: string): Draft {
  if (d.options.length <= (d.method === "error_identification" ? 1 : 2)) return d;
  let corrections = d.corrections;
  if (d.method === "error_identification") {
    try {
      const map: unknown = JSON.parse(corrections);
      if (record(map)) corrections = JSON.stringify(Object.fromEntries(Object.entries(map).filter(([key]) => key !== id)), null, 2);
    } catch { /* Retain invalid editor input for an explicit correction. */ }
  }
  return { ...d, options: d.options.filter(row => row.id !== id), correct: d.correct === id ? "" : d.correct,
    targets: d.targets.filter(key => key !== id), corrections, order: d.order.filter(key => key !== id) };
}
