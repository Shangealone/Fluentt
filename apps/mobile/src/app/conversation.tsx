import React, { useCallback, useState } from "react";
import { Platform, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Button, Screen, s } from "../components/ui";
import { LiveTutorPractice } from "../features/conversation/LiveTutorPractice";
import { p } from "../theme/personal";
import { AppHeader } from "../components/navigation";
import { useSession } from "../session/provider";
import { ConversationPractice } from "../features/conversation/ConversationPractice";
import { PersonalScreen } from "../components/PersonalScreen";

export default function ConversationScreen() {
  const { profile, isDemo } = useSession();
  const [live, setLive] = useState(false);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => { setFocused(false); setLive(false); };
  }, []));

  if (!profile) return null;
  if (profile.role === "personal_student") return <PersonalScreen scroll={false} eyebrow="Tutor · Guided conversation">
    {focused && (live ? <LiveTutorPractice key={profile.id} language={profile.language ?? "tagalog"} onBack={() => setLive(false)} /> : <>
      {isDemo && Platform.OS === "web" && <View style={p.note}><Text style={p.heading}>Try a live AI conversation</Text><Text style={p.body}>Connect the local backend to Groq for generated replies. The standard scenarios below use scripted replies.</Text><Button label="Open live AI Tutor" onPress={() => setLive(true)} /></View>}
      <ConversationPractice key={profile.id} onDone={() => router.push("/student")} />
    </>)}
  </PersonalScreen>;

  return (
    <Screen>
      <AppHeader
        navigation
        title="Conversation simulator"
        subtitle="Choose a topic and practise a conversation"
      />
      <Text style={s.body}>Replies currently come from a local simulator. Use this space for guided conversation practice.</Text>
      {focused && <ConversationPractice key={profile.id} onDone={() => router.push("/student")} />}
    </Screen>
  );
}
