import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Screen } from "../components/ui";
import { AppHeader } from "../components/navigation";
import { MonitoringBrowser } from "../features/monitoring/MonitoringBrowser";
import { useSession } from "../session/provider";
export default function InstructorMonitoring() {
  const { classId, studentId, assignmentId } = useLocalSearchParams<{ classId?: string; studentId?: string; assignmentId?: string }>();
  const activeClassId = classId || "demo-class-1";
  const { monitoring, profile } = useSession();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return <Screen><AppHeader title="Class progress monitoring" back />{focused && <MonitoringBrowser key={`${profile?.id}:${activeClassId}:${studentId}:${assignmentId}`} api={monitoring} classId={activeClassId} studentId={studentId} assignmentId={assignmentId} />}</Screen>;
}

