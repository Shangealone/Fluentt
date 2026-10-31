import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSession } from "../session/provider";
import { StudentResultView } from "../features/assignments/StudentResultView";
import type { AssessmentResult, ResultsAccess } from "../services/api/results";

export default function StudentResult() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const assignmentId = typeof id === "string" ? id : "";
  const { profile, results } = useSession();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  if (!focused || profile?.role !== "school_student") return null;
  return <StudentResultRead key={`${profile.id}:${assignmentId}`} assignmentId={assignmentId} api={results} />;
}

function StudentResultRead({ assignmentId, api }: { assignmentId: string; api: ResultsAccess }) {
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<{
    api: ResultsAccess; assignmentId: string; reload: number; row?: AssessmentResult; error?: Error;
  } | null>(null);
  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    void api.student(assignmentId).then(row => {
      if (active) setLoaded({ api, assignmentId, reload, row });
    }).catch(cause => {
      if (active) setLoaded({ api, assignmentId, reload, error: cause instanceof Error ? cause : new Error("Check your connection and try again.") });
    });
    return () => { active = false; };
  }, [api, assignmentId, reload]);
  // Only render data from the current request. Refresh and failed access hide the previous result.
  const current = loaded?.api === api && loaded.assignmentId === assignmentId && loaded.reload === reload ? loaded : null;
  const row = current?.row ?? null, error = current?.error;
  const unavailable = !!error && [401, 403, 404].includes((error as Error & { status?: number }).status ?? 0);
  const back = () => {
    if (router.canGoBack()) router.back();
    else if (row?.class_id) router.replace({ pathname: "/published-assignments", params: { classId: row.class_id, id: row.assignment_id } });
    else router.replace("/my-classes");
  };
  return <StudentResultView key={`${reload}:${row?.revision ?? (error ? "error" : "loading")}`} row={row}
    loading={!!assignmentId && !current} error={error?.message ?? ""} unavailable={unavailable} missing={!assignmentId}
    onBack={back} onAccount={() => router.push("/account")} onRefresh={() => setReload(value => value + 1)}
    onClasses={() => router.replace("/my-classes")}
    onOpen={() => { if (row) router.push({ pathname: "/assignment-attempt", params: { id: row.assignment_id } }); }} />;
}

