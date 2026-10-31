import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../accessibility/Primitives";

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSession } from "../session/provider";
import { ResultDetails } from "../features/assignments/ResultDetails";
import { b, BuilderButton } from "../features/assignments/BuilderUI";
import { ResultsAbout, ResultsHero, ResultsPager, ResultsPerson, ResultsShell } from "../features/assignments/ResultsUI";
import { PersonalIcon } from "../components/PersonalIcon";

export default function InstructorResults() {
  const { id, attemptId, runId } = useLocalSearchParams<{ id?: string; attemptId?: string; runId?: string }>();
  const assignmentId = id || "";
  const { results, assignments } = useSession();
  const [classContext, setClassContext] = useState<{ assignmentId: string; classId: string } | null>(null);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [focused, setFocused] = useState(false), [reload, setReload] = useState(0);
  useFocusEffect(useCallback(() => { setFocused(true); setReload(value => value + 1); return () => setFocused(false); }, []));
  useEffect(() => {
    if (!focused || !assignmentId) return;
    let active = true;
    void assignments.get(assignmentId).then(row => { if (active) setClassContext({ assignmentId, classId: row.class_id }); }).catch(() => {});
    return () => { active = false; };
  }, [assignmentId, assignments, focused]);
  const fetch = useCallback(async (offset: number) => {
    if (!assignmentId) throw new Error("Choose an assignment to see its results.");
    const page = await results.submissions(assignmentId, offset);
    return { ...page, items: page.items.map(row => ({ ...row, id: row.attempt_id })) };
  }, [assignmentId, results]);
  const detail = useCallback(async () => {
    const activeAttemptId = attemptId || "";
    const row = await results.owner(activeAttemptId, runId);
    return { items: [{ ...row, id: row.attempt_id! }], has_more: false, offset: 0, limit: 1 };
  }, [attemptId, runId, results]);

  const evaluations = useCallback((offset: number) => results.evaluations(attemptId!, offset), [attemptId, results]);
  const backToAssignments = () => classContext?.assignmentId === assignmentId ? router.replace({ pathname: "/assignments", params: { classId: classContext.classId } }) : router.canGoBack() ? router.back() : router.replace("/instructor");
  const back = () => attemptId ? router.replace({ pathname: "/assignment-results", params: { id: assignmentId } }) : backToAssignments();
  return <ResultsShell key={`${assignmentId}:${attemptId ?? ""}:${runId ?? ""}`} detail={!!attemptId} onBack={back} onAccount={() => router.push("/account")}>
    <ResultsHero detail={!!attemptId} />
    {!assignmentId ? <View style={[b.card, b.empty]}><Text accessibilityRole="header" style={b.heading}>Choose an assignment</Text><Text style={[b.muted, b.center]}>Open an assignment’s results from your class assignments.</Text><BuilderButton label="Back to assignments" primary onPress={backToAssignments} /></View> : <>
      <View style={b.row}><Text accessibilityRole="header" style={b.heading}>{attemptId ? "Result review" : "Submitted students"}</Text><Pressable accessibilityRole="button" accessibilityLabel={attemptId ? "Refresh result and access" : "Refresh submissions"} disabled={sharingBusy} accessibilityState={{ disabled: sharingBusy }} onPress={() => setReload(value => value + 1)} style={[b.circle, sharingBusy && b.disabled]}><PersonalIcon name="refresh" size={19} /></Pressable></View>
      {focused && (!attemptId ? <ResultsPager key={`${id}:${reload}`} fetch={fetch} emptyTitle="No submissions yet" emptyDescription="Submitted work from eligible class members will appear here." errorTitle="We couldn’t load submissions"
        render={row => <View key={row.attempt_id} style={b.card}><ResultsPerson username={row.student_username} submitted={row.submitted_at} /><BuilderButton label={`Review result for ${row.student_username}`} onPress={() => router.push({ pathname: "/assignment-results", params: { id, attemptId: row.attempt_id } })} /></View>} />
        : <ResultsPager key={`${id}:${attemptId}:${runId}:${reload}`} fetch={detail} paginate={false} emptyTitle="Result unavailable" emptyDescription="Refresh to check access to this result." render={row => <ResultDetails key={row.attempt_id} initial={row} instructor api={results} onBusyChange={setSharingBusy} onVisibilityChanged={() => setReload(value => value + 1)} evaluationHistory={!row.pinned_run_id && <ResultsPager fetch={evaluations} emptyTitle="No evaluations yet" emptyDescription="An authorized administrator needs to evaluate this submission. Evaluation does not start automatically." render={evaluation => <BuilderButton key={evaluation.id} label={`${evaluation.status === "COMPLETE" ? "Completed" : evaluation.status === "REVIEW_REQUIRED" ? "Needs review" : "No score available"} · ${new Date(evaluation.evaluated_at).toLocaleString()}`} onPress={() => router.replace({ pathname: "/assignment-results", params: { id, attemptId, runId: evaluation.id } })} />} />} />} />)}
      <ResultsAbout />
    </>}
  </ResultsShell>;
}
