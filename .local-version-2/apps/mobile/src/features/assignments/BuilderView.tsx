import { classProficiencyLabel } from "../../services/api/classProficiency";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Text, TextInput } from "../../accessibility/Primitives";
import { router } from "expo-router";
import type { AssignmentDraft, AssignmentItem, AssignmentMethod, AssignmentPage, LessonContext } from "../../services/api/assignments";
import { assignmentMethods } from "../../services/api/assignments";
import type { ClassDetails } from "../../services/api/classes";
import { ItemPreview } from "./ItemPreview";
import { b, BuilderButton as Button, BuilderHero, BuilderNotice as Notice, BuilderShell, WorksheetArt } from "./BuilderUI";

const names: Record<AssignmentMethod, string> = {
  multiple_choice: "Multiple choice", true_false: "True or false", identification: "Identification", fill_in_the_blank: "Fill in the blank", multiple_select: "Select all that apply", flashcards: "Flashcards", error_identification: "Find the error", word_arrangement: "Arrange the words", sentence_arrangement: "Arrange sentences", matching_type: "Matching",
};
export type BuilderConfirmation = { message: string; accept: () => void; title?: string; label?: string };
type Props = {
  classroom: ClassDetails; row: AssignmentDraft | null; title: string; instructions: string; lesson: LessonContext | null; items: AssignmentItem[];
  busy: boolean; frozen: boolean; editable: boolean; dirty: boolean; error: string; notice: string; uncertain: boolean; pending: boolean; publication: boolean;
  preview: AssignmentItem | null; confirm: BuilderConfirmation | null; query: string; method: string; filterKey: string;
  fetchLessons: (offset: number) => Promise<AssignmentPage<LessonContext>>; fetchQuestions: (offset: number) => Promise<AssignmentPage<AssignmentItem>>;
  onTitle: (value: string) => void; onInstructions: (value: string) => void; onLesson: (value: LessonContext) => void;
  onPreview: (value: AssignmentItem | null) => void; onQuery: (value: string) => void; onMethod: (value: string) => void; onSearch: () => void; onClearFilters: () => void;
  onAdd: (value: AssignmentItem) => void; onMove: (index: number, delta: number) => void; onRemove: (value: AssignmentItem) => void;
  onSave: () => void; onReload: () => void; onArchive: () => void; onPublish: () => void; onBack: () => void; onCancelConfirm: () => void; onAcceptConfirm: () => void;
};

/** Builder-only paging presentation; the shared Picker remains unchanged. */
function BuilderPicker<T>({ fetch, render, emptyTitle, emptyDescription, disabled = false }: {
  fetch: (offset: number) => Promise<AssignmentPage<T>>; render: (item: T) => ReactNode; emptyTitle: string; emptyDescription: string; disabled?: boolean;
}) {
  const [offset, setOffset] = useState(0), [retry, setRetry] = useState(0), [page, setPage] = useState<AssignmentPage<T> | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setPage(null); setError("");
      void fetch(offset).then(value => { if (active) setPage(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "We couldn’t load this list."); });
    });
    return () => { active = false; };
  }, [fetch, offset, retry]);
  return <View style={b.stack}>{error ? <><Notice error>{error}</Notice><Button label="Try again" disabled={disabled} onPress={() => setRetry(value => value + 1)} /></> : !page ? <View style={b.note}><ActivityIndicator color="#176556" /><Text style={b.muted}>Loading your choices…</Text></View> : <>
    {!page.items.length && <View style={[b.card, b.empty]}><WorksheetArt /><Text accessibilityRole="header" style={[b.heading, b.center]}>{emptyTitle}</Text><Text style={[b.muted, b.center]}>{emptyDescription}</Text></View>}
    {page.items.map(render)}
    {(offset > 0 || page.has_more) && <View style={b.row}><Button label="Previous" disabled={disabled || !offset} onPress={() => setOffset(Math.max(0, offset - 20))} /><Text style={b.muted}>Page {Math.floor(offset / 20) + 1}</Text><Button label="Next" disabled={disabled || !page.has_more} onPress={() => setOffset(offset + 20)} /></View>}
  </>}</View>;
}

