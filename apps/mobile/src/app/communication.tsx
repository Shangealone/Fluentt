import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Screen, Button } from "../components/ui";
import { AppHeader } from "../components/navigation";
import { CommunicationBrowser } from "../features/communications/CommunicationBrowser";
import { useSession } from "../session/provider";
export default function Communication() {
  const { classId, studentId, mode, refresh } = useLocalSearchParams<{ classId?: string; studentId?: string; mode?: string; refresh?: string }>();
  const activeClassId = classId || "demo-class-1";
  const { communication, profile } = useSession();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return <Screen><AppHeader title="Class communication" back account={false} /><Button label="My account" secondary onPress={() => router.replace("/account")} />{focused && <CommunicationBrowser key={`${profile?.id}:${activeClassId}:${studentId}:${mode}:${refresh}`} api={communication} classId={activeClassId} studentId={studentId} mode={mode} />}</Screen>;
}

