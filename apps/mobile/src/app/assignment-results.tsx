import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Screen, Button, s } from "../components/ui";
import { AppHeader } from "../components/navigation";
import { useSession } from "../session/provider";
import { Picker } from "../features/assignments/AssignmentEditor";
import { ResultDetails } from "../features/assignments/ResultDetails";

export default function InstructorResults() {
  const { id, attemptId, runId } = useLocalSearchParams<{ id?: string; attemptId?: string; runId?: string }>();
  const assignmentId = id || "demo-pub-1";
  const { results } = useSession();
  const [focused, setFocused] = useState(false), [reload, setReload] = useState(0);
  useFocusEffect(useCallback(() => { setFocused(true); setReload(value => value + 1); return () => setFocused(false); }, []));
  const fetch = useCallback(async (offset: number) => {
    const page = await results.submissions(assignmentId, offset);
    return { ...page, items: page.items.map(row => ({ ...row, id: row.attempt_id })) };
  }, [assignmentId, results]);
  const detail = useCallback(async () => {
    const activeAttemptId = attemptId || "demo-attempt-1";
    const row = await results.owner(activeAttemptId, runId);
    return { items: [{ ...row, id: row.attempt_id! }], has_more: false, offset: 0, limit: 1 };
  }, [attemptId, runId, results]);

  const evaluations = useCallback((offset: number) => results.evaluations(attemptId!, offset), [attemptId, results]);
  return <Screen><AppHeader title="Assignment results and release" back />
    <Button label="Refresh results and access" onPress={() => setReload(value => value + 1)} />
    {attemptId && <Button label="Back to submitted students" secondary onPress={() => router.replace({ pathname: "/assignment-results", params: { id } })} />}
    {focused && (!attemptId ? <Picker key={`${id}:${reload}`} fetch={fetch}
      emptyTitle="No eligible submitted attempts" emptyDescription="Only finalized submissions from currently eligible class members appear here."
      render={row => <View key={row.id} style={s.card}><Text style={s.heading}>{row.student_username}</Text>
        <Text style={s.body}>Submitted: {new Date(row.submitted_at).toLocaleString()}</Text>
        <Button label={`View result for ${row.student_username}`} onPress={() => router.push({ pathname: "/assignment-results", params: { id, attemptId: row.attempt_id } })} /></View>} />
      : <Picker key={`${id}:${attemptId}:${runId}:${reload}`} fetch={detail} render={row => <View key={row.id} style={{ gap: 16 }}>
        <ResultDetails initial={row} instructor api={results} onVisibilityChanged={() => setReload(value => value + 1)} />
        {!row.pinned_run_id && <Picker fetch={evaluations} emptyTitle="Awaiting administrator evaluation" emptyDescription="No evaluation has been recorded. Nothing grades automatically."
          render={evaluation => <Button key={evaluation.id} secondary label={`Inspect ${evaluation.policy_version} · ${evaluation.status} · ${evaluation.evaluated_at}`}
            onPress={() => router.replace({ pathname: "/assignment-results", params: { id, attemptId, runId: evaluation.id } })} />} />}
      </View>} />)}
  </Screen>;
}