export function BuilderView(p: Props) {
  const [step, setStep] = useState(p.row && !p.row.editable ? 2 : 0);
  const [selectedOpen, setSelectedOpen] = useState(false), [filtersOpen, setFiltersOpen] = useState(false), [optionsOpen, setOptionsOpen] = useState(false), [aboutOpen, setAboutOpen] = useState(false), [validation, setValidation] = useState("");
  const readOnly = !p.editable;
  const shownStep = readOnly ? 2 : step;
  const context = `${classProficiencyLabel(p.classroom.proficiency_level)} · ${p.classroom.language === "english" ? "English" : "Tagalog"}`;
  const moveStep = (next: number) => {
    if (p.busy || p.frozen) return;
    if (next > 0 && (!p.title.trim() || Array.from(p.title.trim()).length > 200 || Array.from(p.instructions.trim()).length > 8000 || !p.lesson)) {
      setValidation("Enter a title, choose a lesson, and keep your instructions within 8,000 characters."); setStep(0); return;
    }
    setValidation(""); p.onPreview(null); setStep(next);
  };
  const confirmTitle = p.confirm?.title ?? "Please confirm";
  const resetKey = `${shownStep}:${p.preview?.id ?? ""}:${p.confirm ? confirmTitle : ""}:${p.row?.status ?? "new"}`;
  const catalog = p.fetchQuestions;
  const toggle = (label: string, value: boolean, setValue: (value: boolean) => void) => <Pressable accessibilityRole="button" accessibilityState={{ expanded: value, disabled: p.busy }} disabled={p.busy} onPress={() => setValue(!value)} style={[b.row, { minHeight: 44 }]}><Text style={[b.label, { flex: 1 }]}>{label}</Text><Text accessible={false} style={b.label}>{value ? "−" : "+"}</Text></Pressable>;
  const questionCards = (allowEdit: boolean) => p.items.map((item, index) => <View key={item.question_id} style={b.card}>
    <View style={b.questionTitle}><Text style={b.number}>{index + 1}</Text><View style={b.questionCopy}><Text style={b.tag}>{names[item.definition.method]}</Text><Text style={b.label}>{item.definition.prompt}</Text><Text style={b.muted}>Version {item.version}</Text></View></View>
    {!item.eligible && <Notice error={!readOnly}>{readOnly ? "The original saved question is retained in this assignment." : "This question is no longer available. Remove or replace it before saving."}</Notice>}
    <Button label={`Preview question ${index + 1}`} disabled={p.busy} onPress={() => p.onPreview(item)} />
    {allowEdit && <View style={b.actions}><View style={b.action}><Button label="Move earlier" disabled={p.frozen || index === 0} onPress={() => p.onMove(index, -1)} /></View><View style={b.action}><Button label="Move later" disabled={p.frozen || index === p.items.length - 1} onPress={() => p.onMove(index, 1)} /></View><View style={b.action}><Button label={`Remove question ${index + 1}`} disabled={p.frozen} onPress={() => p.onRemove(item)} /></View></View>}
  </View>);

  return <BuilderShell onBack={p.onBack} onAccount={() => router.push("/account")} busy={p.busy} step={shownStep} onStep={!readOnly && !p.frozen && !p.confirm && !p.preview ? moveStep : undefined} resetKey={resetKey}>
    {p.confirm ? <><BuilderHero title={confirmTitle} description="Check before continuing." context={context} /><View style={b.card}><Text style={b.body}>{p.confirm.message}</Text><Button label="Keep working" primary disabled={p.busy} onPress={p.onCancelConfirm} /><Button label={p.confirm.label ?? "Confirm"} disabled={p.busy} onPress={p.onAcceptConfirm} /></View></> : p.preview ? <>
      <BuilderHero title="Question preview" description="See the activity before adding it." context={context} />
      <View style={b.card}><Text style={b.tag}>{names[p.preview.definition.method]}</Text><ItemPreview key={p.preview.id} row={p.preview} /></View>
      {!readOnly && <Button label={p.items.some(item => item.question_id === p.preview!.question_id) ? "Already selected" : "Add question"} primary disabled={p.frozen || !p.preview.eligible || p.items.length >= 200 || p.items.some(item => item.question_id === p.preview!.question_id)} onPress={() => p.onAdd(p.preview!)} />}
      <Button label={shownStep === 2 ? "Back to review" : "Back to questions"} disabled={p.busy} onPress={() => p.onPreview(null)} />
    </> : <>
      <BuilderHero context={context} title={readOnly ? p.row?.status === "published" ? "Published assignment" : p.row?.status === "archived" ? "Archived draft" : "Assignment details" : shownStep === 0 ? p.row ? "Edit your assignment" : "Create an assignment" : shownStep === 1 ? "Choose your questions" : "Ready for your class?"} description={readOnly ? "Here are the saved assignment details." : shownStep === 0 ? "A few details, then choose what your class will practice." : shownStep === 1 ? "Pick a few activities for your class to work through." : "Take a look before saving and sharing."} />
      <Text style={b.muted}>For <Text style={b.label}>{p.classroom.class_name}</Text></Text>
      {!!(validation || p.error) && <Notice error>{validation || p.error}</Notice>}{!!p.notice && <Notice>{p.notice}</Notice>}
      {(p.pending || p.uncertain) && <Notice error>{p.pending ? "We couldn’t confirm the save. Your details are kept here. Retry the same save to avoid creating another draft. After restarting, check your assignments before creating another." : "We couldn’t confirm the latest change. Reload the saved draft before making more edits, or retry the original publication when available."}</Notice>}
      {shownStep === 0 && <>
        <View style={b.card}><View style={b.stack}><Text style={b.label}>Assignment title</Text><TextInput accessibilityLabel="Assignment title" style={b.input} placeholder="Give your assignment a name" placeholderTextColor="#8C9B92" value={p.title} editable={!p.frozen} onChangeText={p.onTitle} /><Text style={b.muted}>Make it easy for your class to recognize. Up to 200 characters.</Text></View><View style={b.stack}><Text style={b.label}>Instructions <Text style={b.muted}>Optional</Text></Text><TextInput accessibilityLabel="Assignment instructions (optional)" style={[b.input, b.textarea]} placeholder="What would you like your students to do?" placeholderTextColor="#8C9B92" multiline value={p.instructions} editable={!p.frozen} onChangeText={p.onInstructions} /><Text style={b.muted}>Up to 8,000 characters.</Text></View></View>
        <View style={b.stack}><Text accessibilityRole="header" style={b.heading}>Choose a lesson</Text><Text style={b.muted}>Lessons available for this class</Text>
          {p.lesson && <View style={b.note}><Text style={b.kicker}>Selected lesson</Text><Text style={b.label}>{p.lesson.lesson_name}</Text><Text style={b.muted}>{p.lesson.curriculum_name ?? "Teacher lesson"} · Grade {p.lesson.grade} · {p.lesson.subject_name}</Text></View>}
          {!p.frozen && <BuilderPicker fetch={p.fetchLessons} emptyTitle="No lessons available yet" emptyDescription="There are no published lessons available for this class. Check again later or contact your content administrator." render={choice => <Pressable key={choice.lesson_id} accessibilityRole="radio" accessibilityState={{ checked: choice.lesson_id === p.lesson?.lesson_id }} onPress={() => p.onLesson(choice)} style={[b.choice, choice.lesson_id === p.lesson?.lesson_id && b.selected]}><View style={b.choiceText}><Text style={b.label}>{choice.lesson_name}</Text><Text style={b.muted}>Grade {choice.grade} · {choice.subject_name}{"\n"}{choice.curriculum_name ?? "Teacher lesson"}</Text></View><View style={[b.radio, choice.lesson_id === p.lesson?.lesson_id && b.radioSelected]} /></Pressable>} />}
        </View>
        <View style={b.footer}><Button label="Continue to questions" primary disabled={p.frozen} onPress={() => moveStep(1)} /><Text style={[b.muted, b.center]}>Your changes are saved only when you choose Save draft.</Text></View>
      </>}
      {shownStep === 1 && <>
        {p.lesson && <View style={b.note}><Text style={b.kicker}>Selected lesson</Text><Text style={b.label}>{p.lesson.lesson_name}</Text></View>}
        <View style={b.stack}>{toggle(`Selected questions (${p.items.length})`, selectedOpen, setSelectedOpen)}{selectedOpen && (p.items.length ? questionCards(true) : <Notice>Add questions below, or save an empty draft from Review.</Notice>)}</View>
        <View style={b.stack}><View style={b.row}><Text accessibilityRole="header" style={b.heading}>Question bank</Text><Text style={b.muted}>{p.items.length} / 200 selected</Text></View><Text style={b.label}>Search questions</Text><TextInput accessibilityLabel="Search questions" style={b.input} value={p.query} editable={!p.frozen} placeholder="Search by question text" placeholderTextColor="#8C9B92" onChangeText={p.onQuery} onSubmitEditing={p.onSearch} />
          {toggle(`Question type: ${p.method ? names[p.method as AssignmentMethod] : "All types"}`, filtersOpen, setFiltersOpen)}
          {filtersOpen && <View style={b.stack}>{["", ...assignmentMethods].map(value => <Button key={value} label={value ? names[value as AssignmentMethod] : "All types"} primary={p.method === value} disabled={p.frozen} onPress={() => p.onMethod(value)} />)}</View>}
          <Button label="Search questions" disabled={p.frozen} onPress={p.onSearch} /><Button label="Clear filters" quiet disabled={p.frozen} onPress={p.onClearFilters} />
          {p.lesson && !p.frozen && <BuilderPicker key={p.filterKey} fetch={catalog} emptyTitle="No matching questions" emptyDescription="Try another search or question type. This lesson may not have published questions yet." render={item => {
            const added = p.items.some(value => value.question_id === item.question_id);
            return <View key={item.id} style={b.card}><View style={b.row}><Text style={b.tag}>{names[item.definition.method]}</Text><Text style={b.muted}>Version {item.version}</Text></View><Text style={b.label}>{item.definition.prompt}</Text><View style={b.actions}><View style={b.action}><Button label="Preview" onPress={() => p.onPreview(item)} /></View><View style={b.action}><Button label={added ? "✓ Added" : "+ Add question"} primary={!added} disabled={added || !item.eligible || p.items.length >= 200} onPress={() => p.onAdd(item)} /></View></View></View>;
          }} />}
        </View><View style={b.footer}><Button label="Review assignment" primary disabled={p.frozen} onPress={() => moveStep(2)} /><Button label="Back to details" disabled={p.busy} onPress={() => moveStep(0)} /></View>
      </>}
      {shownStep === 2 && <>
        <View style={b.row}><Text style={b.tag}>{readOnly ? p.row?.status === "published" ? "Published" : p.row?.status === "archived" ? "Archived" : "Draft" : p.row && !p.dirty ? "Draft saved" : "Unsaved changes"}</Text><Text style={b.muted}>{p.items.length} questions</Text></View>
        {readOnly && <Notice>{p.row?.status === "published" ? "This assignment is shared with eligible class members and can no longer be edited." : p.row?.status === "archived" ? "This draft is archived. Its saved details remain available to view." : "This assignment is currently available to view only."}</Notice>}
        <View style={b.card}><Text accessibilityRole="header" style={b.heading}>{p.title}</Text>{!!p.instructions && <Text style={b.body}>{p.instructions}</Text>}<View style={b.divider} />{p.lesson && <View style={b.stack}><Text style={b.muted}>Lesson</Text><Text style={b.label}>{p.lesson.lesson_name}</Text><Text style={b.muted}>Grade {p.lesson.grade} · {p.lesson.subject_name} · {p.lesson.curriculum_name ?? "Teacher lesson"}</Text></View>}{!readOnly && <Button label="Edit details" disabled={p.frozen} onPress={() => moveStep(0)} />}</View>
        <View style={b.row}><Text accessibilityRole="header" style={b.heading}>Questions ({p.items.length})</Text>{!readOnly && <Button label="Edit questions" quiet disabled={p.frozen} onPress={() => moveStep(1)} />}</View>
        {p.items.length ? questionCards(false) : <Notice>Your draft has no questions yet. You can save it now. Add at least one question before publishing.</Notice>}
        {!readOnly && <View style={b.footer}><Button label={p.pending ? "Retry original draft save" : p.row && !p.dirty ? "Draft saved" : "Save draft"} primary disabled={p.busy || p.uncertain || (!!p.row && !p.dirty)} busy={p.busy && !p.publication} onPress={p.onSave} />
          {p.row?.status === "draft" && <Button label={p.publication ? "Retry original publication" : "Publish assignment"} primary={!p.dirty} disabled={p.busy || p.dirty || !p.items.length || (!p.publication && (p.uncertain || !p.row.eligible))} onPress={p.onPublish} />}
          <Text style={[b.muted, b.center]}>{p.row && !p.dirty ? "Publishing makes this assignment available to eligible class members." : "Save your latest changes before publishing."}</Text>
        </View>}
        {!!p.row && !readOnly && <View style={b.stack}>{toggle("Draft options", optionsOpen, setOptionsOpen)}{optionsOpen && <><Button label="Reload saved draft" disabled={p.busy} onPress={p.onReload} /><Button label="Archive draft" disabled={p.busy || p.dirty || p.uncertain || p.pending} onPress={p.onArchive} /></>}</View>}
        <View style={b.stack}>{toggle("About assignments", aboutOpen, setAboutOpen)}{aboutOpen && <Text style={b.muted}>Choose existing published questions for one lesson. You can select up to 200 questions and arrange their order. Saving keeps your work as a draft. Publishing shares it with eligible current and later class members. This builder does not configure due dates, timers, or grading rules.</Text>}</View>
        <Button label="Back to assignments" quiet disabled={p.busy} onPress={p.onBack} />
      </>}
    </>}
  </BuilderShell>;
}
