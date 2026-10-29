import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { pc } from "../theme/personal";

export function NotificationButton({ disabled = false }: { disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Notifications" disabled={disabled}
    accessibilityState={{ disabled }} onPress={() => router.push("/notifications")}
    style={({ pressed }) => [styles.button, { opacity: disabled ? 0.45 : pressed ? 0.65 : 1 }]}>
    <View accessible={false} style={styles.bell}>
      <View style={styles.top} /><View style={styles.body} /><View style={styles.rim} /><View style={styles.clapper} />
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  bell: { width: 24, height: 26, alignItems: "center" },
  top: { position: "absolute", top: 2, width: 3, height: 4, borderRadius: 2, backgroundColor: pc.ink },
  body: { position: "absolute", top: 5, width: 16, height: 14, borderWidth: 1.6, borderBottomWidth: 0, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderColor: pc.ink },
  rim: { position: "absolute", top: 18, width: 21, height: 2, borderRadius: 2, backgroundColor: pc.ink },
  clapper: { position: "absolute", top: 22, width: 4, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: pc.ink },
});
