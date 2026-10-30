import { Text, View } from "react-native";
import { hs as s } from "./historyStyles";

/** Decorative practice log; its check marks are artwork, not learner results. */
export function PracticeLogArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.logArt}>
    <View style={s.logShadow} /><View style={s.logPaper}><View style={s.logClip} />
      {[0, 1, 2].map(row => <View key={row} style={s.logRow}><View style={s.logCheck}><Text allowFontScaling={false} style={s.logCheckText}>✓</Text></View><View style={s.logLine} /></View>)}
      <View style={s.pencil}><View style={s.pencilTip} /></View>
    </View>
  </View>;
}
