import { Pressable, StyleSheet } from "react-native";
import { Text } from "../accessibility/Primitives";

import { router, type Href } from "expo-router";
import { theme } from "../theme/tokens";

export function BackButton({ disabled = false, target, onPress, accessibilityLabel }: { disabled?: boolean; target?: Href; onPress?: () => void; accessibilityLabel?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? (target ? "Go to My account" : "Go back to the previous screen")} accessibilityState={{ disabled }} disabled={disabled}
    onPress={() => { if (onPress) onPress(); else if (target) router.replace(target); else if (router.canGoBack()) router.back(); else router.replace("/"); }}
    style={({ pressed }) => [styles.button, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
    <Text accessible={false} style={styles.arrow}>←</Text><Text style={styles.label}>Back</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  arrow: { fontSize: 22, color: theme.colors.primary },
  label: { fontSize: 14, fontWeight: "600", color: theme.colors.ink },
});
