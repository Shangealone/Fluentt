import { View } from "react-native";

export type PersonalIconName = "home" | "learn" | "voice" | "tutor" | "stats";
/** Small native line icons, sharing a stroke weight across all personal tabs. */
export function PersonalIcon({ name, color = "#1A2340", size = 22 }: { name: PersonalIconName; color?: string; size?: number }) {
  const line = { borderColor: color, borderWidth: 1.6, borderRadius: 2 };
  return <View accessible={false} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    {name === "home" ? <><View style={{ position: "absolute", width: size * 0.52, height: size * 0.52, borderTopWidth: 1.6, borderLeftWidth: 1.6, borderColor: color, transform: [{ rotate: "45deg" }], top: 2 }} /><View style={[line, { position: "absolute", bottom: 1, width: size * 0.65, height: size * 0.55, borderTopWidth: 0 }]} /><View style={[line, { position: "absolute", bottom: 1, width: size * 0.2, height: size * 0.32, borderBottomWidth: 0 }]} /></>
      : name === "learn" ? <View style={{ flexDirection: "row" }}>{[0, 1].map(index => <View key={index} style={[line, { width: size * 0.43, height: size * 0.72, padding: 2, gap: 3, borderRadius: 2 }]}>{[0, 1, 2].map(row => <View key={row} style={{ height: 1, backgroundColor: color, width: "100%" }} />)}</View>)}</View>
        : name === "voice" ? <View style={{ flexDirection: "row", gap: 2, alignItems: "center" }}>{[7, 14, 21, 12, 6].map((height, index) => <View key={index} style={{ width: 2, height: height * size / 22, borderRadius: 2, backgroundColor: color }} />)}</View>
          : name === "tutor" ? <><View style={[line, { width: size * 0.85, height: size * 0.65 }]} /><View style={{ width: 5, height: 5, borderBottomWidth: 1.6, borderLeftWidth: 1.6, borderColor: color, position: "absolute", bottom: 1, left: 3, transform: [{ skewY: "-28deg" }] }} /></>
            : <View style={{ width: size, height: size }}>{[[-5, 12, -42], [3, 10, 35], [11, 7, -42]].map(([left, top, angle], index) => <View key={index} style={{ position: "absolute", left: left + 5, top, width: 9, height: 2, borderRadius: 1, backgroundColor: color, transform: [{ rotate: `${angle}deg` }] }} />)}<View style={{ position: "absolute", right: 0, top: 0, width: 4, height: 4, borderRadius: 1, backgroundColor: color }} /></View>}
  </View>;
}
