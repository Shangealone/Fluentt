import React, { useCallback, useState } from "react";
import { Text } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen, s } from "../components/ui";
import { AppHeader } from "../components/navigation";
import { useSession } from "../session/provider";
import { ConversationPractice } from "../features/conversation/ConversationPractice";
import { PersonalScreen } from "../components/PersonalScreen";

export default function ConversationScreen() {
  const { profile } = useSession();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  if (!profile) return null;
  if (profile.role === "personal_student") return <PersonalScreen scroll={false} eyebrow="Tutor · Guided conversation">
    {focused && <ConversationPractice key={profile.id} onDone={() => router.push("/student")} />}
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
