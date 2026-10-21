import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSession } from "../session/provider";
import { PersonalDesign, pc, p } from "../theme/personal";
import { NotificationButton } from "./NotificationButton";

export function PersonalScreen({ children, title, eyebrow, description, backDisabled = false, scroll = true }: {
  children: React.ReactNode; title?: string; eyebrow?: string; description?: string; backDisabled?: boolean; scroll?: boolean;
}) {
  const { profile } = useSession();
  const content = <>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back to the previous screen" disabled={backDisabled}
        onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={styles.back}><Text style={{ fontSize: 20, color: pc.ink }}>←</Text></Pressable>
      <Text style={p.eyebrow}>{eyebrow ?? "Your personal learning space"}</Text>
    </View>
    {!!title && <View style={{ gap: 8 }}><Text accessibilityRole="header" style={p.title}>{title}</Text>{!!description && <Text style={p.body}>{description}</Text>}</View>}
    {children}
  </>;
  return <PersonalDesign.Provider value={true}><SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
    <View style={styles.header}><View style={styles.headerInner}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <View style={styles.logo}><Text style={styles.logoText}>F<Text style={{ color: "#7EE1D5" }}>.</Text></Text></View>
        <View><Text style={styles.wordmark}>FLUENTT</Text><Text style={styles.contextLabel}>{profile?.language === "english" ? "EN" : "TL"} · Personal</Text></View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <NotificationButton disabled={backDisabled} />
        <Pressable accessibilityRole="button" accessibilityLabel="My account · Personal learner" disabled={backDisabled} onPress={() => router.push("/account")} style={styles.avatar}>
          <Text style={{ color: pc.rose, fontWeight: "800", fontSize: 14 }}>{profile?.username?.charAt(0).toUpperCase()}</Text>
        </Pressable>
      </View>
    </View></View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>{content}</ScrollView>
        : <View style={[styles.content, { flex: 1, minHeight: 0, paddingBottom: 8 }]}>{content}</View>}
    </KeyboardAvoidingView>
  </SafeAreaView></PersonalDesign.Provider>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: pc.background },
  header: { backgroundColor: pc.background, borderBottomWidth: 1, borderBottomColor: pc.line },
  headerInner: { paddingHorizontal: 20, height: 65, flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 1000, alignSelf: "center" },
  logo: { width: 33, height: 33, backgroundColor: "#4545F3", borderRadius: 9, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 25, color: "white", fontWeight: "800", lineHeight: 30 },
  wordmark: { fontSize: 20, fontWeight: "700", letterSpacing: -0.8, color: pc.ink },
  contextLabel: { fontSize: 10, lineHeight: 15, color: pc.muted },
  avatar: { width: 34, height: 34, borderRadius: 18, backgroundColor: "#F6E4E8", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "white" },
  content: { width: "100%", maxWidth: 960, alignSelf: "center", padding: 18, paddingBottom: 36, gap: 22, flexGrow: 1 },
  back: { minHeight: 36, width: 36, borderRadius: 20, backgroundColor: pc.soft, alignItems: "center", justifyContent: "center" },
});
