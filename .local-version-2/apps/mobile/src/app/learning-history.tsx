import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Screen } from "../components/ui";
import { AppHeader } from "../components/navigation";
import { HistoryBrowser } from "../features/progress/HistoryBrowser";
import { SchoolProgress } from "../features/progress/SchoolProgress";
import { useSession } from "../session/provider";

export default function LearningHistory() {
  const params = useLocalSearchParams<{ classId?: string }>();
  const classId = typeof params.classId === "string" ? params.classId : undefined;
  const { progress, profile } = useSession();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  if (profile?.role === "school_student") return focused ? <SchoolProgress key={`${profile.id}:${classId}`} api={progress} initialClassId={classId} /> : null;
  return <Screen><AppHeader title="Progress and learning history" back />
    {focused && <HistoryBrowser key={`${profile?.id}:${classId}`} api={progress} initialClassId={classId} personal={profile?.role === "personal_student"} />}
  </Screen>;
}
