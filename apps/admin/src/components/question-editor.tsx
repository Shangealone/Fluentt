"use client";

import { useState } from "react";
import { Button } from "./ui";
import { assignPair, codepoints, editMatchSide, isArrangement, methodName, moveIds, moveOption, removeOption, toggleTarget, validOrder, validPairs, type Pair, type Draft, type Option, type PublicDefinition } from "@/services/questions-contract";

export function ChoicePreview({ definition }: { definition: Extract<PublicDefinition, { method: "multiple_choice" | "true_false" }> }) {
  const [selection, setSelection] = useState<string | null>(null);
  const options = definition.method === "multiple_choice" ? definition.content.options
    : [{ id: "true", text: "True" }, { id: "false", text: "False" }];
  return <section className="card choice-preview" aria-label="Unscored question preview">
    <p className="eyebrow">ADMINISTRATOR PREVIEW · UNSCORED</p><h3>{definition.prompt}</h3>
    {definition.instructions && <p>{definition.instructions}</p>}
    <fieldset><legend>Choose one answer</legend>{options.map(option => <label key={option.id} className="choice-row">
      <input type="radio" name="preview-answer" checked={selection === option.id} onChange={() => setSelection(option.id)} />
      <span>{option.text}</span></label>)}</fieldset>
    <p role="status">{selection === null ? "No answer selected." : "One answer selected. No score or correctness feedback is calculated."}</p>
    <Button type="button" disabled={selection === null} onClick={() => setSelection(null)}>Reset selection</Button>
  </section>;
}

