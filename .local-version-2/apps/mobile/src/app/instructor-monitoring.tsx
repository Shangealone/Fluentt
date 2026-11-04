import { View } from "react-native";
import { InstructorHomeNavigation } from "../features/dashboard/InstructorHome";
import { ProficiencyScreen } from "../features/monitoring/AssessedProficiency";
import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { MonitoringBrowser } from "../features/monitoring/MonitoringBrowser";
import type { MonitoringFilters } from "../services/api/monitoring";
import { useSession } from "../session/provider";
export default function InstructorMonitoring() {
  const { classId, studentId, assignmentId, assessment, lesson_id, curriculum_version_id, scopeLabel } = useLocalSearchParams<{
    classId?: string; studentId?: string; assignmentId?: string; assessment?: string; lesson_id?: string; curriculum_version_id?: string; scopeLabel?: string;
  }>();
  const activeClassId = typeof classId === "string" ? classId : "";
  const activeStudentId = typeof studentId === "string" ? studentId : undefined;
  const activeAssignmentId = typeof assignmentId === "string" ? assignmentId : undefined;
  const activeLessonId = activeClassId && typeof lesson_id === "string" ? lesson_id : undefined;
  const activeEditionId = activeClassId && typeof curriculum_version_id === "string" ? curriculum_version_id : undefined;
  const scopeConflict = !!activeLessonId && !!activeEditionId;
  const scope = useMemo<Pick<MonitoringFilters, "lesson_id" | "curriculum_version_id">>(() => scopeConflict
    ? {}
    : activeLessonId ? { lesson_id: activeLessonId } : activeEditionId ? { curriculum_version_id: activeEditionId } : {},
  [scopeConflict, activeLessonId, activeEditionId]);
  const routeScopeLabel = typeof scopeLabel === "string" && scopeLabel ? scopeLabel : undefined;
  const activeScopeLabel = scopeConflict ? "" : activeLessonId
    ? routeScopeLabel ?? "Selected lesson"
    : activeEditionId ? routeScopeLabel ?? "Selected edition" : "";
  const { monitoring, profile } = useSession();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    if (scopeConflict) router.setParams({ lesson_id: undefined, curriculum_version_id: undefined, scopeLabel: undefined });
  }, [scopeConflict]);
  if (scopeConflict) return null;
  if (profile?.role !== "instructor") return null;
  if (assessment === "1" && activeClassId && activeStudentId) return focused ? <ProficiencyScreen key={`${profile.id}:${activeClassId}:${activeStudentId}`} classId={activeClassId} studentId={activeStudentId} /> : null;
  return <View style={{ flex: 1 }}>
    <View style={{ flex: 1 }}>{focused ? <MonitoringBrowser key={`${profile.id}:${activeClassId}:${activeStudentId}:${activeAssignmentId}`} api={monitoring} classId={activeClassId} studentId={activeStudentId} assignmentId={activeAssignmentId} scope={scope} scopeLabel={activeScopeLabel} /> : null}</View>
    <InstructorHomeNavigation activeRoute="/instructor-monitoring" />
  </View>;
}

