import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Text, useWindowDimensions } from "../accessibility/Primitives";
import { FluenttLogo } from "../components/FluenttLogo";
import { PersonalIcon } from "../components/PersonalIcon";
import { useSession } from "../session/provider";
import { PersonalHistory } from "../features/history/PersonalHistory";
import { PracticeLogArt } from "../features/history/PracticeLogArt";
import { hs as s } from "../features/history/historyStyles";
import { PracticeButton } from "../features/pronunciation/PracticeUI";

export default function PersonalStats() {
  const { profile, activityHistory } = useSession();
  const { width, fontScale } = useWindowDimensions();
  const [aboutOpen, setAboutOpen] = useState(false);
  if (profile?.role !== "personal_student") return null;
  const focus = [...(profile.learning_focus?.topics ?? []), ...(profile.learning_focus?.lessons ?? [])];
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={s.screen}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" style={[s.circle, s.back]} onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/student"); }}><PersonalIcon name="chevron" size={18} /></Pressable><FluenttLogo size={32} /><Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={() => router.push("/account")} style={s.circle}><PersonalIcon name="account" size={18} /></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, width < 360 && s.compact]}>
      <View style={[s.hero, fontScale > 1.2 && s.stackedHero]}><View style={s.heroCopy}><Text accessibilityRole="header" style={s.title}>My progress</Text><Text style={s.body}>Look back at what you’ve practiced.</Text></View><PracticeLogArt /></View>
      <PersonalHistory api={activityHistory} owner={profile.id} />
      <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Your learning focus</Text>{focus.length ? <><Text style={s.small}>The topics you chose to explore.</Text><View style={s.chips}>{focus.map((value, index) => <View key={`${index}-${value}`} style={s.chip}><Text style={s.label}>{value}</Text></View>)}</View></> : <Text style={s.body}>What would you like to work on? Choose topics that interest you.</Text>}<PracticeButton secondary label={focus.length ? "Change learning preferences" : "Choose your learning focus"} onPress={() => router.push("/preferences")} /></View>
      <View style={s.next}><Text accessibilityRole="header" style={s.heading}>Ready for another small step?</Text><Text style={s.body}>Choose a lesson and keep practicing at your own pace.</Text><PracticeButton label="Explore lessons" icon="arrow" onPress={() => router.push("/question-practice")} /></View>
      <View style={s.section}><Pressable accessibilityRole="button" accessibilityState={{ expanded: aboutOpen }} onPress={() => setAboutOpen(value => !value)} style={s.disclosure}><PersonalIcon name="chevron" size={14} /><Text style={s.quietText}>About your activity</Text></Pressable>{aboutOpen && <><Text style={s.small}>This shows your saved practice activity. It doesn’t measure your ability or give you a grade.</Text><Text style={s.small}>Recordings, answers, and private conversation text aren’t saved in this activity log.</Text><Text style={s.small}>Earlier practice that wasn’t saved won’t appear here.</Text></>}</View>
    </ScrollView>
  </SafeAreaView>;
}
