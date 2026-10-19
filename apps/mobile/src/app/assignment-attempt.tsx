import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "../components/ui";
import { AppHeader, LoadState } from "../components/navigation";
import { useSession } from "../session/provider";
import { usePagedList } from "../features/dashboard/usePagedList";
import { AttemptPlayer } from "../features/assignments/AttemptPlayer";

export default function AssignmentAttempt() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const assignmentId = id || "demo-pub-1";
  const { capture, profile, isDemo } = useSession();
  const fetch = useCallback(async () => {
    return [await capture.start(assignmentId)];
  }, [capture, assignmentId]);
  const { state, reload } = usePagedList(fetch);
  return <Screen><AppHeader title="Student assignment" account={false} />
    <LoadState phase={state.phase} error={state.error} retry={reload} />
    {state.phase === "ready" && state.rows[0] && <AttemptPlayer key={state.rows[0].revision} initial={state.rows[0]} api={capture} active={profile?.role === "school_student" || isDemo} />}
  </Screen>;
}

