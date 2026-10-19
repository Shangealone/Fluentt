import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "../components/ui";
import { AppHeader, LoadState } from "../components/navigation";
import { useSession } from "../session/provider";
import { usePagedList } from "../features/dashboard/usePagedList";
import { AssignmentEditor } from "../features/assignments/AssignmentEditor";

export default function AssignmentBuilder() {
  const { classId, id } = useLocalSearchParams<{ classId?: string; id?: string }>();
  const resolvedClassId = classId || "demo-class-1";
  const resolvedId = id || "demo-draft-1";
  const { assignments, classes, profile } = useSession();
  const fetch = useCallback(async () => {
    const classroom = await classes.get(resolvedClassId);
    const draft = resolvedId ? await assignments.get(resolvedId) : null;
    return [{ id: draft?.id ?? classroom.id, draft }];
  }, [assignments, classes, resolvedClassId, resolvedId]);
  const { state, reload } = usePagedList(fetch);
  return <Screen><AppHeader title="Instructor assignment builder" account={false} />
    <LoadState phase={state.phase} error={state.error} retry={reload} />
    {state.phase === "ready" && state.rows[0] && <AssignmentEditor key={state.rows[0].draft?.revision ?? resolvedClassId}
      initial={state.rows[0].draft} classId={resolvedClassId} api={assignments} active={profile?.role === "instructor"} />}
  </Screen>;
}

