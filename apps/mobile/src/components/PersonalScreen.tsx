import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useWindowDimensions } from "../accessibility/Primitives";

import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSession } from "../session/provider";
import { PersonalDesign, homeColors, pc, p } from "../theme/personal";
import { NotificationButton } from "./NotificationButton";
import { FluenttLogo } from "./FluenttLogo";
import { PersonalIcon } from "./PersonalIcon";

export function PersonalScreen({ children, title, eyebrow, description, backDisabled = false, scroll = true, home = false }: {
  children: React.ReactNode; title?: string; eyebrow?: string; description?: string; backDisabled?: boolean; scroll?: boolean; home?: boolean;
}) {
  const { profile } = useSession();
  const { width } = useWindowDimensions();
  const compactHeader = home && width < 360;
  const language = profile?.language === "english" ? "English" : "Tagalog";
  const content = <>
    {!home && <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back to the previous screen" disabled={backDisabled}
        onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={styles.back}><Text style={{ fontSize: 20, color: pc.ink }}>←</Text></Pressable>
      <Text style={p.eyebrow}>{eyebrow ?? "Your personal learning space"}</Text>
    </View>}
    {!!title && <View style={{ gap: 8 }}><Text accessibilityRole="header" style={p.title}>{title}</Text>{!!description && <Text style={p.body}>{description}</Text>}</View>}
    {children}
  </>;
  return <PersonalDesign.Provider value={true}><SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, home && styles.homeScreen]}>
    <View style={[styles.header, home && styles.homeHeaderSurface]}><View style={[styles.headerInner, home && styles.homeHeader, compactHeader && styles.compactHeader]}>
      <FluenttLogo size={compactHeader ? 32 : 36} />
      <View style={styles.headerActions}>
        {home ? <Pressable accessibilityRole="button" accessibilityLabel={"Learning language: " + language + ". Change language"} disabled={backDisabled}
          onPress={() => router.push("/language")} style={({ pressed }) => [styles.language, pressed && { opacity: 0.7 }]}>
          <View style={styles.languageDot} /><Text style={styles.languageText}>{language}</Text><PersonalIcon name="chevron" size={12} />
        </Pressable> : <NotificationButton disabled={backDisabled} />}
        <Pressable accessibilityRole="button" accessibilityLabel="My account" disabled={backDisabled} onPress={() => router.push("/account")} style={styles.avatar}>
          <PersonalIcon name="account" size={20} color={homeColors.ink} />
        </Pressable>
      </View>
    </View></View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, home && styles.homeContent]}>{content}</ScrollView>
        : <View style={[styles.content, { flex: 1, minHeight: 0, paddingBottom: 8 }]}>{content}</View>}
    </KeyboardAvoidingView>
  </SafeAreaView></PersonalDesign.Provider>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: pc.background },
  homeScreen: { backgroundColor: homeColors.background },
  header: { backgroundColor: homeColors.background, borderBottomWidth: 1, borderBottomColor: pc.line },
  homeHeaderSurface: { borderBottomWidth: 0 },
  headerInner: { paddingHorizontal: 20, paddingVertical: 12, minHeight: 76, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", maxWidth: 1000, alignSelf: "center" },
  homeHeader: { maxWidth: 430, gap: 8 },
  compactHeader: { paddingHorizontal: 16 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  language: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 44, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: homeColors.line, borderRadius: 24 },
  languageDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EDB34F" },
  languageText: { color: homeColors.ink, fontSize: 12, fontWeight: "600" },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: homeColors.line },
  content: { width: "100%", maxWidth: 960, alignSelf: "center", padding: 18, paddingBottom: 36, gap: 22, flexGrow: 1 },
  homeContent: { maxWidth: 430, padding: 20, paddingTop: 8, paddingBottom: 28 },
  back: { minHeight: 36, width: 36, borderRadius: 20, backgroundColor: pc.soft, alignItems: "center", justifyContent: "center" },
});
