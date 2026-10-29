import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { usePreventRemove } from "expo-router";
import { Button, ErrorMessage, Loading, s } from "../../components/ui";
import type { AssessmentResult, ResultsAccess } from "../../services/api/results";
import { CaptureQuestion } from "./CaptureQuestion";

export const resultMessage = (row: Pick<AssessmentResult, "state" | "submission_status">) => ({
  not_submitted: row.submission_status === "in_progress" ? "Work in progress. Submit before evaluation." : "No submission yet.",
  submitted: "Submitted. Awaiting an administrator evaluation; no grading job is queued automatically.",
  awaiting_manual_review: "Evaluation requires manual review or has unsupported evidence. No final score is available.",
  withheld: "Evaluated. Results are withheld until your instructor releases them.",
  released: "Your instructor has released this evaluation.",
  not_applicable: "Objective scoring is not applicable. There is no score or denominator.",
})[row.state];

export function ResultDetails({ initial, api, instructor = false, onVisibilityChanged }: { initial: AssessmentResult; api: ResultsAccess; instructor?: boolean; onVisibilityChanged?: () => void }) {
  const [row, setRow] = useState(initial), [position, setPosition] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false), [pending, setPending] = useState<{ row: AssessmentResult; released: boolean; key: string } | null>(null);
  const [blocked, setBlocked] = useState(false), [uncertain, setUncertain] = useState(false);
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const alive = useRef(true), lock = useRef(false);
  usePreventRemove(busy || !!pending || confirm, ({ repeat }) => {
    if (lock.current) { setError("Wait for the visibility request to finish before leaving."); return; }
    setLeave(() => repeat);
  });
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function change() {
    if (lock.current || blocked) return;
    const operation = pending ?? { row, released: !row.released, key: Crypto.randomUUID() };
    setPending(operation); setConfirm(false); lock.current = true; setBusy(true); setError("");
    try {
      const saved = await api.release(operation.row, operation.released, operation.key);
      if (alive.current) { setRow(saved); setPending(null); setUncertain(false); setPosition(0); onVisibilityChanged?.(); }
    } catch (cause) {
      if (alive.current) {
        const status = (cause as { status?: number }).status;
        setError(cause instanceof Error ? cause.message : "Result visibility could not be verified.");
        setUncertain(true);
        if ([401, 403, 404].includes(status ?? 0)) { setBlocked(true); setPending(null); }
        else if (status === 409 || status === 422 || status === 428) setPending(null);
      }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  if (blocked) return <ErrorMessage message="Access is no longer available. Refresh to verify your class and session." />;
  const item = row.items[position];
  return <View style={{ gap: 16 }}>
    <Text accessibilityRole="header" style={s.heading}>{row.title}</Text>
    {!!row.student_username && <Text style={s.body}>Student: {row.student_username}</Text>}
    <Text style={s.body}>Submission: {row.submission_status}{row.submitted_at ? ` · ${new Date(row.submitted_at).toLocaleString()}` : ""}</Text>
    <Text accessibilityLiveRegion="polite" style={s.body}>{resultMessage(row)}</Text>
    <Text style={s.body}>Equal-point objective evaluation. This does not change the original unscored classroom submission or represent an original examination grade.</Text>
    {row.evaluation && <Text style={s.body}>Evaluation: {row.evaluation.status} · {row.evaluation.policy_version} · {row.evaluation.engine_version}</Text>}
    {!uncertain && row.earned_points !== null && row.possible_points !== null && <Text style={s.heading}>Objective points: {row.earned_points} / {row.possible_points}</Text>}
    {instructor && <Text style={s.body}>Visibility: {row.released ? "Released" : "Withheld"}. Only currently eligible class members can access their own released results. Evaluations are run separately by an authorized administrator.</Text>}
    {!!error && <ErrorMessage message={error} />}{busy && <Loading />}
    {uncertain && <Text style={s.body}>Visibility is unverified. Retry the same request or refresh before taking another action.</Text>}
    {instructor && row.evaluation?.status === "COMPLETE" && !uncertain && !busy && !confirm && <Button
      label={row.released ? "Withdraw result visibility" : "Release this evaluation"} onPress={() => setConfirm(true)} />}
    {confirm && <View style={s.card}><Text style={s.body}>{row.released ? "Withdraw the student's access to scores and answer review? History will be retained." : "Release these objective totals, per-item correctness and the student's original answers? Expected answers and private feedback stay hidden. This evaluation stays pinned."}</Text>
      <Button label="Confirm visibility change" disabled={busy} onPress={() => void change()} />
      <Button label="Cancel visibility change" secondary disabled={busy} onPress={() => setConfirm(false)} /></View>}
    {pending && uncertain && <Button label="Retry original visibility change" disabled={busy} onPress={() => void change()} />}
    {leave && <View style={s.card}><Text style={s.body}>Leave this review? If a visibility request was interrupted, refresh the submission before making another change.</Text>
      <Button label="Stay on result review" secondary onPress={() => setLeave(null)} />
      <Button label="Leave and verify later" onPress={() => { setPending(null); setConfirm(false); leave(); }} /></View>}
    {!uncertain && item && <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={s.heading}>Submitted answer review · {position + 1} of {row.items.length}</Text>
      <Text style={s.body}>{item.state === "AUTO_GRADABLE" ? `${item.correct ? "Correct" : "Incorrect"} · ${item.awarded_points} / ${item.max_points} objective points`
        : item.state === "NOT_APPLICABLE" ? "Not applicable to objective scoring" : "No final item score: review required or unsupported"}</Text>
      {!item.answer && <Text style={s.body}>{item.response_id ? "The stored answer cannot be safely presented. Review is required; original evidence is retained." : "No answer was submitted for this question."}</Text>}
      <CaptureQuestion key={item.result_id} item={{ ...item.question, assignment_question_id: item.assignment_question_id }} answer={item.answer ?? undefined}
        back={null} disabled review onChange={() => {}} onReveal={() => {}} />
      <Button label="Previous reviewed question" secondary disabled={position === 0} onPress={() => setPosition(value => value - 1)} />
      <Button label="Next reviewed question" secondary disabled={position === row.items.length - 1} onPress={() => setPosition(value => value + 1)} />
      <Text style={s.body}>Read-only original response. Expected answers, private rubrics, explanations and Flashcard backs are withheld.</Text>
    </View>}
  </View>;
}
