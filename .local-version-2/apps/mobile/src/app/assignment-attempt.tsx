import { useCallback } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Text } from "../accessibility/Primitives";
import { useSession } from "../session/provider";
import { usePagedList } from "../features/dashboard/usePagedList";
import { AttemptPlayer } from "../features/assignments/AttemptPlayer";
import { AttemptFrame, AttemptHero, AttemptButton, a } from "../features/assignments/AttemptUI";
import { homeColors } from "../theme/personal";

export default function AssignmentAttempt() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const assignmentId = typeof id === "string" ? id : "";
  const { capture, profile } = useSession();
  const fetch = useCallback(async () => {
    if (!assignmentId) throw new Error("Choose an assignment to continue.");
    return [await capture.start(assignmentId)];
  }, [capture, assignmentId]);
  const { state, reload } = usePagedList(fetch);
  if (state.phase === "ready" && state.rows[0]) return <AttemptPlayer key={`${profile?.id}:${state.rows[0].id}:${state.rows[0].revision}`} initial={state.rows[0]} api={capture} active={profile?.role === "school_student"} />;
  return <AttemptFrame onBack={() => { if (router.canGoBack()) router.back(); else router.replace("/my-classes"); }} onAccount={() => router.push("/account")}>
    <AttemptHero /><View style={[a.card, a.centered]}>
      {state.phase === "loading" ? <><ActivityIndicator color={homeColors.teal} /><Text accessibilityLiveRegion="polite" style={a.heading}>Loading your assignment…</Text><Text style={a.body}>Your saved answers will appear here.</Text></> : <>
        <Text accessibilityRole="header" style={a.heading}>We couldn’t open this assignment</Text><Text accessibilityRole="alert" style={a.error}>{state.error || "Choose an assignment to continue."}</Text>
        {!!assignmentId && <AttemptButton label="Try again" onPress={reload} />}<AttemptButton label="Back to my classes" secondary onPress={() => router.replace("/my-classes")} />
      </>}
    </View>
  </AttemptFrame>;
}

