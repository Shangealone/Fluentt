import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Crypto from "expo-crypto";
import { Text } from "../../accessibility/Primitives";
import { useSession } from "../../session/provider";
import type { VocabularyAccess, ParallelAttempt, ParallelSnapshot, RecallRating } from "../../services/api/vocabulary";
import { ApiError } from "../../services/api/client";
import { useLessonData } from "../teacher-lessons/useLessonData";
import { LessonButton, LessonChoice, LessonField, LessonLoading, LessonNote, l } from "../teacher-lessons/LessonUI";

const statusLabel: Record<string, string> = { available: "Available", in_progress: "Continue saved attempt", completed: "Completed",
  locked: "Not open yet", missed: "Missed — no score recorded", missed_incomplete: "Window closed with an incomplete attempt",
  blocked_model: "Activity unavailable: validated model required", blocked_pretest: "Pretest required", blocked_publication: "Instructor publication required",
  no_due_items: "No practice items due", not_due_yet: "Practice items become due later today", withdrawn: "Withdrawn", enrolled: "Enrolled", assessment_sequence_completed: "Assessment sequence completed" };

export function ParallelWorkflowPanel({ instructor = false }: { instructor?: boolean }) {
  const { profile, vocabulary } = useSession();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  if (!focused || !profile || profile.role !== (instructor ? "instructor" : "school_student")) return null;
  return <Directory key={profile.id} api={vocabulary} instructor={instructor} />;
}

function Directory({ api, instructor }: { api: VocabularyAccess; instructor: boolean }) {
  const fetch = useCallback(() => api.parallelStudies(instructor), [api, instructor]);
  const state = useLessonData(fetch);
  const [study, setStudy] = useState("");
  if (state.phase === "error") return <><LessonNote error>Development-study connection could not be checked.</LessonNote><LessonButton label="Check again" onPress={state.reload} /></>;
  if (state.phase !== "ready" || !state.value?.development_only) return null;
  if (study) return instructor ? <Instructor key={study} api={api} id={study} onBack={() => setStudy("")} /> : <Student key={study} api={api} id={study} onBack={() => setStudy("")} />;
  return <View style={l.card}><Text style={l.heading}>Development Class Learning</Text><LessonNote>Synthetic test records only. This is not an active student experiment.</LessonNote>
    {!state.value.items.length && <Text>No development study enrollment is available.</Text>}
    {state.value.items.map(row => <LessonButton key={row.id} label={`${row.title} — ${statusLabel[row.status] ?? row.status}`} onPress={() => setStudy(row.id)} />)}
    <LessonButton label="Refresh development studies" onPress={state.reload} /></View>;
}

function Student({ api, id, onBack }: { api: VocabularyAccess; id: string; onBack: () => void }) {
  const fetch = useCallback(() => api.parallelDirectory(id), [api, id]);
  const state = useLessonData(fetch);
  const [attempt, setAttempt] = useState<ParallelAttempt | null>(null), [activity, setActivity] = useState(false);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false);
  const live = useRef(true);
  const operationLock = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const perform = async (operation: () => Promise<void>) => {
    if (operationLock.current) return;
    operationLock.current = true;
    setBusy(true); setError("");
    try { await operation(); } catch { if (live.current) setError("This operation could not be confirmed. Refresh the saved state before retrying."); }
    finally { operationLock.current = false; if (live.current) setBusy(false); }
  };
  if (attempt) return <Attempt key={attempt.id} api={api} study={id} initial={attempt} activity={activity} onBack={() => { setAttempt(null); state.reload(); }} />;
  return <View style={l.card}><Text style={l.heading}>Development study activities</Text><LessonNote>Synthetic testing only. Device time does not determine availability.</LessonNote>
    {state.phase === "loading" && <LessonLoading />}{state.phase === "error" && <LessonNote error>{state.error}</LessonNote>}{error && <LessonNote error>{error}</LessonNote>}
    {state.phase === "ready" && <><Text>{statusLabel[state.value?.status ?? ""] ?? "Participation unavailable"}</Text>
      {state.value?.tasks.map(task => <View key={task.id} style={l.card}><Text>{task.title}</Text><Text>{statusLabel[task.status] ?? "Unavailable"}</Text>
        <LessonButton label={task.status === "completed" ? "View receipt" : "Open task"} disabled={busy || !["available", "in_progress", "completed"].includes(task.status)}
          onPress={() => void perform(async () => { const value = await api.parallelStart(id, task); if (live.current) { setActivity(task.kind === "activity"); setAttempt(value); } })} /></View>)}
      {state.value?.status !== "withdrawn" && <>{confirm ? <><LessonNote>Withdraw from this test study? Existing records and assignments will be retained.</LessonNote>
        <LessonButton label="Confirm withdrawal" disabled={busy} onPress={() => void perform(async () => { await api.parallelWithdraw(id); if (live.current) { setConfirm(false); state.reload(); } })} />
        <LessonButton label="Cancel withdrawal" onPress={() => setConfirm(false)} /></> : <LessonButton label="Withdraw from test study" onPress={() => setConfirm(true)} />}</>}
    </>}
    <LessonButton label="Refresh tasks" disabled={busy} onPress={state.reload} /><LessonButton label="Back to development studies" disabled={busy} onPress={onBack} /></View>;
}

