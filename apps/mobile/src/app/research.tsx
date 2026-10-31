import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useSession } from "../session/provider";
import { ResearchParticipationView } from "../features/research/ResearchParticipationView";

export default function ResearchScreen() {
  const { profile } = useSession();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  if (!focused || profile?.role !== "school_student") return null;
  return <ResearchParticipationView key={profile.id}
    onDone={() => { if (router.canGoBack()) router.back(); else router.replace("/student"); }}
    onAccount={() => router.push("/account")} />;
}
