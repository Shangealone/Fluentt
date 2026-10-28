import { Pressable, StyleSheet, Text, View } from "react-native";
import { assignmentMethods, type AssignmentMethod } from "../../services/api/assignments";
import { pc, p } from "../../theme/personal";
import { questionTypes } from "./questionTypes";

export function QuestionTypePicker({ value, onChange }: { value: AssignmentMethod | ""; onChange: (method: AssignmentMethod | "") => void }) {
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={p.heading}>Choose a question type</Text>
    <Text style={p.body}>Browse one type at a time. Add questions from different types to build a mixed activity.</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Question type" style={p.grid}>
      {(["", ...assignmentMethods] as const).map(method => {
        const type = method ? questionTypes[method] : { label: "All question types", description: "Browse every available format.", icon: "▤" };
        const selected = value === method;
        return <Pressable key={method} accessibilityRole="radio" accessibilityLabel={type.label}
          aria-checked={selected}
          accessibilityHint={type.description} accessibilityState={{ checked: selected }} onPress={() => onChange(method)}
          style={[styles.option, selected && styles.selected]}>
          <View style={p.row}><Text style={[styles.icon, selected && styles.selectedText]}>{type.icon}</Text><Text style={[styles.check, selected && styles.selectedText]}>{selected ? "●" : "○"}</Text></View>
          <Text style={[styles.label, selected && styles.selectedText]}>{type.label}</Text>
          <Text style={[p.caption, selected && styles.selectedDescription]}>{type.description}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  option: { flexGrow: 1, flexBasis: 190, padding: 16, gap: 8, borderWidth: 1, borderColor: pc.line, borderRadius: 15, backgroundColor: pc.surface },
  selected: { backgroundColor: pc.navy, borderColor: pc.navy },
  icon: { fontSize: 19, fontWeight: "700", color: pc.rose },
  check: { fontSize: 16, color: pc.muted },
  label: { fontSize: 14, fontWeight: "600", color: pc.ink },
  selectedText: { color: "white" },
  selectedDescription: { color: "#D2D8E5" },
});