function Attempt({ api, study, initial, activity, onBack }: { api: VocabularyAccess; study: string; initial: ParallelAttempt; activity: boolean; onBack: () => void }) {
  const [row, setRow] = useState(initial), [answers, setAnswers] = useState(initial.responses ?? {}), [ratings, setRatings] = useState(initial.ratings ?? {});
  const [pending, setPending] = useState<{ action: "save" | "submit"; body: ParallelSnapshot } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const live = useRef(true);
  const operationLock = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const update = (next: ParallelAttempt) => { setRow(next); setAnswers(next.responses ?? {}); setRatings(next.ratings ?? {}); };
  const write = async (action: "save" | "submit") => {
    if (operationLock.current) return;
    operationLock.current = true;
    const retained = pending ?? { action, body: { responses: answers, ratings: activity ? ratings : {}, expected_revision: row.revision, request_id: Crypto.randomUUID() } };
    setPending(retained); setBusy(true); setError("");
    try { const value = await api.parallelWrite(study, row.id, retained.action, retained.body); if (live.current) { update(value); setPending(null); } }
    catch (error) { if (live.current) {
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) { onBack(); return; }
      setError("The save or submission could not be confirmed. Check the saved attempt or retry the same request.");
    } }
    finally { operationLock.current = false; if (live.current) setBusy(false); }
  };
  const refresh = async () => {
    if (operationLock.current) return;
    operationLock.current = true;
    setBusy(true); setError("");
    try { const value = await api.parallelAttempt(study, row.id); if (live.current) { update(value); setPending(null); } }
    catch (error) { if (live.current) {
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) { onBack(); return; }
      setError("The saved attempt is unavailable. No local score was created.");
    } }
    finally { operationLock.current = false; if (live.current) setBusy(false); }
  };
  return <View style={l.card}><Text style={l.heading}>Development {activity ? "practice" : "assessment"}</Text><LessonNote>Development-only scoring policy. Save deliberately; unsaved local edits are cleared when leaving.</LessonNote>
    {error && <LessonNote error>{error}</LessonNote>}
    {row.status === "completed" ? <><Text>Submission recorded: {row.submitted_at}</Text><Text>{row.result?.points} / {row.result?.maximum} development points.</Text></> : <>
      {row.cards?.map(card => <View key={card.response_id} style={l.card}><Text>{card.prompt}</Text>
        {card.format === "multiple_choice" ? card.options.map(option => <LessonChoice key={option.id} title={option.text} radio checked={answers[card.response_id] === option.id}
          disabled={busy || !!pending} onPress={() => setAnswers(old => ({ ...old, [card.response_id]: option.id }))} />) :
          <LessonField label="Your answer" value={answers[card.response_id] ?? ""} disabled={busy || !!pending} maxLength={2000} onChange={value => setAnswers(old => ({ ...old, [card.response_id]: value }))} />}
        {activity && <><Text>How difficult did recall feel?</Text>{(["again", "hard", "good", "easy"] as RecallRating[]).map(rating => <LessonChoice key={rating} title={rating} radio
          checked={ratings[card.response_id] === rating} disabled={busy || !!pending} onPress={() => setRatings(old => ({ ...old, [card.response_id]: rating }))} />)}</>}
      </View>)}
      {pending ? <LessonButton label="Retry retained request" disabled={busy} onPress={() => void write(pending.action)} /> : <><LessonButton label="Save draft" disabled={busy} onPress={() => void write("save")} /><LessonButton label="Submit complete attempt" disabled={busy} onPress={() => void write("submit")} /></>}
      <LessonButton label="Reload saved attempt (discard unsaved edits)" disabled={busy} onPress={() => void refresh()} />
    </>}
    <LessonButton label="Return to study tasks" disabled={busy} onPress={onBack} /></View>;
}

function Instructor({ api, id, onBack }: { api: VocabularyAccess; id: string; onBack: () => void }) {
  const fetch = useCallback(() => api.parallelMonitor(id), [api, id]);
  const state = useLessonData(fetch);
  const [confirm, setConfirm] = useState(false), [error, setError] = useState("");
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  return <View style={l.card}><Text style={l.heading}>Development class study</Text><LessonNote>Synthetic test records only. Randomized conditions and submitted results cannot be edited here.</LessonNote>
    {state.phase === "loading" && <LessonLoading />}{state.phase === "error" && <LessonNote error>{state.error}</LessonNote>}
    {state.value?.participants.map(p => <View key={p.participant_code} style={l.card}><Text>{p.participant_code}: {p.status}</Text>
      {p.tasks.map(t => <Text key={t.id}>{t.title}: {statusLabel[t.status] ?? "Unavailable"}</Text>)}</View>)}
    {error && <LessonNote error>{error}</LessonNote>}
    <LessonButton label={confirm ? "Confirm publication of test activities" : "Publish test activities"} onPress={() => {
      if (!confirm) { setConfirm(true); return; }
      void api.parallelPublish(id).then(() => { if (live.current) { setConfirm(false); state.reload(); } }).catch(() => { if (live.current) setError("Publication was not confirmed. Refresh before retrying."); });
    }} /><LessonButton label="Refresh class study" onPress={state.reload} /><LessonButton label="Back" onPress={onBack} />
  </View>;
}