export function TextPreview({ definition }: { definition: Extract<PublicDefinition, { method: "identification" | "fill_in_the_blank" }> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const ids = definition.method === "identification" ? ["text"] : definition.content.blank_ids;
  const limit = definition.content.input_max_length;
  const raw = (id: string) => Object.hasOwn(values, id) ? values[id] : "";
  const prompt = definition.method === "fill_in_the_blank" && definition.content.template_syntax
    ? definition.prompt.replace(/\{\{([A-Za-z0-9_-]{1,80})\}\}/g, (_, id) => `[Gap ${ids.indexOf(id) + 1}]`) : definition.prompt;
  const complete = ids.every(id => !!raw(id).trim() && (limit === undefined || codepoints(raw(id)) <= limit));
  return <section className="card choice-preview text-preview" aria-label="Unscored text question preview">
    <p className="eyebrow">ADMINISTRATOR PREVIEW · UNSCORED</p><h3>{prompt}</h3>
    {definition.instructions && <p>{definition.instructions}</p>}
    <p>Raw text is preserved. No grading or correctness feedback. {limit === undefined ? "No declared input limit (legacy-compatible)." : `Limit: ${limit} Unicode code points per answer.`}</p>
    {ids.map((id, index) => {
      const count = codepoints(raw(id)), over = limit !== undefined && count > limit;
      return <label key={id}>{definition.method === "identification" ? "Your answer" : `Gap ${index + 1}`}
        <textarea className="input" rows={2} value={raw(id)} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
          aria-invalid={over} aria-describedby={`preview-count-${index}`}
          onChange={event => setValues(current => ({ ...current, [id]: event.target.value }))} />
        <span id={`preview-count-${index}`} className={over ? "error" : ""}>{count} code points{over ? "; exceeds limit. Text kept for correction." : ""}</span>
      </label>;
    })}
    <p role="status">{complete ? "Response complete. Not submitted or scored." : "Complete every answer within its declared limit."}</p>
    <Button type="button" disabled={!Object.values(values).some(Boolean)} onClick={() => setValues({})}>Reset answers</Button>
  </section>;
}

export function QuestionPreview({ definition, flashcardBack }: { definition: PublicDefinition; flashcardBack?: string }) {
  if (definition.method === "flashcards") return <FlashcardPreview definition={definition} back={flashcardBack} />;
  if (definition.method === "matching_type") return <MatchingPreview definition={definition} />;
  if (definition.method === "word_arrangement" || definition.method === "sentence_arrangement") return <ArrangementPreview definition={definition} />;
  if (definition.method === "multiple_select" || definition.method === "error_identification") return <MultiPreview definition={definition} />;
  return definition.method === "multiple_choice" || definition.method === "true_false"
    ? <ChoicePreview definition={definition} /> : <TextPreview definition={definition} />;
}

const recallLabels = { again: "Again — could not recall", hard: "Hard — recalled with difficulty", good: "Good — recalled with some effort", easy: "Easy — recalled readily" };
export function FlashcardPreview({ definition, back }: { definition: Extract<PublicDefinition, { method: "flashcards" }>; back?: string }) {
  const [revealed, setRevealed] = useState(false), [rating, setRating] = useState<keyof typeof recallLabels | null>(null);
  return <section className="card choice-preview" aria-label="Unscored flashcard preview">
    <p className="eyebrow">ADMINISTRATOR PREVIEW · UNSCORED</p><h3>{definition.prompt}</h3>{definition.instructions && <p>{definition.instructions}</p>}
    <h4>Front / cue</h4><p>{definition.content.cue}</p>
    <p>Recall silently, then reveal the back. Optional ratings are self-reported, not scores or scheduling instructions.</p>
    {back ? <Button type="button" disabled={revealed} onClick={() => setRevealed(true)}>Reveal back</Button>
      : <p>Back unavailable. Private reveal requires explicit editor access; this front-only preview contains no answer.</p>}
    {revealed && back && <><h4>Back</h4><p>{back}</p><fieldset><legend>Optional self-recall rating</legend>
      <div className="account-actions">{(Object.keys(recallLabels) as (keyof typeof recallLabels)[]).map(value => <Button key={value} type="button" disabled={rating !== null}
        onClick={() => { if (rating === null) setRating(value); }}>{recallLabels[value]}</Button>)}</div>
    </fieldset></>}
    <p role="status">{revealed && back ? rating ? `${recallLabels[rating]}. Local only; not saved, scored or scheduled.` : "Back revealed. No rating selected." : "Back hidden."}</p>
    <Button type="button" disabled={!revealed && rating === null} onClick={() => { setRevealed(false); setRating(null); }}>Restart card preview</Button>
  </section>;
}

export function MatchingControls({ left, right, pairs, selectedLeft, onSelectLeft, onChange, privateKey = false }: {
  left: Option[]; right: Option[]; pairs: Pair[]; selectedLeft: string | null; onSelectLeft: (id: string | null) => void;
  onChange: (pairs: Pair[]) => void; privateKey?: boolean;
}) {
  const selected = left.findIndex(row => row.id === selectedLeft);
  return <fieldset><legend>{privateKey ? "Private expected associations" : "Your associations"}</legend>
    <p>Select a left item, then a right item. Each target can be used once. Reusing a target clears its previous association. Numbers distinguish repeated labels.</p>
    <h4>Left items</h4><div className="account-actions">{left.map((row, index) => <Button key={row.id} type="button" aria-pressed={selectedLeft === row.id}
      onClick={() => onSelectLeft(selectedLeft === row.id ? null : row.id)}>Left {index + 1}: {row.text || "(enter text)"}</Button>)}</div>
    <p role="status">{selected < 0 ? "Choose a left item first." : `Left ${selected + 1} selected. Choose a right item.`}</p>
    <h4>Right items</h4><div className="account-actions">{right.map((row, index) => <Button key={row.id} type="button" disabled={selected < 0}
      onClick={() => { if (selected >= 0) { onChange(assignPair(left, right, pairs, selectedLeft!, row.id)); onSelectLeft(null); } }}>Match with right {index + 1}: {row.text || "(enter text)"}</Button>)}</div>
    <ol>{left.map((row, index) => {
      const pair = pairs.find(pair => pair.left_id === row.id), target = right.findIndex(item => item.id === pair?.right_id);
      return <li key={row.id} className="question-option"><span>Left {index + 1}: {row.text} → {target < 0 ? "Unmatched" : `Right ${target + 1}: ${right[target].text}`}</span>
        {pair && <Button type="button" onClick={() => onChange(pairs.filter(pair => pair.left_id !== row.id))}>Remove association for left {index + 1}</Button>}</li>;
    })}</ol>
    <p role="status">{validPairs(left, right, pairs, true) ? privateKey ? "Expected associations cover every item." : "All items matched. Ready; not submitted or scored." : `${pairs.length} of ${left.length} associations. Unfinished.`}</p>
    <Button type="button" disabled={!pairs.length && selectedLeft === null} onClick={() => { onChange([]); onSelectLeft(null); }}>Reset matching</Button>
  </fieldset>;
}
export function MatchingPreview({ definition }: { definition: Extract<PublicDefinition, { method: "matching_type" }> }) {
  const [pairs, setPairs] = useState<Pair[]>([]), [left, setLeft] = useState<string | null>(null);
  return <section className="card choice-preview" aria-label="Unscored matching preview"><p className="eyebrow">ADMINISTRATOR PREVIEW · UNSCORED</p>
    <h3>{definition.prompt}</h3>{definition.instructions && <p>{definition.instructions}</p>}
    <p>No answer comparison, score or correctness feedback.</p>
    <MatchingControls {...definition.content} pairs={pairs} selectedLeft={left} onSelectLeft={setLeft} onChange={setPairs} />
  </section>;
}
function MatchingEditor({ draft, errors, onChange }: { draft: Draft; errors: Record<string, string>; onChange: (d: Draft) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  return <fieldset><legend>Matching items in presentation order</legend>
    <p>At least two items per side, equal counts and complete one-to-one private associations. Order is authored independently; no automatic shuffle. Removing an item clears its associations.</p>
    {(["left", "right"] as const).map(side => <fieldset key={side}><legend>{side === "left" ? "Left set" : "Right set"}</legend>
      {draft[side].map((row, index) => <div key={row.id} className="question-option">
        <label>{side === "left" ? "Left" : "Right"} item {index + 1}<textarea className="input" value={row.text} aria-invalid={!!errors[`${side}_${index}`]}
          aria-describedby={errors[`${side}_${index}`] ? `question-error-${side}_${index}` : undefined}
          onChange={event => onChange(editMatchSide(draft, side, draft[side].map((item, i) => i === index ? { ...item, text: event.target.value } : item)))} />
          {errors[`${side}_${index}`] && <span id={`question-error-${side}_${index}`} className="error">{errors[`${side}_${index}`]}</span>}</label>
        <p className="resource-id">Stable ID: {row.id}</p><div className="account-actions">
          {[-1, 1].map(delta => <Button key={delta} type="button" disabled={index + delta < 0 || index + delta >= draft[side].length}
            aria-label={`Move ${side} item ${index + 1} ${delta < 0 ? "up" : "down"}`} onClick={() => {
              const rows = [...draft[side]], target = index + delta; [rows[index], rows[target]] = [rows[target], rows[index]];
              onChange(editMatchSide(draft, side, rows));
            }}>Move {delta < 0 ? "up" : "down"}</Button>)}
          <Button type="button" disabled={draft[side].length <= 2} onClick={() => {
            if (side === "left" && selected === row.id) setSelected(null);
            onChange(editMatchSide(draft, side, draft[side].filter(item => item.id !== row.id)));
          }}>Remove {side} item {index + 1}</Button></div>
      </div>)}
      {errors[side] && <p className="error" role="alert">{errors[side]}</p>}
      <Button type="button" onClick={() => onChange(editMatchSide(draft, side, [...draft[side], { id: side + "_" + crypto.randomUUID(), text: "" }]))}>Add {side} item</Button>
    </fieldset>)}
    <MatchingControls privateKey left={draft.left} right={draft.right} pairs={draft.pairs} selectedLeft={selected} onSelectLeft={setSelected} onChange={pairs => onChange({ ...draft, pairs })} />
    {errors.pairs && <p className="error" role="alert">{errors.pairs}</p>}
    {validPairs(draft.left, draft.right, draft.pairs, true) && draft.left.every((row, index) => draft.pairs.some(pair => pair.left_id === row.id && pair.right_id === draft.right[index]?.id))
      && <p role="status">The visible rows currently align with the private expected associations. Review presentation order for unwanted hints.</p>}
  </fieldset>;
}

export function SequenceControls({ items, order, onChange, privateKey = false }: {
  items: Option[]; order: string[]; onChange: (ids: string[]) => void; privateKey?: boolean;
}) {
  return <fieldset><legend>{privateKey ? "Private expected sequence" : "Your sequence"}</legend>
    <p>Append each unit once, then move or remove it. Unit numbers distinguish repeated labels.</p>
    <div className="account-actions">{items.map((row, index) => <Button key={row.id} type="button" disabled={order.includes(row.id)}
      onClick={() => { if (!order.includes(row.id)) onChange([...order, row.id]); }} aria-label={`Append unit ${index + 1}: ${row.text}`}>Unit {index + 1}: {row.text || "(enter text)"}</Button>)}</div>
    <ol>{order.map((id, index) => {
      const source = items.findIndex(row => row.id === id);
      return <li key={id} className="question-option"><span>Unit {source + 1}: {items[source]?.text ?? "Unknown unit; correct the sequence."}</span>
        <div className="account-actions"><Button type="button" disabled={index === 0} onClick={() => onChange(moveIds(order, index, -1))} aria-label={`Move sequence position ${index + 1} earlier`}>Move earlier</Button>
          <Button type="button" disabled={index === order.length - 1} onClick={() => onChange(moveIds(order, index, 1))} aria-label={`Move sequence position ${index + 1} later`}>Move later</Button>
          <Button type="button" onClick={() => onChange(order.filter(key => key !== id))} aria-label={`Remove sequence position ${index + 1}`}>Remove from sequence</Button></div>
      </li>;
    })}</ol>
    <p role="status">{validOrder(items, order, true) ? privateKey ? "Expected sequence covers every unit." : "All units arranged. Ready; not submitted or scored." : `${order.length} of ${items.length} units arranged. Sequence unfinished.`}</p>
    <Button type="button" disabled={!order.length} onClick={() => onChange([])}>Reset sequence</Button>
  </fieldset>;
}

export function ArrangementPreview({ definition }: { definition: Extract<PublicDefinition, { method: "word_arrangement" | "sentence_arrangement" }> }) {
  const [order, setOrder] = useState<string[]>([]);
  return <section className="card choice-preview arrangement-preview" aria-label="Unscored arrangement preview">
    <p className="eyebrow">ADMINISTRATOR PREVIEW · UNSCORED</p><h3>{definition.prompt}</h3>
    {definition.instructions && <p>{definition.instructions}</p>}
    <p>Arrange every unit. This preview does not compare your sequence with an answer key.</p>
    <SequenceControls items={definition.content.items} order={order} onChange={setOrder} />
  </section>;
}

export function MultiPreview({ definition }: { definition: Extract<PublicDefinition, { method: "multiple_select" | "error_identification" }> }) {
  const [selection, setSelection] = useState<string[]>([]);
  const tokens = definition.method === "error_identification";
  const rows = tokens ? definition.content.tokens : definition.content.options;
  return <section className="card choice-preview" aria-label="Unscored multi-selection preview">
    <p className="eyebrow">ADMINISTRATOR PREVIEW · UNSCORED</p><h3>{definition.prompt}</h3>
    {definition.instructions && <p>{definition.instructions}</p>}
    <fieldset><legend>{tokens ? "Select the erroneous segment or segments" : "Select all options that apply"}</legend>
      {tokens && <p>Whole segments in author order. Segments wrap independently; no character offsets or correction entry.</p>}
      <div className={tokens ? "token-options" : undefined}>{rows.map((row, index) => <label key={row.id} className="choice-row">
        <input type="checkbox" checked={selection.includes(row.id)} aria-label={tokens ? `Segment ${index + 1}: ${row.text}` : row.text}
          onChange={() => setSelection(current => {
            const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
            return rows.filter(value => next.has(value.id)).map(value => value.id);
          })} /><span>{row.text}</span></label>)}</div>
    </fieldset>
    <p role="status">{selection.length ? `${selection.length} selected. Not submitted or scored.` : "No selections. Unfinished preview."} No configured selection minimum or maximum.</p>
    <Button type="button" disabled={!selection.length} onClick={() => setSelection([])}>Reset selections</Button>
  </section>;
}

export function QuestionEditor({ draft, errors, busy, mode, onChange, onSave, onPreview, onCancel }: {
  draft: Draft; errors: Record<string, string>; busy: boolean; mode: string; onChange: (draft: Draft) => void;
  onSave: () => void; onPreview: () => void; onCancel: () => void;
}) {
  function field(key: keyof Draft, value: string) { onChange({ ...draft, [key]: value }); }
  const error = (key: string) => errors[key] && <span id={`question-error-${key}`} className="error">{errors[key]}</span>;
  const props = (key: string) => ({ "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `question-error-${key}` : undefined });
  const tokens = draft.method === "error_identification", multi = draft.method === "multiple_select" || tokens;
  const arrangement = isArrangement(draft.method), noun = tokens ? "Segment" : arrangement ? "Unit" : "Option";
  return <form className="card curriculum-form question-form" noValidate aria-busy={busy} onSubmit={event => { event.preventDefault(); onSave(); }}>
    <h2>{mode} {methodName(draft.method)}</h2>
    <p>Text only. This editor does not generate educational content or verify academic correctness.</p>
    <fieldset disabled={busy}>
      <label>Lesson ID<input className="input" required value={draft.lesson_id} {...props("lesson_id")} onChange={event => field("lesson_id", event.target.value)} />{error("lesson_id")}</label>
      <p>Copy the lesson record UUID from Curriculum. Publication requires published, unretired ancestry.</p>
      <label>Learning language<select className="input" required value={draft.language} {...props("language")} onChange={event => field("language", event.target.value)}>
        <option value="">Choose language</option><option value="english">English</option><option value="tagalog">Tagalog</option></select>{error("language")}</label>
      <label>Prompt<textarea className="input" required maxLength={8000} value={draft.prompt} {...props("prompt")} onChange={event => field("prompt", event.target.value)} />{error("prompt")}</label>
      <label>Instructions (optional)<textarea className="input" maxLength={8000} value={draft.instructions} {...props("instructions")} onChange={event => field("instructions", event.target.value)} />{error("instructions")}</label>
      {draft.method === "multiple_choice" || multi || arrangement ? <fieldset aria-invalid={!!(errors.correct || errors.options || errors.order)}
        aria-describedby={[errors.correct && "question-error-correct", errors.options && "question-error-options", errors.order && "question-error-order"].filter(Boolean).join(" ") || undefined}><legend>{tokens ? "Segments" : arrangement ? "Units" : "Options"} in presentation order</legend>
        <p>{arrangement ? "Enter at least two explicit word/token or sentence units; no automatic splitting or shuffling. Visible presentation order is independent of the private expected sequence."
          : multi ? "Choose one or more correct options/target segments. No scoring or configurable selection bounds." : "Choose exactly one correct option."} IDs stay with entries when edited or reordered.</p>
        {tokens && <p>Enter whole, independently selectable text segments in reading order, including any needed punctuation. No overlapping spans or character offsets are supported. Removing a segment also removes its target/correction references.</p>}
        {draft.options.map((option, index) => <div key={option.id} className="question-option">
          <label>{noun} {index + 1}<textarea className="input" value={option.text} {...props(`option_${index}`)} onChange={event => onChange({ ...draft,
            options: draft.options.map((row, position) => position === index ? { ...row, text: event.target.value } : row) })} />{error(`option_${index}`)}</label>
          <p className="resource-id">Stable ID: {option.id}</p>
          {!arrangement && <label className="check-label"><input type={multi ? "checkbox" : "radio"} name={multi ? "correct-targets" : "correct-option"} checked={multi ? draft.targets.includes(option.id) : draft.correct === option.id}
            onChange={() => multi ? onChange(toggleTarget(draft, option.id)) : field("correct", option.id)} />{tokens ? "Target segment" : "Correct option"} {index + 1}</label>}
          <div className="account-actions"><Button type="button" disabled={index === 0} onClick={() => onChange(moveOption(draft, index, -1))} aria-label={`Move ${noun.toLowerCase()} ${index + 1} up`}>Move up</Button>
            <Button type="button" disabled={index === draft.options.length - 1} onClick={() => onChange(moveOption(draft, index, 1))} aria-label={`Move ${noun.toLowerCase()} ${index + 1} down`}>Move down</Button>
            <Button type="button" disabled={draft.options.length <= (tokens ? 1 : 2)} onClick={() => onChange(removeOption(draft, option.id))} aria-label={`Remove ${noun.toLowerCase()} ${index + 1}`}>Remove</Button></div>
        </div>)}
        {error("options")}{error("correct")}
        <Button type="button" onClick={() => onChange({ ...draft, options: [...draft.options, { id: (tokens ? "segment_" : arrangement ? "unit_" : "option_") + crypto.randomUUID(), text: "" }] })}>{tokens ? "Add segment" : arrangement ? "Add unit" : "Add option"}</Button>
        {arrangement && <>
          <SequenceControls privateKey items={draft.options} order={draft.order} onChange={order => onChange({ ...draft, order })} />{error("order")}
          {validOrder(draft.options, draft.order, true) && draft.options.every((row, index) => row.id === draft.order[index])
            && <p role="status">The visible units currently match the private expected order. Review presentation order if that would reveal an unwanted hint.</p>}
        </>}
        {tokens && <details><summary>Optional private correction metadata</summary>
          <label>Private accepted corrections (JSON)<textarea className="input" value={draft.corrections} {...props("corrections")} onChange={event => field("corrections", event.target.value)} />{error("corrections")}</label>
          <p>Map known stable segment IDs to arrays of expected strings, or use {"{}"}. Existing maps may include non-target segments. Metadata is private; no learner correction field or grading is implemented.</p>
        </details>}
      </fieldset> : draft.method === "flashcards" ? <fieldset><legend>Flashcard content</legend>
        <label>Front / cue<textarea className="input" value={draft.cue} required {...props("cue")} onChange={event => field("cue", event.target.value)} />{error("cue")}</label>
        <label>Private back<textarea className="input" value={draft.back} required {...props("back")} onChange={event => field("back", event.target.value)} />{error("back")}</label>
        <p>The prompt gives directions or context; the cue is the front. The back remains private until an authorized practice reveal. Text only; no vocabulary linking, media or scheduler is configured.</p>
        {draft.rubricVersion && <p>Retained private rubric reference: {draft.rubricVersion}. No rubric execution or objective flashcard grading is implemented.</p>}
      </fieldset> : draft.method === "matching_type" ? <MatchingEditor draft={draft} errors={errors} onChange={onChange} /> : draft.method === "true_false" ? <fieldset {...props("boolean")}><legend>Defined correct answer</legend>
        {["true", "false"].map(value => <label className="check-label" key={value}><input type="radio" name="correct-boolean" checked={draft.boolean === value}
          onChange={() => field("boolean", value)} />{value === "true" ? "True" : "False"}</label>)}{error("boolean")}</fieldset>
        : <fieldset><legend>Text answer definition</legend>
          <label>Input limit (Unicode code points, optional)<input className="input" inputMode="numeric" value={draft.inputLimit} {...props("inputLimit")}
            onChange={event => field("inputLimit", event.target.value)} />{error("inputLimit")}</label>
          <p>New items default to 500; allowed range 1–2,000. An empty field retains no declared limit. These are input constraints, not grading rules.</p>
          {draft.method === "identification" ? <>
            <label>Private expected answers (one per line)<textarea className="input" value={draft.acceptedAnswers} {...props("acceptedAnswers")}
              onChange={event => field("acceptedAnswers", event.target.value)} />{error("acceptedAnswers")}</label>
            <label className="check-label"><input type="checkbox" checked={draft.caseSensitive} onChange={event => onChange({ ...draft, caseSensitive: event.target.checked })} />Case-sensitive metadata</label>
            <p>Existing metadata is preserved. This section does not compare or normalize learner answers.</p>
          </> : <>
            <label className="check-label"><input type="checkbox" checked={draft.templateSyntax} onChange={event => onChange({ ...draft, templateSyntax: event.target.checked })} />Use explicit double-brace-v1 template</label>
            <p>{draft.templateSyntax ? "In Prompt, place {{stable_id}} exactly once for every gap. Braces are reserved. Passage order determines saved blank order. Adding a gap appends its marker; removing it removes its exact markers."
              : "Legacy plain-text prompt: displayed unchanged; gap fields follow their saved order. Enabling syntax requires explicit prompt markers."}</p>
            {draft.blanks.map((blank, index) => <div className="question-option" key={blank.id}>
              <p className="resource-id">Gap {index + 1} · Stable ID: {blank.id} · Marker: {`{{${blank.id}}}`}</p>
              <label>Private expected answers for gap {index + 1} (one per line)<textarea className="input" value={blank.answers} {...props(`blank_${index}`)}
                onChange={event => onChange({ ...draft, blanks: draft.blanks.map((row, i) => i === index ? { ...row, answers: event.target.value } : row) })} />{error(`blank_${index}`)}</label>
              <Button type="button" disabled={draft.blanks.length <= 1} onClick={() => onChange({ ...draft, blanks: draft.blanks.filter(row => row.id !== blank.id),
                prompt: draft.templateSyntax ? draft.prompt.split(`{{${blank.id}}}`).join("") : draft.prompt })}>Remove gap {index + 1}</Button>
            </div>)}{error("blanks")}{error("acceptedAnswers")}
            <Button type="button" onClick={() => { const id = "gap_" + crypto.randomUUID(); onChange({ ...draft,
              blanks: [...draft.blanks, { id, answers: "" }], prompt: draft.templateSyntax ? `${draft.prompt} {{${id}}}` : draft.prompt }); }}>Add gap</Button>
          </>}
        </fieldset>}
      <details><summary>Version metadata and private explanation</summary>
        <label>Difficulty label<select className="input" value={draft.difficulty} onChange={event => field("difficulty", event.target.value)}>
          {["easy", "medium", "hard"].map(value => <option key={value}>{value}</option>)}</select>{error("difficulty")}</label>
        <p>Existing metadata only; no validated proficiency threshold is implied.</p>
        <label>Points metadata<input className="input" inputMode="decimal" value={draft.points} {...props("points")} onChange={event => field("points", event.target.value)} />{error("points")}</label>
        <label>Competency IDs (optional, separate with commas or new lines)<textarea className="input" value={draft.competencies} {...props("competencies")} onChange={event => field("competencies", event.target.value)} />{error("competencies")}</label>
        <label>Private explanation (optional)<textarea className="input" maxLength={8000} value={draft.explanation} {...props("explanation")} onChange={event => field("explanation", event.target.value)} />{error("explanation")}</label>
        <p>Grading marker remains ungraded-v1. Private answer keys and explanations never enter the unscored preview.</p>
      </details>
      <div className="account-actions"><Button type="submit">Save draft</Button><Button type="button" onClick={onPreview}>Preview unsaved draft</Button>
        <Button type="button" onClick={onCancel}>Cancel editing</Button></div>
    </fieldset>
  </form>;
}
