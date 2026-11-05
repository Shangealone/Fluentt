import { useCallback } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useSession } from "../session/provider";
import { usePagedList } from "../features/dashboard/usePagedList";
import { ClassDetailsView, type ClassAction } from "../features/classes/ClassDetailsView";

export default function ClassDetail() {
  const { id, created } = useLocalSearchParams<{ id?: string; created?: string }>();
  const { classes, profile } = useSession();
  const classId = typeof id === "string" ? id : "";
  const fetchClass = useCallback(async () => {
    if (!classId) throw new Error("Choose a class to continue.");
    const row = await classes.get(classId);
    if (row.id !== classId) throw new Error("We couldn’t confirm this class. Return to your classes and try again.");
    return [row];
  }, [classes, classId]);
  const { state, reload } = usePagedList(fetchClass);
  const row = state.phase === "ready" ? state.rows.find(item => item.id === classId) ?? null : null;
  function open(action: ClassAction) {
    if (!row || (action !== "assignments" && row.status !== "active")) return;
    if (action === "lessons") { router.push({ pathname: "/instructor-lessons", params: { classId: row.id } }); return; }
    if (action === "assessments") { router.push({ pathname: "/class-assessments", params: { classId: row.id } }); return; }
    if (action === "edit") router.push({ pathname: "/class-edit", params: { id: row.id } });
    else router.push({ pathname: action === "assignments" ? "/assignments" : action === "overview" ? "/instructor-monitoring" : "/communication", params: { classId: row.id } });
  }
  if (profile?.role !== "instructor") return null;
  return <ClassDetailsView row={row} phase={state.phase === "ready" && !row ? "loading" : state.phase}
    error={state.error} created={created === "1"} onRetry={reload} onAction={open}
    onBack={() => router.replace("/instructor")} onAccount={() => router.push("/account")} />;
}
