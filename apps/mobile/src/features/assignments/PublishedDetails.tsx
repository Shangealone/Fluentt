import { Text, View } from "react-native";
import { s } from "../../components/ui";
import type { PublishedAssignment } from "../../services/api/assignments";

export function PublishedDetails({ row }: { row: PublishedAssignment }) {
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.heading}>{row.title}</Text>
    <Text style={s.body}>Published · {new Date(row.published_at).toLocaleDateString()}</Text>
    <Text style={s.body}>{row.context.curriculum_name} · Grade {row.context.grade} · {row.context.subject_name} · {row.context.lesson_name}</Text>
    {!!row.instructions && <Text style={s.body}>{row.instructions}</Text>}
    <Text style={s.body}>{row.question_count} questions · {Array.from(new Set(row.methods)).map(method => method.replaceAll("_", " ")).join(", ")}</Text>
    <Text style={s.body}>One resumable unscored attempt is available. Open the assignment to start, resume saved progress or view its submission receipt. No timer or automatic save.</Text>
  </View>;
}
