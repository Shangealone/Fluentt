import { useCallback } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator } from "react-native";
import { BuilderButton, BuilderHero, BuilderNotice, BuilderShell } from "../features/assignments/BuilderUI";
import { useSession } from "../session/provider";
import { usePagedList } from "../features/dashboard/usePagedList";
import { AssignmentEditor } from "../features/assignments/AssignmentEditor";

export default function AssignmentBuilder() {
  const { classId, id } = useLocalSearchParams<{ classId?: string; id?: string }>();
  const resolvedClassId = classId || "";
  const resolvedId = id || "";
  const { assignments, classes, profile } = useSession();
  const fetch = useCallback(async () => {
    if (!resolvedClassId) throw new Error("Choose a class to create an assignment.");
    const classroom = await classes.get(resolvedClassId);
    const draft = resolvedId ? await assignments.get(resolvedId) : null;
    return [{ id: draft?.id ?? classroom.id, draft, classroom }];
  }, [assignments, classes, resolvedClassId, resolvedId]);
  const { state, reload } = usePagedList(fetch);
  if (state.phase === "ready" && state.rows[0]) return <AssignmentEditor key={state.rows[0].draft?.revision ?? resolvedClassId}
    initial={state.rows[0].draft} classroom={state.rows[0].classroom} classId={resolvedClassId} api={assignments} active={profile?.role === "instructor"} />;
  return <BuilderShell onBack={() => router.replace({ pathname: "/assignments", params: { classId: resolvedClassId } })} onAccount={() => router.push("/account")}>
    <BuilderHero title={state.phase === "error" ? "Let’s try that again." : "A little preparation."} description={state.phase === "error" ? "We couldn’t load your assignment." : "Loading your class and available lessons…"} />
    {state.phase === "error" ? <><BuilderNotice error>{state.error ?? "Please try again."}</BuilderNotice><BuilderButton label="Try again" primary onPress={reload} /></> : <ActivityIndicator accessibilityLabel="Loading assignment" color="#176556" />}
  </BuilderShell>;
}

