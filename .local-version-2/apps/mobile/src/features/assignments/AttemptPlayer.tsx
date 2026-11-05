import { useEffect, useRef, useState } from "react";
import { router, usePreventRemove } from "expo-router";
import * as Crypto from "expo-crypto";
import type { Attempt, CaptureAccess, Progress, RevealedBack } from "../../services/api/capture";
import { progress, savedBuffers, responseComplete } from "./captureState";
import { CaptureQuestion } from "./CaptureQuestion";
import { AttemptPlayerView, type AttemptConfirmation } from "./AttemptPlayerView";

type Operation = "save" | "submit" | "reload" | "reveal";
export function AttemptPlayer({ initial, api, active = true }: { initial: Attempt; api: CaptureAccess; active?: boolean }) {
  const [row, setRow] = useState(initial), [buffers, setBuffers] = useState(() => savedBuffers(initial)), [position, setPosition] = useState(initial.position);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [blocked, setBlocked] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [backs, setBacks] = useState<Record<string, RevealedBack>>({});
  const [menu, setMenu] = useState(false), [review, setReview] = useState(false), [kind, setKind] = useState<Operation | null>(null);
  const [focusRevision, setFocusRevision] = useState(0);
  const [showSubmittedResult, setShowSubmittedResult] = useState(false);
  const [confirmation, setConfirmation] = useState<AttemptConfirmation | null>(null), [interactionReset, setInteractionReset] = useState(0);
  const [pending, setPending] = useState<{ row: Attempt; body: Progress; key: string } | null>(null);
  const lock = useRef(false), alive = useRef(active);
  const exitMessage = pending || uncertain
    ? "The saved outcome is still unconfirmed. If you leave, check this assignment’s saved status before trying again. Unsaved changes on this page will be lost."
    : "Your unsaved changes will be lost. The progress you already saved will stay available.";
  useEffect(() => { alive.current = active; return () => { alive.current = false; }; }, [active]);
  usePreventRemove(active && (dirty || busy || uncertain || !!pending), ({ repeat }) => {
    if (!lock.current) setConfirmation({ title: "Leave this assignment?", label: "Leave assignment", message: exitMessage,
      accept: () => { setDirty(false); setPending(null); setUncertain(false); repeat(); } });
  });
  useEffect(() => {
    if (showSubmittedResult && active && !busy && !dirty && !uncertain && !pending) {
      router.replace({ pathname: "/assessment-results", params: { id: row.assignment_id } });
    }
  }, [showSubmittedResult, active, busy, dirty, uncertain, pending, row.assignment_id]);
  function restore(value: Attempt) {
    setRow(value); setBuffers(savedBuffers(value)); setPosition(value.position); setBacks({}); setInteractionReset(value => value + 1);
    setDirty(false); setUncertain(false); setBlocked(false); setPending(null); setReview(false); setMenu(false);
  }
  function failed(cause: unknown) {
    setError(cause instanceof Error ? cause.message : "We couldn’t confirm the saved outcome. Reload saved progress.");
    const status = (cause as { status?: number }).status;
    if (status === 403 || status === 404 || status === 401) { setBlocked(true); setBacks({}); }
    if (!status || status === 408 || status === 409 || status >= 500) setUncertain(true);
  }
  async function operation(nextKind: Operation) {
    if (lock.current || !alive.current || !active) return;
    if (nextKind !== "reload" && (blocked || row.status === "submitted")) return;
    if ((nextKind === "save" || nextKind === "reveal") && (uncertain || pending)) return;
    if (nextKind === "submit" && uncertain && !pending) return;
    lock.current = true; setBusy(true); setKind(nextKind); setError(""); setNotice("");
    try {
      if (nextKind === "reveal") {
        const item = row.questions[position - 1];
        if (!item) return;
        const back = await api.reveal(row, item);
        if (alive.current) { setBacks(current => ({ ...current, [item.assignment_question_id]: back })); setRow(current => ({ ...current, revision: back.attempt_revision })); }
      } else if (nextKind === "reload") {
        const saved = await api.read(row.id);
        if (alive.current) { restore(saved); setNotice("Saved progress restored. Unsaved changes were discarded."); }
      } else if (nextKind === "save") {
        const saved = await api.save(row, progress(row, buffers, position));
        if (alive.current) { restore(saved); setNotice("Progress saved. Your assignment hasn’t been submitted."); }
      } else {
        const request = pending ?? { row, body: progress(row, buffers, position), key: Crypto.randomUUID() };
        setPending(request);
        const saved = await api.submit(request.row, request.body, request.key);
        if (alive.current) { restore(saved); setNotice(""); setShowSubmittedResult(saved.status === "submitted"); }
      }
    } catch (cause) {
      if (alive.current) { failed(cause); if ((cause as { status?: number }).status === 422) setPending(null); }
    } finally { lock.current = false; if (alive.current) { setBusy(false); setKind(null); } }
  }
  if (!active) return null;
  const frozen = busy || uncertain || !!pending || blocked;
  const item = row.questions[position - 1];
  const completed = row.questions.filter(q => responseComplete(q, buffers[q.assignment_question_id])).length;
  function back() { if (!lock.current) router.replace({ pathname: "/published-assignments", params: { classId: row.class_id, id: row.assignment_id } }); }
  function account() {
    if (lock.current) return;
    if (dirty || uncertain || pending) setConfirmation({ title: "Leave this assignment?", label: "Open my account", message: exitMessage,
      accept: () => { setDirty(false); setPending(null); setUncertain(false); router.push("/account"); } });
    else router.push("/account");
  }
  function move(next: number) {
    if (lock.current || frozen || next < 1 || next > row.question_count) return;
    if (next !== position) { setPosition(next); setDirty(true); }
    setReview(false); setMenu(false); setFocusRevision(value => value + 1);
  }
  return <AttemptPlayerView row={row} buffers={buffers} position={position} dirty={dirty} busy={busy} uncertain={uncertain} blocked={blocked}
    pending={!!pending} error={error} notice={notice} menu={menu} review={review} focusRevision={focusRevision} confirmation={confirmation} operation={kind}
    onBack={back} onResults={() => router.replace({ pathname: "/assessment-results", params: { id: row.assignment_id } })}
    onAccount={account} onMenu={() => setMenu(value => !value)} onMove={move}
    onReview={() => { if (!lock.current && !frozen) { setReview(true); setMenu(false); } }} onKeepWorking={() => setReview(false)}
    onSave={() => void operation("save")} onRetrySubmit={() => void operation("submit")}
    onClear={() => { if (!lock.current && !frozen && item) { setBuffers(current => { const next = { ...current }; delete next[item.assignment_question_id]; return next; }); setInteractionReset(value => value + 1); setDirty(true); setNotice(""); } }}
    onReload={() => { if (!lock.current) setConfirmation({ title: "Reload saved progress?", label: "Reload saved progress", message: "Your current unsaved changes will be replaced by the last saved answers. If a submission was interrupted, reloading checks its saved status.", accept: () => void operation("reload") }); }}
    onSubmit={() => { if (!lock.current && !frozen && (!row.class_assessment || completed === row.question_count)) setConfirmation({ title: row.class_assessment ? "Submit this assessment?" : "Submit this assignment?", label: row.class_assessment ? "Submit assessment" : "Submit assignment", message: row.class_assessment ? "Your answers are complete. After submission, your assessment will be scored and your answers will be final." : `${row.question_count - completed} questions are unanswered or incomplete. You can still submit, but you won’t be able to change any answers afterwards.`, accept: () => void operation("submit") }); }}
    onCancel={() => setConfirmation(null)} onConfirm={() => { if (!lock.current && confirmation) { const accept = confirmation.accept; setConfirmation(null); accept(); } }}
    question={!blocked && item ? <CaptureQuestion key={`${item.assignment_question_id}:${interactionReset}`} item={item} answer={buffers[item.assignment_question_id]}
      back={backs[item.assignment_question_id] ?? null} disabled={frozen} onReveal={() => void operation("reveal")} onChange={answer => {
        if (!frozen && !lock.current) { setBuffers(current => ({ ...current, [item.assignment_question_id]: answer })); setDirty(true); setNotice(""); }
      }} /> : null} />;
}
