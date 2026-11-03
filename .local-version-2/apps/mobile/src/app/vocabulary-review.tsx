import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSession } from "../session/provider";
import { VocabularyScreen } from "../features/vocabulary/VocabularyScreen";

export default function VocabularyReviewRoute() {
  const { profile, vocabulary } = useSession();
  const { studyId } = useLocalSearchParams<{ studyId?: string }>();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  if (!focused || profile?.role !== "school_student") return null;
  return <VocabularyScreen key={`${profile.id}-${studyId ?? "directory"}`} api={vocabulary}
    studyId={typeof studyId === "string" ? studyId : ""}
    onBack={() => { if (router.canGoBack()) router.back(); else router.replace("/research"); }}
    onAccount={() => router.push("/account")} />;
}
