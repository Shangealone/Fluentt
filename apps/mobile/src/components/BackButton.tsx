import { Pressable, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { theme } from "../theme/tokens";

export function BackButton({ disabled = false }: { disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Go back to the previous screen" accessibilityState={{ disabled }} disabled={disabled}
    onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/"); }}
    style={({ pressed }) => [styles.button, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
    <Text accessible={false} style={styles.arrow}>←</Text><Text style={styles.label}>Back</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  arrow: { fontSize: 22, color: theme.colors.primary },
  label: { fontSize: 14, fontWeight: "600", color: theme.colors.ink },
});
