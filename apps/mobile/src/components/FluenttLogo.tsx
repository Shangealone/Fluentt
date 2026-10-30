import { Image, StyleSheet, View } from "react-native";
import { Text } from "../accessibility/Primitives";


/** The approved Open dialogue mark, bundled for both web and native. */
export function FluenttLogo({ size = 36 }: { size?: number }) {
  return <View accessible accessibilityRole="image" accessibilityLabel="Fluentt" style={styles.brand}>
    <Image accessible={false} source={require("../../assets/brand/fluentt-mark.png")} resizeMode="contain" style={{ width: size, height: size }} />
    <Text accessible={false} maxFontSizeMultiplier={1.2} style={[styles.wordmark, { fontSize: size * 25 / 36 }]}>fluentt</Text>
  </View>;
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 0 },
  wordmark: { fontSize: 25, fontWeight: "700", letterSpacing: -1.1, color: "#173E3B" },
});
