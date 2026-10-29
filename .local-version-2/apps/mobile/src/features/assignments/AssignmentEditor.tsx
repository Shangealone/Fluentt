import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { router, usePreventRemove } from "expo-router";
import * as Crypto from "expo-crypto";
import { Button, EmptyState, ErrorMessage, Input, Loading, s } from "../../components/ui";
import { assignmentMethods, type AssignmentAccess, type AssignmentDraft, type AssignmentInput, type AssignmentItem, type AssignmentPage, type LessonContext } from "../../services/api/assignments";
import { addItem, draftError, DraftSubmission, moveItem } from "./state";
import { ItemPreview } from "./ItemPreview";

export function Picker<T>({ fetch, render, renderHeader, emptyTitle = "No eligible records", emptyDescription = "No sample content is added. Adjust filters or ask your content administrator." }: { fetch: (offset: number) => Promise<AssignmentPage<T>>; render: (row: T, index: number) => React.ReactNode; renderHeader?: (page: AssignmentPage<T>) => React.ReactNode; emptyTitle?: string; emptyDescription?: string }) {
  const [offset, setOffset] = useState(0), [retry, setRetry] = useState(0), [page, setPage] = useState<AssignmentPage<T> | null>(null), [error, setError] = useState("");
  useEffect(() => { let active = true;
    queueMicrotask(() => { if (!active) return; setPage(null); setError("");
      fetch(offset).then(value => { if (active) setPage(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load."); });
    });
    return () => { active = false; };
  }, [fetch, offset, retry]);
  return <View style={{ gap: 12 }}>{error ? <><ErrorMessage message={error} /><Button label="Retry loading" onPress={() => setRetry(x => x + 1)} /></> : !page ? <Loading /> : <>
    {renderHeader?.(page)}
    {!page.items.length && <EmptyState title={emptyTitle} description={emptyDescription} />}
    {page.items.map(render)}
    <Button label="Previous page" secondary disabled={!offset} onPress={() => setOffset(Math.max(0, offset - 20))} />
    <Text style={s.body}>Page {Math.floor(offset / 20) + 1}</Text><Button label="Next page" secondary disabled={!page.has_more} onPress={() => setOffset(offset + 20)} />
  </>}</View>;
}

export function AssignmentEditor({ initial, classId, api, active = true }: { initial: AssignmentDraft | null; classId: string; api: AssignmentAccess; active?: boolean }) {
  const [row, setRow] = useState(initial), [title, setTitle] = useState(initial?.title ?? ""), [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [lesson, setLesson] = useState<LessonContext | null>(initial?.context ?? null), [items, setItems] = useState<AssignmentItem[]>(initial?.questions ?? []);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [query, setQuery] = useState(""), [filters, setFilters] = useState({ q: "", method: "" }), [method, setMethod] = useState("");
  const [preview, setPreview] = useState<AssignmentItem | null>(null), [confirm, setConfirm] = useState<{ message: string; accept: () => void } | null>(null);
  const [submission] = useState(() => new DraftSubmission());
  const lock = useRef(false), alive = useRef(true), [uncertain, setUncertain] = useState(false);
  const [publication, setPublication] = useState<{ row: AssignmentDraft; key: string } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const prevent = usePreventRemove(active && (dirty || busy || !!submission.pending), ({ repeat }) => {
    if (!lock.current) setConfirm({ message: "Discard unsaved changes? If a save was interrupted, inspect drafts before creating another.", accept: () => { setDirty(false); submission.pending = null; repeat(); } });
  });
  const editable = !row || row.editable, frozen = busy || !!submission.pending || uncertain || !editable;
  const fetchLessons = useCallback((offset: number) => api.lessons(classId, "", offset), [api, classId]);
  const fetchQuestions = useCallback((offset: number) => api.questions(classId, lesson!.lesson_id, filters.q, filters.method, offset), [api, classId, lesson, filters]);
  function changed() { setDirty(true); setNotice(""); setPreview(null); }
  function restore(saved: AssignmentDraft) { setRow(saved); setTitle(saved.title); setInstructions(saved.instructions ?? ""); setLesson(saved.context); setItems(saved.questions); setDirty(false); setPreview(null); setUncertain(false); }
  async function save() {
    if (lock.current || uncertain || !editable) return;
    const body: AssignmentInput = { title: title.trim(), instructions: instructions.trim() || null, lesson_id: lesson?.lesson_id ?? "", question_revision_ids: items.map(item => item.id) };
    const invalid = draftError(body, items); if (invalid) { setError(invalid); return; }
    lock.current = true; setBusy(true); setError(""); setPreview(null);
    try {
      const saved = row ? await api.save(row, body) : await submission.create(body, (data, key) => api.create(classId, data, key), Crypto.randomUUID) as AssignmentDraft;
      if (alive.current) { restore(saved); setNotice("Draft saved. Students cannot access it."); }
    } catch (cause) {
      if (alive.current) { setError(cause instanceof Error ? cause.message : "Save failed.");
        const status = (cause as { status?: number }).status; if (row && (!status || status === 408 || status >= 500 || status === 409)) setUncertain(true);
      }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function reload() {
    if (!row || lock.current) return;
    lock.current = true; setBusy(true); setPreview(null); setError("");
    try { const saved = await api.get(row.id); if (alive.current) restore(saved); }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Reload failed."); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function archive() {
    if (!row || lock.current || dirty || !editable) return;
    lock.current = true; setBusy(true); setError("");
    try { const saved = await api.archive(row); if (alive.current) { restore(saved); setNotice("Draft archived. Its references are retained."); } }
    catch (cause) { if (alive.current) { setError(cause instanceof Error ? cause.message : "Archive failed. Reload before retrying."); setUncertain(true); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function publish() {
    if (!row || lock.current || dirty || !editable || (!publication && uncertain)) return;
    const pending = publication ?? { row, key: Crypto.randomUUID() };
    setPublication(pending);
    lock.current = true; setBusy(true); setError(""); setPreview(null);
    try {
      const saved = await api.publish(pending.row, pending.key);
      if (alive.current) { setPublication(null); restore(saved); setNotice("Published. Eligible current and later class members can view the assignment details. No notifications were sent."); }
    } catch (cause) {
      if (alive.current) { setError(cause instanceof Error ? cause.message : "Publish outcome unknown. Retry the same publication or reload."); setUncertain(true); }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <View style={{ gap: 16 }}>
    <Button label="Back to assignment drafts" secondary disabled={busy} onPress={() => router.replace({ pathname: "/assignments", params: { classId } })} />
    <Text accessibilityRole="header" style={s.heading}>{row?.status === "published" ? "Published assignment" : row ? `${row.status === "archived" ? "Archived" : "Edit"} draft` : "Create assignment draft"}</Text>
    <Text style={s.body}>{row?.status === "published" ? "Published version is immutable. Eligible current and later class members can view details. No notifications are sent. Question answering is not available yet." : "Save and review your draft before publishing. No scoring, due date, timer, attempts or feedback settings are configured."}</Text>
    {!!error && <ErrorMessage message={error} />}{!!notice && <Text accessibilityRole="alert" style={s.body}>{notice}</Text>}
    {confirm ? <View style={s.card}><Text accessibilityRole="header" style={s.heading}>{confirm.message}</Text>
      <Button label="Keep current state" onPress={() => setConfirm(null)} /><Button label="Confirm" secondary onPress={() => { const action = confirm.accept; setConfirm(null); action(); }} />
    </View> : <>
      <Text style={s.heading}>Title</Text><Input accessibilityLabel="Assignment title" value={title} editable={!frozen} onChangeText={value => { setTitle(value); changed(); }} />
      <Text style={s.heading}>Instructions (optional)</Text><Input accessibilityLabel="Assignment instructions" multiline value={instructions} editable={!frozen} onChangeText={value => { setInstructions(value); changed(); }} />
      {row?.requires_subject && <Text style={s.body}>Class subject is unbound. This draft records its lesson subject; explicit class binding is required before future publication.</Text>}
      <Text style={s.heading}>Curriculum lesson</Text>
      {lesson && <Text style={s.body}>{lesson.curriculum_name} · Grade {lesson.grade} · {lesson.subject_name} · {lesson.lesson_name}</Text>}
      {editable && !frozen && <Picker fetch={fetchLessons} render={choice => <Button key={choice.lesson_id} secondary label={`Use lesson: ${choice.lesson_name} · ${choice.subject_name} · ${choice.curriculum_name}`}
        onPress={() => {
          if (choice.lesson_id === lesson?.lesson_id) return;
          const select = () => { setLesson(choice); setItems([]); setFilters({ q: "", method: "" }); changed(); };
          if (items.length) setConfirm({ message: "Change lesson and remove selected items?", accept: select }); else select();
        }} />} />}
      <Text style={s.heading}>Selected questions ({items.length}/200)</Text>
      {!items.length && <Text style={s.body}>No questions selected. Empty drafts can be saved.</Text>}
      {items.map((item, index) => <View key={item.question_id} style={s.card}>
        <Text style={s.body}>{index + 1}. {item.definition.prompt} · {item.definition.method} · Version {item.version}{!item.eligible ? row?.status === "published" ? " · Retained published version; no longer selectable for new drafts" : " · Ineligible: remove or replace" : ""}</Text>
        <Button label={`Preview selected question ${index + 1}`} secondary disabled={busy} onPress={() => setPreview(item)} />
        <Button label={`Move question ${index + 1} earlier`} secondary disabled={frozen || index === 0} onPress={() => { setItems(moveItem(items, index, -1)); changed(); }} />
        <Button label={`Move question ${index + 1} later`} secondary disabled={frozen || index === items.length - 1} onPress={() => { setItems(moveItem(items, index, 1)); changed(); }} />
        <Button label={`Remove question ${index + 1}`} secondary disabled={frozen} onPress={() => { setItems(items.filter(value => value.id !== item.id)); changed(); }} />
      </View>)}
      {lesson && editable && !frozen && <>
        <Text style={s.heading}>Published question versions</Text><Input accessibilityLabel="Search question prompts" value={query} onChangeText={setQuery} />
        <View style={{ gap: 8 }}>{["", ...assignmentMethods].map(value => <Button key={value} secondary label={value || "All answer methods"} onPress={() => setMethod(value)} disabled={method === value} />)}</View>
        <Button label="Apply question filters" onPress={() => setFilters({ q: query.trim().slice(0, 200), method })} />
        <Picker key={JSON.stringify([lesson.lesson_id, filters])} fetch={fetchQuestions} render={item => <View key={item.id} style={s.card}>
          <Text style={s.body}>{item.definition.prompt} · {item.definition.method} · Version {item.version}</Text>
          <Button label={`Preview ${item.definition.method} version ${item.version}`} secondary onPress={() => setPreview(item)} />
          <Button label={`Add ${item.definition.method} version ${item.version}`} disabled={items.length >= 200 || items.some(value => value.question_id === item.question_id)} onPress={() => { setItems(addItem(items, item)); changed(); }} />
        </View>} />
      </>}
      {preview && <><ItemPreview key={preview.id} row={preview} /><Button label="Close item preview" secondary onPress={() => setPreview(null)} /></>}
      <Button label={submission.pending ? "Retry original draft save" : "Save draft"} disabled={busy || uncertain || !editable} onPress={() => void save()} />
      {submission.pending && <Text style={s.body}>Save outcome unknown. Retry preserves the original body/key. After restarting, inspect drafts before creating another.</Text>}
      {row && <><Button label="Reload saved draft" secondary disabled={busy} onPress={() => {
        if (dirty) setConfirm({ message: "Discard local edits and reload the saved draft?", accept: () => { setPublication(null); void reload(); } }); else { setPublication(null); void reload(); }
      }} /><Button label="Archive draft" secondary disabled={busy || dirty || !editable || uncertain} onPress={() => setConfirm({ message: "Archive this draft and retain its references?", accept: () => void archive() })} /></>}
      {row?.status === "draft" && <Button label={publication ? "Retry original publication" : "Review and publish"}
        disabled={busy || dirty || !editable || !items.length || (!publication && (uncertain || !row.eligible))}
        onPress={() => setConfirm({ message: `Publish this saved assignment immediately to all eligible current and later class members?${row.requires_subject ? ` This explicitly binds the class subject to ${row.context.subject_name}.` : ""} Published assignments cannot be edited or archived. Questions and attempts are not released yet.`, accept: () => void publish() })} />}
      <Button label="Leave draft builder" secondary disabled={busy} onPress={() => { if (!dirty && !submission.pending) { prevent(); router.replace({ pathname: "/assignments", params: { classId } }); } else router.replace({ pathname: "/assignments", params: { classId } }); }} />
    </>}
  </View>;
}
