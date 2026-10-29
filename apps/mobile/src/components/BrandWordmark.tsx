import { StyleSheet, Text, View } from "react-native";
import { pc } from "../theme/personal";

/** One text-only brand treatment across the mobile and web app. */
export function BrandWordmark({ subtitle }: { subtitle?: string }) {
  return <View>
    <Text style={styles.wordmark}>FLUENTT</Text>
    {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  wordmark: { fontSize: 20, lineHeight: 25, fontWeight: "700", letterSpacing: -0.8, color: pc.ink },
  subtitle: { fontSize: 10, lineHeight: 15, color: pc.muted },
});
