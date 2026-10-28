import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { InstructorScreen as Screen } from "../components/InstructorScreen";
import { AppHeader, LoadState } from "../components/navigation";
import { useSession } from "../session/provider";
import { usePagedList } from "../features/dashboard/usePagedList";
import { AssignmentEditor } from "../features/assignments/AssignmentEditor";
import { createDemoQuestion } from "../demo/demoData";

export default function AssignmentBuilder() {
  const { classId, id } = useLocalSearchParams<{ classId?: string; id?: string }>();
  const { assignments, classes, profile, isDemo } = useSession();
  const resolvedClassId = classId || (isDemo ? "demo-class-1" : "");
  const resolvedId = id || null;
  const fetch = useCallback(async () => {
    if (!resolvedClassId) throw new Error("Open a class before creating its learning activity.");
    const classroom = await classes.get(resolvedClassId);
    const draft = resolvedId ? await assignments.get(resolvedId) : null;
    if (draft && draft.class_id !== classroom.id) throw new Error("This assignment belongs to a different class.");
    return [{ id: draft?.id ?? classroom.id, draft }];
  }, [assignments, classes, resolvedClassId, resolvedId]);
  const { state, reload } = usePagedList(fetch);
  return <Screen><AppHeader title="Build a class learning activity" account={false} />
    <LoadState phase={state.phase} error={state.error} retry={reload} />
    {state.phase === "ready" && state.rows[0] && <AssignmentEditor key={state.rows[0].draft?.revision ?? resolvedClassId}
      initial={state.rows[0].draft} classId={resolvedClassId} api={assignments} active={profile?.role === "instructor"}
      demoQuestionAuthor={isDemo ? (lessonId, input) => createDemoQuestion(resolvedClassId, lessonId, input) : undefined} />}
  </Screen>;
}

