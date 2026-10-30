import { useCallback, useState } from "react";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSession } from "../session/provider";
import { ClassAssignmentsView } from "../features/assignments/ClassAssignmentsView";

export default function AssignmentList() {
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  const resolvedClassId = typeof classId === "string" ? classId : "";
  const { assignments } = useSession();
  const [reload, setReload] = useState(0);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); setReload(value => value + 1); return () => setFocused(false); }, []));
  const fetch = useCallback(async (offset: number) => {
    if (!resolvedClassId) throw new Error("Choose a class to see its assignments.");
    return assignments.list(resolvedClassId, offset);
  }, [assignments, resolvedClassId]);
  return focused ? <ClassAssignmentsView key={`${resolvedClassId}:${reload}`} fetch={fetch} canCreate={!!resolvedClassId}
    onRefresh={() => setReload(value => value + 1)}
    onBack={() => resolvedClassId ? router.replace({ pathname: "/class-details", params: { id: resolvedClassId } }) : router.replace("/instructor")}
    onAccount={() => router.push("/account")}
    onCreate={() => router.push({ pathname: "/assignment-builder", params: { classId: resolvedClassId } })}
    onOpen={row => router.push({ pathname: "/assignment-builder", params: { classId: row.class_id, id: row.id } })}
    onResults={row => router.push({ pathname: "/assignment-results", params: { id: row.id } })} /> : null;
}
