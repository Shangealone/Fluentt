import { useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { Text } from "../../accessibility/Primitives";
import { assignmentMethods, type AssignmentMethod, type AssignmentItem } from "../../services/api/assignments";
import type { TeacherQuestion } from "../../services/api/teacherLessons";
import { AssignmentPresentation } from "../../theme/assignment";
import { CaptureQuestion } from "../assignments/CaptureQuestion";
import { LessonButton, LessonChoice, LessonField, LessonNote, l } from "./LessonUI";

type Entry = { id: string; text: string };
type Pair = { left_id: string; right_id: string };
export const questionLabels: Record<AssignmentMethod, string> = { multiple_choice: "Multiple Choice", true_false: "True or False", identification: "Identification", fill_in_the_blank: "Fill in the Blanks", multiple_select: "Multiple Select", flashcards: "Flashcards", error_identification: "Error Identification", word_arrangement: "Word Arrangement", sentence_arrangement: "Sentence Arrangement", matching_type: "Matching" };
const id = () => Crypto.randomUUID();
export function cloneQuestion<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function entries(q: TeacherQuestion, field: string): Entry[] { return Array.isArray(q.content[field]) ? q.content[field] as Entry[] : []; }
function ids(value: unknown): string[] { return Array.isArray(value) ? value as string[] : []; }
function pairs(q: TeacherQuestion): Pair[] { return Array.isArray(q.answer_key.pairs) ? q.answer_key.pairs as Pair[] : []; }
export function newQuestion(method: AssignmentMethod = "multiple_choice"): TeacherQuestion {
  const units = () => [{ id: id(), text: "" }, { id: id(), text: "" }];
  const defs: Record<AssignmentMethod, [Record<string, unknown>, Record<string, unknown>]> = {
    multiple_choice: [{ options: units() }, { correct_option_id: "" }], true_false: [{}, { value: true }],
    identification: [{ input_max_length: 500 }, { accepted_answers: [""], case_sensitive: false }],
    fill_in_the_blank: [{ blank_ids: [], template_syntax: "double-brace-v1", input_max_length: 500 }, { accepted_answers: {} }],
    multiple_select: [{ options: units() }, { correct_option_ids: [] }], flashcards: [{ cue: "" }, { back: "" }],
    error_identification: [{ tokens: units() }, { error_token_ids: [], accepted_corrections: {} }],
    word_arrangement: [{ items: units() }, { ordered_ids: [] }], sentence_arrangement: [{ items: units() }, { ordered_ids: [] }],
    matching_type: [{ left: units(), right: units() }, { pairs: [] }],
  };
  return { method, prompt: "", instructions: null, difficulty: "medium", content: defs[method][0], answer_key: defs[method][1] };
}
export function prepareQuestion(q: TeacherQuestion): TeacherQuestion {
  const next = cloneQuestion(q);
  next.prompt = next.prompt.trim(); next.instructions = next.instructions?.trim() || null;
  if (next.method === "identification") next.answer_key.accepted_answers = ids(next.answer_key.accepted_answers).map(s => s.trim()).filter(Boolean);
  if (next.method === "fill_in_the_blank") next.answer_key.accepted_answers = Object.fromEntries(Object.entries(next.answer_key.accepted_answers as Record<string, string[]>).map(([key, values]) => [key, values.map(s => s.trim()).filter(Boolean)]));
  return next;
}
export function questionError(q: TeacherQuestion): string | null {
  if (!q.prompt.trim()) return "Write the question before adding it to your lesson.";
  if (q.prompt.length > 8000 || (q.instructions?.length ?? 0) > 8000) return "Keep the question and instructions to 8,000 characters each.";
  const key = q.answer_key;
  const field = ["multiple_choice", "multiple_select"].includes(q.method) ? "options" : q.method === "error_identification" ? "tokens" : ["word_arrangement", "sentence_arrangement"].includes(q.method) ? "items" : "";
  if (field) {
    const rows = entries(q, field);
    if (rows.length < (field === "tokens" ? 1 : 2) || rows.some(row => !row.text.trim())) return "Give every entry text, and keep the required entries.";
    const available = new Set(rows.map(row => row.id));
    if (q.method === "multiple_choice" && !available.has(String(key.correct_option_id))) return "Choose the correct answer.";
    const selected = q.method === "multiple_select" ? ids(key.correct_option_ids) : q.method === "error_identification" ? ids(key.error_token_ids) : [];
    if (["multiple_select", "error_identification"].includes(q.method) && (!selected.length || selected.some(value => !available.has(value)))) return "Choose at least one correct entry.";
    if (field === "items" && (ids(key.ordered_ids).length !== rows.length || new Set(ids(key.ordered_ids)).size !== rows.length || ids(key.ordered_ids).some(value => !available.has(value)))) return "Set the expected order using every item once.";
  }
  if (q.method === "identification" && !ids(key.accepted_answers).some(s => s.trim())) return "Add at least one accepted answer.";
  if (q.method === "flashcards" && (!String(q.content.cue).trim() || !String(key.back).trim())) return "Add the card front and back.";
  if (q.method === "fill_in_the_blank") {
    const blanks = ids(q.content.blank_ids), answers = key.accepted_answers as Record<string, string[]>;
    const markers = Array.from(q.prompt.matchAll(/\{\{([A-Za-z0-9_-]{1,80})\}\}/g), match => match[1]);
    if (!blanks.length || JSON.stringify(markers) !== JSON.stringify(blanks) || blanks.some(blank => !answers[blank]?.some(s => s.trim()))) return "Use each named blank once, in its listed order, and add an answer for every blank.";
  }
  if (q.method === "matching_type") {
    const left = entries(q, "left"), right = entries(q, "right"), links = pairs(q);
    if (left.length < 2 || left.length !== right.length || [...left, ...right].some(v => !v.text.trim()) || links.length !== left.length || new Set(links.map(p => p.right_id)).size !== right.length || left.some(v => !links.some(p => p.left_id === v.id && right.some(r => r.id === p.right_id)))) return "Complete each matching pair once, with equal left and right entry counts.";
  }
  return null;
}

export function QuestionAuthor({ value: q, onChange, disabled = false }: { value: TeacherQuestion; onChange: (value: TeacherQuestion) => void; disabled?: boolean }) {
  const [types, setTypes] = useState(false);
  const change = (next: TeacherQuestion) => { if (!disabled) onChange(next); };
  const setKey = (name: string, value: unknown) => change({ ...q, answer_key: { ...q.answer_key, [name]: value } });
  const setContent = (name: string, value: unknown) => change({ ...q, content: { ...q.content, [name]: value } });
  function remove(field: string, entryId: string) {
    const next = cloneQuestion(q); next.content[field] = entries(q, field).filter(row => row.id !== entryId);
    if (field === "options") { if (next.answer_key.correct_option_id === entryId) next.answer_key.correct_option_id = ""; next.answer_key.correct_option_ids = ids(next.answer_key.correct_option_ids).filter(v => v !== entryId); if (q.method === "multiple_choice") delete next.answer_key.correct_option_ids; }
    if (field === "tokens") { next.answer_key.error_token_ids = ids(next.answer_key.error_token_ids).filter(v => v !== entryId); const corrections = { ...next.answer_key.accepted_corrections as Record<string, unknown> }; delete corrections[entryId]; next.answer_key.accepted_corrections = corrections; }
    if (field === "items") next.answer_key.ordered_ids = ids(next.answer_key.ordered_ids).filter(v => v !== entryId);
    if (field === "left" || field === "right") next.answer_key.pairs = pairs(q).filter(p => field === "left" ? p.left_id !== entryId : p.right_id !== entryId);
    change(next);
  }
  function unitList(field: string, label: string) { const rows = entries(q, field); return <View style={l.stack}><Text style={l.label}>{label}</Text>{rows.map((row, index) => <View key={row.id} style={l.card}><LessonField label={`${label} ${index + 1}`} value={row.text} disabled={disabled} onChange={text => setContent(field, rows.map(v => v.id === row.id ? { ...v, text } : v))} /><View style={l.row}><View style={l.flex}><LessonButton label={`Move entry ${index + 1} up`} quiet disabled={disabled || index === 0} onPress={() => { const next = [...rows]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; setContent(field, next); }} /></View><View style={l.flex}><LessonButton label={`Remove entry ${index + 1}`} quiet disabled={disabled} onPress={() => remove(field, row.id)} /></View></View></View>)}<LessonButton label={`Add ${label.toLowerCase()} entry`} disabled={disabled || rows.length >= 100} onPress={() => setContent(field, [...rows, { id: id(), text: "" }])} /></View>; }
  const choices = q.method === "multiple_choice" || q.method === "multiple_select", errors = q.method === "error_identification", ordering = q.method === "word_arrangement" || q.method === "sentence_arrangement";
  return <View style={l.stack}>
    <LessonButton label={`Question type: ${questionLabels[q.method]}`} disabled={disabled} onPress={() => setTypes(v => !v)} />
    {types && <View accessibilityRole="radiogroup" accessibilityLabel="Question type" style={l.stack}>{assignmentMethods.map(method => <LessonChoice key={method} radio title={questionLabels[method]} checked={method === q.method} disabled={disabled} onPress={() => { if (method !== q.method) change(newQuestion(method)); setTypes(false); }} />)}<Text style={l.small}>Changing the type starts a new question definition.</Text></View>}
    <LessonField label="Question" value={q.prompt} onChange={prompt => change({ ...q, prompt })} multiline disabled={disabled} maxLength={8000} />
    <LessonField label="Question instructions (optional)" value={q.instructions ?? ""} onChange={instructions => change({ ...q, instructions })} multiline disabled={disabled} maxLength={8000} />
    <Text style={l.label}>Starting difficulty</Text><View accessibilityRole="radiogroup" accessibilityLabel="Question difficulty" style={l.stack}>{(["easy", "medium", "hard"] as const).map(value => <LessonChoice key={value} radio title={value === "hard" ? "Challenging" : value === "medium" ? "Medium" : "Easy"} checked={q.difficulty === value} disabled={disabled} onPress={() => change({ ...q, difficulty: value })} />)}</View>
    {(choices || errors || ordering) && unitList(choices ? "options" : errors ? "tokens" : "items", choices ? "Choice" : errors ? "Word" : "Item")}
    {q.method === "flashcards" && <LessonField label="Card front" value={String(q.content.cue ?? "")} onChange={value => setContent("cue", value)} multiline disabled={disabled} />}
    {q.method === "matching_type" && <>{unitList("left", "Left")}{unitList("right", "Right")}</>}
    {q.method === "fill_in_the_blank" && <View style={l.stack}><LessonNote>Use each named blank in your question, in the order shown below. Adding a blank inserts its marker into the question.</LessonNote><LessonButton label="Add a blank" disabled={disabled || ids(q.content.blank_ids).length >= 50} onPress={() => { const blank = `b_${id().slice(0, 8)}`; change({ ...q, prompt: `${q.prompt} {{${blank}}}`, content: { ...q.content, blank_ids: [...ids(q.content.blank_ids), blank] }, answer_key: { accepted_answers: { ...q.answer_key.accepted_answers as Record<string, string[]>, [blank]: [""] } } }); }} /></View>}
    <View style={l.keyCard}><Text style={l.label}>Answer key · only you can see this</Text>
      {(choices || errors) && <View accessibilityRole={q.method === "multiple_choice" ? "radiogroup" : undefined} accessibilityLabel="Correct entries" style={l.stack}>{entries(q, choices ? "options" : "tokens").map((row, i) => { const key = errors ? "error_token_ids" : "correct_option_ids"; const selected = ids(q.answer_key[key]); const single = q.method === "multiple_choice"; return <LessonChoice key={row.id} radio={single} title={`${i + 1}. ${row.text || "Untitled entry"}`} checked={single ? q.answer_key.correct_option_id === row.id : selected.includes(row.id)} disabled={disabled} onPress={() => single ? setKey("correct_option_id", row.id) : setKey(key, selected.includes(row.id) ? selected.filter(v => v !== row.id) : [...selected, row.id])} />; })}</View>}
      {q.method === "true_false" && <View accessibilityRole="radiogroup" accessibilityLabel="Correct answer" style={l.stack}>{[true, false].map(value => <LessonChoice key={String(value)} radio title={value ? "True" : "False"} checked={q.answer_key.value === value} disabled={disabled} onPress={() => setKey("value", value)} />)}</View>}
      {q.method === "identification" && <><LessonField label="Accepted answers, one per line" value={ids(q.answer_key.accepted_answers).join("\n")} onChange={value => setKey("accepted_answers", value.split("\n"))} multiline disabled={disabled} /><LessonChoice title="Match capital letters exactly" checked={q.answer_key.case_sensitive === true} disabled={disabled} onPress={() => setKey("case_sensitive", q.answer_key.case_sensitive !== true)} /></>}
      {q.method === "fill_in_the_blank" && ids(q.content.blank_ids).map(blank => <View key={blank} style={l.stack}><LessonField label={`Answers for {{${blank}}}, one per line`} value={(q.answer_key.accepted_answers as Record<string, string[]>)[blank]?.join("\n") ?? ""} multiline disabled={disabled} onChange={value => setKey("accepted_answers", { ...q.answer_key.accepted_answers as Record<string, string[]>, [blank]: value.split("\n") })} /><LessonButton label={`Remove blank ${blank}`} quiet disabled={disabled} onPress={() => { const answers = { ...q.answer_key.accepted_answers as Record<string, string[]> }; delete answers[blank]; change({ ...q, prompt: q.prompt.split(`{{${blank}}}`).join(""), content: { ...q.content, blank_ids: ids(q.content.blank_ids).filter(v => v !== blank) }, answer_key: { accepted_answers: answers } }); }} /></View>)}
      {q.method === "flashcards" && <LessonField label="Card back" value={String(q.answer_key.back ?? "")} onChange={value => setKey("back", value)} multiline disabled={disabled} />}
      {ordering && <><Text style={l.small}>Set the expected order. This is separate from the order students first see.</Text>{entries(q, "items").filter(row => !ids(q.answer_key.ordered_ids).includes(row.id)).map(row => <LessonButton key={row.id} label={`Add to expected order: ${row.text || "Untitled item"}`} disabled={disabled} onPress={() => setKey("ordered_ids", [...ids(q.answer_key.ordered_ids), row.id])} />)}{ids(q.answer_key.ordered_ids).map((value, i) => <View key={value} style={l.stack}><Text style={l.label}>{i + 1}. {entries(q, "items").find(row => row.id === value)?.text}</Text><LessonButton label={`Move expected item ${i + 1} up`} disabled={disabled || i === 0} onPress={() => { const order = [...ids(q.answer_key.ordered_ids)]; [order[i - 1], order[i]] = [order[i], order[i - 1]]; setKey("ordered_ids", order); }} /><LessonButton label={`Remove expected item ${i + 1}`} quiet disabled={disabled} onPress={() => setKey("ordered_ids", ids(q.answer_key.ordered_ids).filter(v => v !== value))} /></View>)}</>}
      {q.method === "matching_type" && <><Text style={l.small}>Choose one right entry for each left entry. Reassigning a right entry clears its previous pair.</Text>{entries(q, "left").map((left, i) => <View key={left.id} style={l.stack}><Text style={l.label}>{i + 1}. {left.text || "Untitled left entry"}</Text>{entries(q, "right").map((right, j) => <LessonChoice key={right.id} radio title={`${j + 1}. ${right.text || "Untitled right entry"}`} checked={pairs(q).some(p => p.left_id === left.id && p.right_id === right.id)} disabled={disabled} onPress={() => setKey("pairs", [...pairs(q).filter(p => p.left_id !== left.id && p.right_id !== right.id), { left_id: left.id, right_id: right.id }])} />)}</View>)}</>}
    </View>
  </View>;
}

export function TeacherQuestionPreview({ question, onClose }: { question: TeacherQuestion; onClose: () => void }) {
  const [answer, setAnswer] = useState<Record<string, unknown>>();
  const item: AssignmentItem = { id: "teacher-question-preview", question_id: "teacher-question-preview", version: 1, eligible: true,
    definition: { lesson_id: "preview", method: question.method, prompt: question.prompt, instructions: question.instructions, content: question.content } };
  return <View style={l.stack}><Text accessibilityRole="header" style={l.heading}>Student preview</Text><LessonNote>Answer keys and correctness are hidden. This preview doesn’t save an answer.</LessonNote>{question.method === "flashcards" ? <View style={l.card}><Text style={l.heading}>{question.prompt}</Text><Text style={l.body}>{String(question.content.cue ?? "")}</Text><Text style={l.small}>The back is withheld in this preview.</Text></View> : <AssignmentPresentation.Provider value={true}><CaptureQuestion item={item} answer={answer} back={null} disabled={false} onChange={setAnswer} onReveal={() => {}} /></AssignmentPresentation.Provider>}<LessonButton label="Close preview" onPress={onClose} /></View>;
}
