import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, View } from "react-native";
import { router, useFocusEffect, usePreventRemove } from "expo-router";
import * as Crypto from "expo-crypto";
import { Text } from "../../accessibility/Primitives";
import type { TeacherLesson, TeacherLessonInput, TeacherLessonAccess, TeacherQuestion, LessonCommand } from "../../services/api/teacherLessons";
import type { ClassDetails } from "../../services/api/classes";
import { LessonButton, LessonFrame, LessonHero, LessonLoading, LessonNote, l } from "./LessonUI";
import { LessonDetailsFields, LessonReview, LessonSharePicker, LessonSteps, lessonSteps, type LessonStep } from "./LessonEditorParts";
import { cloneQuestion, newQuestion, prepareQuestion, TeacherQuestionPreview } from "./QuestionAuthor";

import { LessonReadingPreview } from "./LessonContentEditor";
import { sectionIssue } from "./sectionEditing";
import { LessonWritingEditor, partHeading } from "./LessonWritingEditor";
import { SimpleQuestionAuthor, simpleQuestionError as questionError } from "./SimpleQuestionAuthor";
import { LessonQuestionList } from "./LessonQuestionList";
import { w } from "./WritingUI";

type Confirmation = { title: string; message: string; label: string; accept: () => void };
type Pending = { base: TeacherLesson | null; body: TeacherLessonInput | LessonCommand; key: string; action: string; returnStep?: LessonStep; section?: number | null };
function fromRow(row: TeacherLesson): TeacherLessonInput { return cloneQuestion({ title: row.title, introduction: row.introduction, grade: row.grade, proficiency_level: row.proficiency_level ?? null, language: row.language, subject_id: row.subject_id, sections: row.sections, questions: row.questions }); }
function blank(classroom?: ClassDetails | null): TeacherLessonInput { return { title: "", introduction: null, grade: null, proficiency_level: classroom?.proficiency_level ?? null, language: classroom?.language ?? "english", subject_id: "", sections: [], questions: [] }; }
function draftError(body: TeacherLessonInput) {
  if (!body.title.trim() || Array.from(body.title.trim()).length > 200) return "Give your lesson a title of 1–200 characters.";
  if (!body.subject_id) return "Choose a subject before saving.";
  if (Array.from(body.introduction ?? "").length > 8000) return "Keep the introduction to 8,000 characters or fewer.";
  if (body.sections.length > 50 || body.sections.some(s => !s.heading.trim() || !s.body.trim() || Array.from(s.heading).length > 200 || Array.from(s.body).length > 20000)) return "Give each section a heading and text, or remove unfinished sections. Headings allow 200 characters; text allows 20,000.";
  if (body.questions.length > 200) return "Use up to 200 questions in one lesson.";
  for (const q of body.questions) { const issue = questionError(q); if (issue) return issue; }
  return null;
}

