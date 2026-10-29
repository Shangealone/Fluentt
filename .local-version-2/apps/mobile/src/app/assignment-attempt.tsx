import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "../components/ui";
import { AppHeader, LoadState } from "../components/navigation";
import { useSession } from "../session/provider";
import { usePagedList } from "../features/dashboard/usePagedList";
import { AttemptPlayer } from "../features/assignments/AttemptPlayer";

export default function AssignmentAttempt() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const assignmentId = id || "";
  const { capture, profile } = useSession();
  const fetch = useCallback(async () => {
    if (!assignmentId) throw new Error("Choose an assignment to continue.");
    return [await capture.start(assignmentId)];
  }, [capture, assignmentId]);
  const { state, reload } = usePagedList(fetch);
  return <Screen><AppHeader title="Student assignment" account={false} />
    <LoadState phase={state.phase} error={state.error} retry={reload} />
    {state.phase === "ready" && state.rows[0] && <AttemptPlayer key={state.rows[0].revision} initial={state.rows[0]} api={capture} active={profile?.role === "school_student"} />}
  </Screen>;
}

