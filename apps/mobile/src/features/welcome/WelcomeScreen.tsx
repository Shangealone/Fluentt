import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";

import { SafeAreaView } from "react-native-safe-area-context";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors } from "../../theme/personal";

type Props = {
  onPersonal: () => void;
  onClassroom: () => void;
  onSignIn: () => void;
};

export function WelcomeScreen({ onPersonal, onClassroom, onSignIn }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 360;

  return <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.safe}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.visual, { minHeight: compact ? 400 : 430 }]}>
        <Image accessible={false} source={require("../../../assets/illustrations/welcome-neighborhood.jpg")}
          resizeMode="cover" style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]} />
        <View style={[styles.brand, compact && styles.compactBrand]}><FluenttLogo size={compact ? 33 : 36} /></View>
        <View style={[styles.intro, compact && styles.compactIntro]}>
          <Text accessibilityRole="header" style={[styles.title, compact && styles.compactTitle]}>Learn words.{"\n"}Start talking.</Text>
          <Text style={styles.description}>Build your confidence,{"\n"}one conversation at a time.</Text>
        </View>
      </View>

      <View style={[styles.panel, compact && styles.compactPanel]}>
        <Text accessibilityRole="header" style={styles.heading}>How would you like to learn?</Text>
        <View style={styles.choices}>
          <Pressable accessibilityRole="button" accessibilityLabel="Learn on my own. Go at your own pace."
            onPress={onPersonal} style={({ pressed }) => [styles.choice, styles.primary, pressed && styles.pressed]}>
            <View style={[styles.choiceIcon, styles.personalIcon]}>
              <Image accessible={false} source={require("../../../assets/illustrations/activity-learn.png")} resizeMode="contain" style={styles.illustration} />
            </View>
            <View style={styles.choiceCopy}>
              <Text style={[styles.choiceTitle, styles.primaryText]}>Learn on my own</Text>
              <Text style={[styles.choiceDescription, styles.primaryDescription]}>Go at your own pace.</Text>
            </View>
            <PersonalIcon name="arrow" size={17} color="#FFFFFF" />
          </Pressable>

          <Pressable accessibilityRole="button" accessibilityLabel="Learn with my class. Join your teacher and classmates."
            onPress={onClassroom} style={({ pressed }) => [styles.choice, pressed && styles.pressed]}>
            <View style={styles.choiceIcon}>
              <Image accessible={false} source={require("../../../assets/illustrations/activity-class.png")} resizeMode="contain" style={styles.illustration} />
            </View>
            <View style={styles.choiceCopy}>
              <Text style={styles.choiceTitle}>Learn with my class</Text>
              <Text style={styles.choiceDescription}>Join your teacher and classmates.</Text>
            </View>
            <PersonalIcon name="arrow" size={17} color={homeColors.ink} />
          </Pressable>
        </View>

        <View style={styles.signInRow}>
          <Text style={styles.signInPrompt}>Already have an account?</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Sign in" onPress={onSignIn} style={styles.signInButton}>
            <Text style={styles.signInLabel}>Sign in</Text>
          </Pressable>
        </View>
        <Text style={styles.footer}>Small steps. More confidence.</Text>
      </View>
    </ScrollView>

  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: homeColors.background },
  scroll: { flex: 1 },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", flexGrow: 1 },
  visual: { backgroundColor: "#C5EAFA", overflow: "hidden" },
  brand: { padding: 22, alignItems: "flex-start" },
  compactBrand: { paddingHorizontal: 20, paddingVertical: 19 },
  intro: { paddingHorizontal: 25, paddingVertical: 20, maxWidth: 300 },
  compactIntro: { paddingHorizontal: 22, paddingVertical: 17, maxWidth: 270 },
  title: { fontSize: 35, lineHeight: 39, letterSpacing: -1.2, fontWeight: "700", color: homeColors.ink, marginBottom: 13 },
  compactTitle: { fontSize: 32, lineHeight: 36 },
  description: { fontSize: 14, lineHeight: 22, color: "#2B5A54", maxWidth: 185 },
  panel: { marginTop: -24, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: homeColors.background, paddingHorizontal: 22, paddingTop: 25, paddingBottom: 20, minHeight: 360 },
  compactPanel: { paddingHorizontal: 19, paddingTop: 23, paddingBottom: 18 },
  heading: { fontSize: 21, lineHeight: 28, fontWeight: "700", letterSpacing: -0.5, color: homeColors.ink, marginBottom: 18 },
  choices: { gap: 12 },
  choice: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, minHeight: 92, borderWidth: 1, borderColor: homeColors.line, borderRadius: 17, backgroundColor: "#FFFFFF" },
  primary: { backgroundColor: homeColors.coral, borderColor: homeColors.coral, borderBottomWidth: 3, borderBottomColor: "#AC3E23" },
  pressed: { opacity: 0.8 },
  choiceIcon: { width: 60, height: 60, borderRadius: 17, backgroundColor: "#EDE8FB", alignItems: "center", justifyContent: "center" },
  personalIcon: { backgroundColor: "#E7F1CF" },
  illustration: { width: 42, height: 42 },
  choiceCopy: { flex: 1, minWidth: 0, gap: 4 },
  choiceTitle: { fontSize: 16, lineHeight: 21, fontWeight: "700", letterSpacing: -0.2, color: homeColors.ink },
  choiceDescription: { fontSize: 12, lineHeight: 18, color: homeColors.muted },
  primaryText: { color: "#FFFFFF" },
  primaryDescription: { color: "#FFF5EF" },
  signInRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 18, minHeight: 44 },
  signInPrompt: { fontSize: 13, lineHeight: 20, color: homeColors.muted },
  signInButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  signInLabel: { fontSize: 13, lineHeight: 20, fontWeight: "700", color: homeColors.teal, textDecorationLine: "underline" },
  footer: { fontSize: 11, lineHeight: 17, color: "#6B7D70", textAlign: "center", paddingTop: 15, paddingHorizontal: 14 },
});
