import React from "react";
import { router } from "expo-router";
import { Screen } from "../components/ui";
import { AppHeader } from "../components/navigation";
import { useSession } from "../session/provider";
import { ResearchParticipationView } from "../features/research/ResearchParticipationView";

export default function ResearchScreen() {
  const { profile } = useSession();

  if (!profile) return null;

  return (
    <Screen>
      <AppHeader
        navigation
        title="Research Participation"
        subtitle="Study enrollment, informed consent & lifecycle"
      />
      <ResearchParticipationView onDone={() => router.push(profile.role === "instructor" ? "/instructor" : "/student")} />
    </Screen>
  );
}
