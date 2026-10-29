import { Text, View } from "react-native";
import { Input, s } from "../../components/ui";
import { validLearningFocus, type LearningFocus } from "../../services/api/identity";

export function parseFocus(topics: string, lessons: string): LearningFocus {
  const lines = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return { topics: lines(topics), lessons: lines(lessons) };
}

export function LearningFocusFields({ topics, lessons, onTopics, onLessons, disabled = false }: {
  topics: string; lessons: string; onTopics: (value: string) => void; onLessons: (value: string) => void; disabled?: boolean;
}) {
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.heading}>◎ What topics do you need help with?</Text>
    <Text style={s.body}>For example, vocabulary or reading comprehension. Enter one topic per line.</Text>
    <Input accessibilityLabel="Topics I need help with" multiline editable={!disabled} value={topics} onChangeText={onTopics} placeholder={"Vocabulary\nReading comprehension"} style={{ minHeight: 110, textAlignVertical: "top" }} />
    <Text accessibilityRole="header" style={s.heading}>▤ Which lessons would you like to work on?</Text>
    <Text style={s.body}>Name a specific lesson or skill, such as writing a paragraph. Enter one request per line.</Text>
    <Input accessibilityLabel="Lessons I want to work on" multiline editable={!disabled} value={lessons} onChangeText={onLessons} placeholder="Writing a paragraph" style={{ minHeight: 110, textAlignVertical: "top" }} />
    <Text style={s.body}>Add at least one topic or lesson. Up to 10 distinct requests of each kind, 120 characters per request. These are your requests; available lessons may differ.</Text>
    {!!(topics.trim() || lessons.trim()) && !validLearningFocus(parseFocus(topics, lessons)) && <Text accessibilityRole="alert" style={s.error}>Remove repeated requests and keep each list to 10 lines, with no more than 120 characters per line.</Text>}
  </View>;
}
