import { messageNavigation } from "../features/communications/state";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CommunicationBrowser } from "../features/communications/CommunicationBrowser";
import { CommunicationLayout } from "../features/communications/CommunicationUI";
import { useSession } from "../session/provider";
import { destination } from "../session/routing";
import { InstructorHomeNavigation } from "../features/dashboard/InstructorHome";
export default function Communication() {
  const { classId, studentId, mode, refresh } = useLocalSearchParams<{ classId?: string; studentId?: string; mode?: string; refresh?: string }>();
  const activeClassId = typeof classId === "string" ? classId : "";
  const activeStudentId = typeof studentId === "string" ? studentId : undefined;
  const activeMode = typeof mode === "string" ? mode : undefined;
  const { communication, profile } = useSession();
  if (!profile) return null;
  function back() {
    if (activeClassId && activeStudentId && profile?.role === "instructor") router.replace({ pathname: "/communication", params: { classId: activeClassId, mode: "direct" } });
    else if (activeClassId) router.replace("/communication");
    else if (profile) router.replace(destination(profile));
  }
  return <View style={{ flex: 1 }}><CommunicationLayout onBack={() => messageNavigation.request(back)} onAccount={() => messageNavigation.request(() => router.replace("/account"))}>
    <CommunicationBrowser key={`${profile.id}:${activeClassId}:${activeStudentId}:${activeMode}:${refresh}`} api={communication} classId={activeClassId} studentId={activeStudentId} mode={activeMode} />
  </CommunicationLayout>
    {profile.role === "instructor" && <InstructorHomeNavigation activeRoute="/communication" />}
  </View>;
}

