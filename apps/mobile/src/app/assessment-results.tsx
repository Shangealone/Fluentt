import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Screen, Button } from "../components/ui";
import { AppHeader } from "../components/navigation";
import { useSession } from "../session/provider";
import { Picker } from "../features/assignments/AssignmentEditor";
import { ResultDetails } from "../features/assignments/ResultDetails";

export default function StudentResult() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const assignmentId = id || "demo-pub-1";
  const { results } = useSession();
  const [focused, setFocused] = useState(false), [reload, setReload] = useState(0);
  useFocusEffect(useCallback(() => { setFocused(true); setReload(value => value + 1); return () => setFocused(false); }, []));
  const fetch = useCallback(async () => {
    const row = await results.student(assignmentId);
    return { items: [{ ...row, id: row.assignment_id }], has_more: false, limit: 1, offset: 0 };
  }, [assignmentId, results]);
  return <Screen><AppHeader title="Assessment results" back />
    <Button label="Refresh result and access" onPress={() => setReload(value => value + 1)} />
    <Button label="Open assignment and submission" secondary onPress={() => router.push({ pathname: "/assignment-attempt", params: { id: assignmentId } })} />
    {focused && <Picker key={`${assignmentId}:${reload}`} fetch={fetch} render={row => <ResultDetails key={`${row.id}:${reload}`} initial={row} api={results} />} />}
  </Screen>;
}

