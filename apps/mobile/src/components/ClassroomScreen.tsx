import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSession } from "../session/provider";
import { PersonalDesign, pc, p } from "../theme/personal";
import { NotificationButton } from "./NotificationButton";
import { BrandWordmark } from "./BrandWordmark";

/** Classroom presentation using the existing learning palette; no learning/session state. */
export function ClassroomScreen({ children, title, description, instructor = false, backDisabled = false }: {
  children: React.ReactNode; title?: string; description?: string; instructor?: boolean; backDisabled?: boolean;
}) {
  const { profile } = useSession();
  return <PersonalDesign.Provider value={true}>
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <View style={styles.header}><View style={styles.headerInner}>
        <View style={styles.brand}>
          <BrandWordmark subtitle={instructor ? "Class teaching" : "Class learning"} />
        </View>
        <View style={styles.brand}>
          <NotificationButton disabled={backDisabled} />
          <Pressable accessibilityRole="button" accessibilityLabel={`My account · ${instructor ? "Instructor" : "Student"}`} disabled={backDisabled} onPress={() => router.push("/account")} style={styles.avatar}>
            <Text style={{ color: pc.rose, fontWeight: "800" }}>{profile?.username?.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>
      </View></View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.brand}>
            <Pressable accessibilityRole="button" accessibilityLabel="Go back to the previous screen" disabled={backDisabled}
              onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={styles.back}>
              <Text style={{ fontSize: 20, color: pc.ink }}>←</Text>
            </Pressable>
            <Text style={p.eyebrow}>{instructor ? "Your classroom teaching space" : "Your classroom learning space"}</Text>
          </View>
          {!!title && <View style={{ gap: 8 }}><Text accessibilityRole="header" style={p.title}>{title}</Text>{!!description && <Text style={p.body}>{description}</Text>}</View>}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </PersonalDesign.Provider>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: pc.background },
  header: { borderBottomWidth: 1, borderBottomColor: pc.line },
  headerInner: { width: "100%", maxWidth: 1000, alignSelf: "center", minHeight: 65, paddingHorizontal: 18, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  avatar: { width: 44, height: 44, borderRadius: 24, backgroundColor: "#F6E4E8", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "white" },
  content: { width: "100%", maxWidth: 960, alignSelf: "center", padding: 18, paddingBottom: 36, gap: 26, flexGrow: 1 },
  back: { minHeight: 44, width: 44, borderRadius: 24, backgroundColor: pc.soft, alignItems: "center", justifyContent: "center" },
});
