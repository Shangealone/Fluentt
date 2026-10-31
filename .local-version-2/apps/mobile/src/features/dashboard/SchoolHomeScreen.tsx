import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c, PersonalDesign } from "../../theme/personal";

export function SchoolHomeScreen({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  return <PersonalDesign.Provider value={true}>
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <View style={[styles.header, width < 360 && styles.narrow]}>
        <FluenttLogo size={width < 360 ? 32 : 36} />
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push("/notifications")}
            style={({ pressed }) => [styles.account, pressed && { opacity: 0.65 }]}><PersonalIcon name="notifications" size={20} color={c.ink} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={() => router.push("/account")}
            style={({ pressed }) => [styles.account, pressed && { opacity: 0.65 }]}><PersonalIcon name="account" size={20} color={c.ink} /></Pressable>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, width < 360 && styles.narrow]}>
        {children}
      </ScrollView>
    </SafeAreaView>
  </PersonalDesign.Provider>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  header: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 20, paddingVertical: 12, minHeight: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  account: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center" },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, flexGrow: 1 },
  narrow: { paddingHorizontal: 16 },
});
