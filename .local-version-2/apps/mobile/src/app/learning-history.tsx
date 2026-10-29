import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Screen } from "../components/ui";
import { AppHeader } from "../components/navigation";
import { HistoryBrowser } from "../features/progress/HistoryBrowser";
import { useSession } from "../session/provider";

export default function LearningHistory() {
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  const { progress, profile } = useSession();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return <Screen><AppHeader title="Progress and learning history" back />
    {focused && <HistoryBrowser key={`${profile?.id}:${classId}`} api={progress} initialClassId={classId} personal={profile?.role === "personal_student"} />}
  </Screen>;
}
