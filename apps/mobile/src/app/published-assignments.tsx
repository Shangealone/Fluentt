import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSession } from "../session/provider";
import type { AssignmentPage, PublishedAssignment } from "../services/api/assignments";
import { StudentPublishedAssignmentsView } from "../features/assignments/StudentPublishedAssignmentsView";

export default function PublishedAssignments() {
  const { classId, id } = useLocalSearchParams<{ classId?: string; id?: string }>();
  const resolvedClassId = typeof classId === "string" ? classId : "";
  const assignmentId = typeof id === "string" ? id : "";
  const { assignments } = useSession();
  const [focused, setFocused] = useState(false), [reload, setReload] = useState(0);
  useFocusEffect(useCallback(() => { setFocused(true); setReload(value => value + 1); return () => setFocused(false); }, []));
  const fetch = useCallback(async (offset: number): Promise<AssignmentPage<PublishedAssignment>> => {
    if (!assignmentId && !resolvedClassId) throw new Error("Choose a class to see its assignments.");
    if (!assignmentId) return assignments.published(resolvedClassId, offset);
    const row = await assignments.publishedDetail(assignmentId);
    return { items: [row], has_more: false, limit: 20, offset: 0 };
  }, [assignments, resolvedClassId, assignmentId]);

  return focused ? <StudentPublishedAssignmentsView key={`${resolvedClassId}:${assignmentId}:${reload}`} fetch={fetch}
    detail={!!assignmentId} canLoad={!!(assignmentId || resolvedClassId)} onRefresh={() => setReload(value => value + 1)}
    onBack={returnedClassId => {
      const targetClassId = returnedClassId || resolvedClassId;
      if (assignmentId && targetClassId) router.replace({ pathname: "/published-assignments", params: { classId: targetClassId } });
      else router.replace("/my-classes");
    }}
    onAccount={() => router.push("/account")}
    onView={row => router.push({ pathname: "/published-assignments", params: { classId: row.class_id, id: row.id } })}
    onOpen={row => router.push({ pathname: "/assignment-attempt", params: { id: row.id } })}
    onResults={row => router.push({ pathname: "/assessment-results", params: { id: row.id } })} /> : null;
}