export function LessonEditor({ initial, subjects, api, classId, classroom, initialStep = "Details", initialSection = 0, active = true, onReturnToAssignment }: { initial: TeacherLesson | null; subjects: { id: string; name: string }[]; api: TeacherLessonAccess; classId: string; classroom?: ClassDetails | null; initialStep?: LessonStep; initialSection?: number; active?: boolean; onReturnToAssignment?: (saved: TeacherLesson | null) => void }) {
  const [row, setRow] = useState(initial), [draft, setDraft] = useState(() => initial ? fromRow(initial) : blank(classroom));
  const [step, setStep] = useState<LessonStep>(initial?.status === "published" || initial?.status === "archived" ? "Review" : initialStep);
  const [busy, setBusy] = useState(false), [reading, setReading] = useState(false), [dirty, setDirty] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [pending, setPending] = useState<Pending | null>(null), [mustReload, setMustReload] = useState(false), [accessError, setAccessError] = useState(false);
  const [confirm, setConfirm] = useState<Confirmation | null>(null), [about, setAbout] = useState(false), [shareMode, setShareMode] = useState<"share" | "unshare" | null>(null);
  const [question, setQuestion] = useState<{ index: number; value: TeacherQuestion } | null>(null), [questionDirty, setQuestionDirty] = useState(false), [preview, setPreview] = useState<TeacherQuestion | null>(null);
  const [contentPreview, setContentPreview] = useState(false), [activeSection, setActiveSection] = useState<number | null>(initialSection < 0 ? null : initialSection), [contentValidation, setContentValidation] = useState(false), [contentFocus, setContentFocus] = useState(0);
  const [dragging, setDragging] = useState(false), [choosingQuestionType, setChoosingQuestionType] = useState(false);
  const live = useRef(false), lock = useRef(false), epoch = useRef(0);
  useFocusEffect(useCallback(() => { live.current = true; return () => { live.current = false; epoch.current++; }; }, []));
  const hasUnsaved = dirty || questionDirty;
  useEffect(() => {
    if (Platform.OS !== "web" || (!hasUnsaved && !busy && !pending && !mustReload)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved, busy, pending, mustReload]);
  const prevent = usePreventRemove(active && (hasUnsaved || busy || !!pending || mustReload || !!onReturnToAssignment), ({ repeat }) => {
    if (lock.current) return;
    if (onReturnToAssignment) { setConfirm({ title: "Return to your assignment first", message: "Leaving this lesson editor discards unsaved lesson edits and retry details. Your assignment stays here until you return to it.", label: "Return to assignment", accept: () => onReturnToAssignment(row) }); return; }
    setConfirm({ title: pending || mustReload ? "Leave an uncertain request?" : "Leave with unsaved changes?", message: pending || mustReload ? "This request may have completed. Your retry details will be cleared when you leave. Check your lesson library before creating another lesson or repeating a change." : "Your latest edits haven’t been saved. Stay here to save your draft, or leave and discard them.", label: "Leave lesson", accept: () => { setPending(null); setDirty(false); setQuestionDirty(false); repeat(); } });
  });
  const editable = !row || row.status === "draft", frozen = busy || !!pending || mustReload || !editable;
  const move = (next: LessonStep) => {
    if (frozen || dragging) return;
    if (next !== "Details" && (!draft.title.trim() || !draft.subject_id)) { setError("Add a lesson title and choose its subject before continuing."); setStep("Details"); return; }
    setStep(next); setError(""); setPreview(null);
  };
  function change(next: TeacherLessonInput) { if (!frozen) { setDraft(next); setDirty(true); setNotice(""); } }
  function clearProtected() { setAccessError(true); setRow(null); setDraft(blank()); setPending(null); setQuestion(null); setPreview(null); setContentPreview(false); setActiveSection(null); setContentValidation(false); setQuestionDirty(false); setDirty(false); }
  function restore(saved: TeacherLesson) { setRow(saved); setDraft(fromRow(saved)); setPending(null); setMustReload(false); setDirty(false); setQuestion(null); setQuestionDirty(false); setPreview(null); setContentPreview(false); setContentValidation(false); }
  async function send(operation: Pending) {
    if (lock.current || !live.current || !active) return;
    lock.current = true; setBusy(true); setError(""); setPending(operation); setPreview(null);
    const current = epoch.current;
    try {
      const saved = operation.base ? await api.change(operation.base, operation.body as LessonCommand, operation.key) : await api.create(operation.body as TeacherLessonInput, operation.key);
      if (!live.current || current !== epoch.current) return;
      const destination = operation.returnStep ?? (operation.action === "new_version" ? "Details" : "Review");
      restore(saved); setShareMode(null); setStep(destination);
      setNotice(operation.action === "publish" ? "Version published. Choose classes separately to share it." : operation.action === "share" ? "Lesson shared with the selected classes." : operation.action === "unshare" ? "Selected class shares stopped. Existing assignments are retained." : operation.action === "new_version" ? "Your new draft is ready. Existing shared lessons and assignments keep their original versions." : operation.action === "archive" ? "Lesson archived. Its history and existing class shares are retained." : "Draft saved. Students can’t see this draft.");
      if (!onReturnToAssignment && (!initial || initial.version_id !== saved.version_id)) {
        prevent(); router.replace({ pathname: "/instructor-lesson", params: { id: saved.id, versionId: saved.version_id, step: destination, ...(destination === "Content" ? { section: String(operation.section ?? -1) } : {}), ...(classId ? { classId } : {}) } });
      }
    } catch (cause) {
      if (!live.current || current !== epoch.current) return;
      const status = (cause as { status?: number }).status;
      setError(cause instanceof Error ? cause.message : "We couldn’t confirm this request. Please try again.");
      if (status === 401 || status === 403 || status === 404) clearProtected();
      else if (!status || status === 408 || status >= 500) { /* Retain the exact original body/key and freeze conflicting actions. */ }
      else { setPending(null); if ([409, 412, 428].includes(status)) setMustReload(true); }
    } finally { lock.current = false; if (live.current && current === epoch.current) setBusy(false); }
  }
  function command(action: LessonCommand["action"], extra: Partial<LessonCommand> = {}) {
    if (!row || lock.current || pending || mustReload) return;
    const body: LessonCommand = { action, version_id: row.version_id, confirm: true, ...extra };
    void send({ base: cloneQuestion(row), body: cloneQuestion(body), key: Crypto.randomUUID(), action });
  }
  function save() {
    if (frozen) return;
    const body = { ...cloneQuestion(draft), title: draft.title.trim(), introduction: draft.introduction?.trim() || null, sections: draft.sections.map((section, index) => ({ ...section, heading: partHeading(section.heading, index) })), questions: draft.questions.map(prepareQuestion) };
    const invalid = draftError(body); if (invalid) {
      setError(invalid);
      if (!body.title.trim() || !body.subject_id || Array.from(body.title).length > 200 || Array.from(body.introduction ?? "").length > 8000) setStep("Details");
      else {
        const index = body.sections.findIndex(section => sectionIssue(section));
        if (index >= 0) { setContentValidation(true); setActiveSection(index); setStep("Content"); setContentFocus(value => value + 1); }
        else if (body.questions.length > 200 || body.questions.some(q => questionError(q))) setStep("Quiz");
      }
      return;
    }
    void send({ base: row ? cloneQuestion(row) : null, body: row ? { action: "save", version_id: row.version_id, draft: body } : body, key: Crypto.randomUUID(), action: "save", returnStep: step, section: activeSection });
  }
  async function reload() {
    if (!row || lock.current) return;
    lock.current = true; setBusy(true); setReading(true); setError(""); setPreview(null); setQuestion(null);
    const current = epoch.current;
    try { const saved = await api.get(row.id, row.version_id); if (live.current && current === epoch.current) { restore(saved); setAccessError(false); } }
    catch (cause) { if (live.current && current === epoch.current) { setError(cause instanceof Error ? cause.message : "Couldn’t reload the lesson."); clearProtected(); } }
    finally { lock.current = false; if (live.current && current === epoch.current) { setBusy(false); setReading(false); } }
  }
  function confirmReload() { setConfirm({ title: "Reload the saved lesson?", message: "This discards local edits and reads the current saved version. If another device changed the lesson, you’ll see that version. Interrupted publication or sharing should first be retried with its original request.", label: "Reload saved lesson", accept: () => void reload() }); }
  function leave() {
    if (onReturnToAssignment) {
      if (hasUnsaved || pending || mustReload) setConfirm({ title: "Return to your assignment?", message: "Unsaved lesson edits and retry details will be discarded. Your assignment details will stay.", label: "Return to assignment", accept: () => onReturnToAssignment(row) });
      else onReturnToAssignment(row);
      return;
    }
    router.replace(classId ? { pathname: "/instructor-lessons", params: { classId } } : "/instructor-lessons"); }
  function cancelQuestion() { const cancel = () => { setQuestion(null); setQuestionDirty(false); setPreview(null); setContentPreview(false); setContentValidation(false); }; if (questionDirty) setConfirm({ title: "Discard question changes?", message: "These question edits haven’t been added to your lesson. Your other lesson details will stay.", label: "Discard question edits", accept: cancel }); else cancel(); }
  const onBack = () => { if (contentPreview) setContentPreview(false); else if (preview) setPreview(null); else if (question) cancelQuestion(); else if (shareMode) setShareMode(null); else leave(); };
  const account = () => {
    if (lock.current) return;
    if (onReturnToAssignment) { leave(); return; }
    if (hasUnsaved || pending || mustReload) {
      setConfirm({ title: pending || mustReload ? "Leave an uncertain request?" : "Leave with unsaved changes?", message: pending || mustReload ? "The request may have completed. Leaving clears this screen’s retry details. Check your library before repeating the operation." : "Opening your account will discard these unsaved lesson and question edits. Stay here to save them first.", label: "Open my account", accept: () => { setPending(null); setDirty(false); setQuestionDirty(false); prevent(); router.push("/account"); } });
    } else router.push("/account");
  };
  const frame = (children: ReactNode) => <LessonFrame busy={busy || dragging} scrollEnabled={!dragging} scrollKey={`${step}-${!!confirm}-${!!question}-${!!preview}-${contentPreview}-${shareMode}-${!!pending}-${error}-${contentFocus}`} onBack={onBack} onAccount={account}>{children}</LessonFrame>;
  if (accessError) return frame(<><LessonHero title="This lesson is unavailable" description="Return to your library to check your saved lessons." />{!!error && <LessonNote error>{error}</LessonNote>}<LessonButton label="Back to my lessons" primary onPress={() => { prevent(); leave(); }} /></>);
  if (reading) return frame(<LessonLoading label="Loading the saved lesson…" />);
  if (confirm) return frame(<View style={[l.card, l.confirmation]}><Text accessibilityRole="header" style={l.heading}>{confirm.title}</Text><Text style={l.body}>{confirm.message}</Text><LessonButton label="Stay here" primary onPress={() => setConfirm(null)} disabled={busy} /><LessonButton label={confirm.label} onPress={() => { const action = confirm.accept; setConfirm(null); action(); }} disabled={busy} /></View>);
  if (contentPreview) return frame(<LessonReadingPreview draft={{ ...draft, sections: draft.sections.map((section, i) => ({ ...section, heading: partHeading(section.heading, i) })) }} onClose={() => setContentPreview(false)} />);
  if (preview) return frame(<TeacherQuestionPreview key={JSON.stringify(preview)} question={preview} onClose={() => setPreview(null)} />);
  const showPreview = (q: TeacherQuestion) => { if (busy || pending || mustReload) return; const issue = questionError(prepareQuestion(q)); if (issue) { setError(issue); return; } setPreview(cloneQuestion(q)); };
  if (question) return frame(<><View style={w.intro}><Text accessibilityRole="header" style={w.title}>{question.index < 0 ? "Add a question" : "Edit question"}</Text><Text style={w.body}>Keep it clear. Help students know what to do.</Text></View>{!!error && <LessonNote error>{error}</LessonNote>}<SimpleQuestionAuthor key={`${question.index}`} initiallyChooseType={question.index < 0} onChoosingChange={setChoosingQuestionType} value={question.value} disabled={frozen} onChange={value => { if (!frozen) { setQuestion({ ...question, value }); setQuestionDirty(true); setError(""); } }} />{!choosingQuestionType && <><LessonButton label="Preview as a student" disabled={frozen} onPress={() => showPreview(question.value)} /><LessonButton label={question.index < 0 ? "Add to lesson" : "Update question"} primary disabled={frozen} onPress={() => { const value = prepareQuestion(question.value), issue = questionError(value); if (issue) { setError(issue); setContentFocus(v => v + 1); return; } if (question.index < 0 && draft.questions.length >= 200) { setError("Use up to 200 questions in one lesson."); return; } const questions = [...draft.questions]; if (question.index < 0) questions.push(value); else questions[question.index] = value; change({ ...draft, questions }); setQuestion(null); setQuestionDirty(false); setError(""); }} /><Text style={l.small}>Updates your draft here. Use Save draft to save the lesson.</Text></>}<LessonButton label="Back to questions" quiet disabled={busy} onPress={cancelQuestion} /></>);
  if (shareMode && row && !pending && !mustReload) return frame(<><LessonHero title={shareMode === "share" ? "Share your lesson" : "Manage class access"} description="Choose where your lesson belongs." />{!!error && <LessonNote error>{error}</LessonNote>}<LessonSharePicker row={row} api={api} mode={shareMode} disabled={busy} onClose={() => setShareMode(null)} onConfirm={(classIds, names, bind) => setConfirm({ title: shareMode === "share" ? "Share with these classes?" : "Stop these class shares?", message: `${row.title}, version ${row.version}: ${names.join(", ")}. ${shareMode === "share" ? "The class reading version will be updated. Existing assignments stay unchanged." : "The lesson will leave these class directories. Existing assignments and answers stay available under their current rules."}${bind ? ` This also sets ${row.subject_name} as the unbound classes’ subject, if their retained content agrees.` : ""}`, label: shareMode === "share" ? "Share lesson" : "Stop sharing", accept: () => command(shareMode === "share" ? "share" : "unshare", { class_ids: classIds, bind_subject: bind }) })} /></>);
  return frame(<>
    {(step === "Details" || !editable) && <LessonHero title={editable ? "Create a lesson" : "Your lesson"} description={editable ? "A little structure. A lot of possibility." : "Keep your ideas growing."} />}
    {!!pending && <View style={[l.card, l.confirmation]}><Text accessibilityRole="header" style={l.heading}>We couldn’t confirm the request</Text><Text style={l.body}>Your original details are retained. Editing is paused while you retry this same request.</Text><LessonButton label={busy ? "Working…" : "Retry original request"} primary disabled={busy} onPress={() => void send(pending)} />{row && <LessonButton label="Reload saved lesson" disabled={busy} onPress={confirmReload} />}</View>}
    {mustReload && <LessonNote>Another change may exist. Reload the saved version before editing or publishing.</LessonNote>}
    {!!error && <LessonNote error>{error}</LessonNote>}{!!notice && <LessonNote>{notice}</LessonNote>}
    {editable && <><LessonSteps value={step} disabled={frozen || dragging} onSelect={move} /><Text accessibilityLiveRegion="polite" style={l.small}>{hasUnsaved ? "Unsaved changes" : row ? "Draft saved" : "Not saved yet"}</Text></>}
    {step === "Details" && editable && <LessonDetailsFields draft={draft} subjects={subjects} change={change} disabled={frozen} />}
    {step === "Content" && editable && <><LessonWritingEditor sections={draft.sections} active={activeSection} onActive={setActiveSection} onChange={sections => change({ ...draft, sections })} disabled={frozen} showValidation={contentValidation} focusRequest={contentFocus} /><LessonButton label="Preview as a student" disabled={frozen} onPress={() => setContentPreview(true)} /><LessonButton label={busy ? "Saving…" : "Save draft"} primary disabled={frozen} onPress={save} /><Text style={l.small}>Saves your whole lesson, including its questions. Switching parts keeps your writing here until you save.</Text></>}
    {step === "Quiz" && editable && <LessonQuestionList onDragStateChange={setDragging} questions={draft.questions} onChange={questions => change({ ...draft, questions })} onEdit={index => { if (!frozen) { setChoosingQuestionType(index < 0); setQuestion({ index, value: index < 0 ? newQuestion() : cloneQuestion(draft.questions[index]) }); setQuestionDirty(false); setError(""); } }} onPreview={showPreview} disabled={frozen} />}
    {step === "Quiz" && editable && <><LessonButton label={busy ? "Saving…" : "Save draft"} primary disabled={frozen || dragging} onPress={save} /><Text style={w.small}>Saves the whole lesson draft.</Text></>}
    {(step === "Review" || !editable) && <LessonReview row={row} draft={{ ...draft, sections: draft.sections.map((section, i) => ({ ...section, heading: partHeading(section.heading, i) })) }} subjectName={row?.subject_name ?? subjects.find(s => s.id === draft.subject_id)?.name ?? "Choose a subject"} editable={editable && !frozen} onEdit={move} onPreview={showPreview} />}
    {editable && step !== "Review" && <><LessonButton label={step === "Content" ? "Continue to questions" : step === "Quiz" ? "Continue to review" : "Continue to writing"} primary={step === "Details"} disabled={frozen || dragging} onPress={() => move(lessonSteps[lessonSteps.indexOf(step) + 1])} />{step !== "Details" && <LessonButton label={step === "Quiz" ? "Back to writing" : "Back to details"} quiet disabled={frozen || dragging} onPress={() => move(lessonSteps[lessonSteps.indexOf(step) - 1])} />}</>}
    {editable && step === "Review" && <><LessonButton label={busy ? "Saving…" : "Save draft"} primary disabled={frozen} onPress={save} /><LessonButton label="Publish lesson" disabled={frozen || dirty || !row} onPress={() => setConfirm({ title: "Publish this lesson?", message: "This freezes the lesson content and question versions. Students won’t see it until you share it with a class.", label: "Publish lesson", accept: () => command("publish") })} /><Text style={l.small}>{dirty || !row ? "Save your latest draft before publishing." : "Publishing freezes this version. Choose classes separately when you’re ready."}</Text></>}
    {row?.status === "published" && <><LessonButton label="Share with a class" primary disabled={busy || !!pending || mustReload} onPress={() => setShareMode("share")} /><LessonButton label="Create a new version" disabled={busy || !!pending || mustReload || row.versions.some(v => !v.published_at)} onPress={() => setConfirm({ title: "Create a new draft version?", message: "Your published lesson, existing class readings, assignments, and student work will stay unchanged. Share the new version separately when it’s ready.", label: "Create new version", accept: () => command("new_version") })} /><LessonNote>This published version stays unchanged. Make a new version to update your lesson.</LessonNote><LessonButton label="Archive lesson" quiet disabled={busy || !!pending || mustReload} onPress={() => setConfirm({ title: "Archive this lesson?", message: "This blocks new selection and sharing. Existing shared versions, assignments, and student answers are retained.", label: "Archive lesson", accept: () => command("archive") })} /></>}
    {row?.status === "archived" && <LessonNote>This lesson is archived. Its existing class shares and published assignments retain their original content.</LessonNote>}
    {!!row?.published_at && <LessonButton label="Stop sharing with a class" quiet disabled={busy || !!pending || mustReload} onPress={() => setShareMode("unshare")} />}
    {!onReturnToAssignment && row && !dirty && !pending && !mustReload && <View style={l.stack}><LessonButton label="Version history" quiet disabled={busy} onPress={() => setAbout(v => !v)} />{about && row.versions.map(v => <LessonButton key={v.version_id} label={`Open version ${v.version} · ${v.published_at ? "Published" : "Draft"}`} disabled={busy || v.version_id === row.version_id} onPress={() => router.push({ pathname: "/instructor-lesson", params: { id: row.id, versionId: v.version_id, ...(classId ? { classId } : {}) } })} />)}</View>}
    {row && <LessonButton label="Reload saved lesson" quiet disabled={busy} onPress={confirmReload} />}
    <LessonButton label="About your lessons" quiet disabled={busy} onPress={() => setAbout(v => !v)} />{about && <Text style={l.small}>Your lesson library belongs to you. Sharing is explicit and limited to compatible classes you own. Quiz work uses class assignments. Reading lessons does not measure ability or record completion.</Text>}
  </>);
}
