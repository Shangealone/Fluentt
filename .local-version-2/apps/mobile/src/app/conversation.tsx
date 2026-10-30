import { useCallback, useState } from "react";

import { router, useFocusEffect } from "expo-router";
import { useSession } from "../session/provider";
import { ConversationPractice } from "../features/conversation/ConversationPractice";

export default function ConversationScreen() {
  const { profile } = useSession();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  if (!profile || !focused) return null;
  return <ConversationPractice key={profile.id} onDone={() => {
    if (router.canGoBack()) router.back();
    else router.replace(profile.role === "personal_student" ? "/student" : "/my-classes");
  }} />;
}
