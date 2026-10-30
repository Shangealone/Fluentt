import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Text } from "../../accessibility/Primitives";

import { router, usePreventRemove } from "expo-router";
import * as Crypto from "expo-crypto";
import { Button, EmptyState, ErrorMessage, Loading, s } from "../../components/ui";
import { type AssignmentAccess, type AssignmentDraft, type AssignmentInput, type AssignmentItem, type AssignmentPage, type LessonContext } from "../../services/api/assignments";
import { addItem, draftError, DraftSubmission, moveItem } from "./state";
import { BuilderView, type BuilderConfirmation } from "./BuilderView";
import type { ClassDetails } from "../../services/api/classes";

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

export function AssignmentEditor({ initial, classId, classroom, api, active = true }: { initial: AssignmentDraft | null; classId: string; classroom: ClassDetails; api: AssignmentAccess; active?: boolean }) {
  const [row, setRow] = useState(initial), [title, setTitle] = useState(initial?.title ?? ""), [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [lesson, setLesson] = useState<LessonContext | null>(initial?.context ?? null), [items, setItems] = useState<AssignmentItem[]>(initial?.questions ?? []);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [query, setQuery] = useState(""), [filters, setFilters] = useState({ q: "", method: "" }), [method, setMethod] = useState("");
  const [preview, setPreview] = useState<AssignmentItem | null>(null), [confirm, setConfirm] = useState<BuilderConfirmation | null>(null);
  const [submission] = useState(() => new DraftSubmission());
  const lock = useRef(false), alive = useRef(true), [uncertain, setUncertain] = useState(false);
  const [publication, setPublication] = useState<{ row: AssignmentDraft; key: string } | null>(null);
  useEffect(() => { alive.current = active; return () => { alive.current = false; }; }, [active]);
  const prevent = usePreventRemove(active && (dirty || busy || !!submission.pending), ({ repeat }) => {
    if (!lock.current) setConfirm({ title: "Leave this assignment?", label: "Leave without saving", message: "Your unsaved changes will be lost. If a save was interrupted, check your assignments before creating another draft.", accept: () => { setDirty(false); submission.pending = null; repeat(); } });
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
  return <BuilderView classroom={classroom} row={row} title={title} instructions={instructions} lesson={lesson} items={items}
    busy={busy} frozen={frozen} editable={editable} dirty={dirty} error={error} notice={notice} uncertain={uncertain}
    pending={!!submission.pending} publication={!!publication} preview={preview} confirm={confirm}
    query={query} method={method} filterKey={JSON.stringify([lesson?.lesson_id, filters])}
    fetchLessons={fetchLessons} fetchQuestions={fetchQuestions}
    onTitle={value => { setTitle(value); changed(); }} onInstructions={value => { setInstructions(value); changed(); }}
    onLesson={choice => {
      if (frozen || choice.lesson_id === lesson?.lesson_id) return;
      const select = () => { setLesson(choice); setItems([]); setFilters({ q: "", method: "" }); setQuery(""); setMethod(""); changed(); };
      if (items.length) setConfirm({ title: "Change the lesson?", label: "Change lesson", message: "Changing the lesson removes your selected questions. Your assignment title and instructions will stay.", accept: select }); else select();
    }}
    onPreview={setPreview} onQuery={setQuery} onMethod={setMethod}
    onSearch={() => setFilters({ q: query.trim().slice(0, 200), method })}
    onClearFilters={() => { setQuery(""); setMethod(""); setFilters({ q: "", method: "" }); }}
    onAdd={item => { if (!frozen) { setItems(addItem(items, item)); changed(); } }}
    onMove={(index, delta) => { if (!frozen) { setItems(moveItem(items, index, delta)); changed(); } }}
    onRemove={item => { if (!frozen) { setItems(items.filter(value => value.id !== item.id)); changed(); } }}
    onSave={() => void save()}
    onReload={() => {
      const action = () => { setPublication(null); void reload(); };
      if (dirty) setConfirm({ title: "Reload your saved draft?", label: "Reload draft", message: "Your unsaved changes will be discarded.", accept: action }); else action();
    }}
    onArchive={() => setConfirm({ title: "Archive this draft?", label: "Archive draft", message: "This draft will become read-only. Its saved details will be retained.", accept: () => void archive() })}
    onPublish={() => setConfirm({ title: "Share with your class?", label: publication ? "Retry original publication" : "Publish assignment", message: `Eligible current and later members of this class will be able to open the assignment. Once published, it cannot be edited or archived.${row?.requires_subject ? ` Publishing also sets the class subject to ${row.context.subject_name}.` : ""}`, accept: () => void publish() })}
    onBack={() => { if (!dirty && !submission.pending) prevent(); router.replace({ pathname: "/assignments", params: { classId } }); }}
    onCancelConfirm={() => setConfirm(null)} onAcceptConfirm={() => { const action = confirm?.accept; setConfirm(null); action?.(); }}
  />;
}
