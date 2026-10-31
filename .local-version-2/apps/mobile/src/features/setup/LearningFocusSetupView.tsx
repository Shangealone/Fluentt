import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text, TextInput } from "../../accessibility/Primitives";
import { PersonalIcon } from "../../components/PersonalIcon";
import { SetupButton, SetupFrame, u } from "./SetupUI";

type Props = { topics: string; lessons: string; topicsError: string; lessonsError: string; valid: boolean; busy: boolean; error: string;
  onTopics: (value: string) => void; onLessons: (value: string) => void; onSave: () => void; onBack: () => void; onAccount: () => void };

export function LearningFocusSetupView(p: Props) {
  const [about, setAbout] = useState(false);
  const fields = [
    { id: "topics", title: "Topics to explore", description: "What interests you? Add one topic per line.", placeholder: "Everyday conversation\nSchool life", value: p.topics, error: p.topicsError, change: p.onTopics },
    { id: "lessons", title: "Lessons to practice", description: "Is there a skill you’d like to work on? Add one per line.", placeholder: "Asking politely\nWriting a short paragraph", value: p.lessons, error: p.lessonsError, change: p.onLessons },
  ];
  return <SetupFrame title="What would you like to explore?" description="Choose topics and skills you’d like to practice." art="focus" busy={p.busy} onBack={p.onBack} onAccount={p.onAccount}>
    {fields.map(field => <View key={field.id} style={[u.card, u.field]}><Text accessibilityRole="header" style={u.label}>{field.title}</Text><Text style={u.small}>{field.description}</Text><TextInput accessibilityLabel={field.title} accessibilityHint={field.error || "One request per line. Up to 10 requests, 120 characters per request."} multiline editable={!p.busy} value={field.value} onChangeText={field.change} placeholder={field.placeholder} placeholderTextColor="#7B8982" textAlignVertical="top" style={[u.input, !!field.error && u.invalid]} /><Text style={u.caption}>Up to 10 requests · 120 characters per line</Text>{!!field.error && <Text accessibilityRole="alert" style={u.error}>{field.error}</Text>}</View>)}
    {!!p.error && <View style={u.notice}><Text accessibilityRole="alert" style={u.error}>We couldn’t save your learning focus. Your changes are still here. {p.error}</Text></View>}
    <SetupButton primary label={p.busy ? "Saving…" : "Save and continue"} disabled={p.busy || !p.valid} onPress={p.onSave} />
    <Text accessibilityLiveRegion="polite" style={u.guidance}>{!p.topics.trim() && !p.lessons.trim() ? "Add at least one topic or lesson to save." : "Your requests describe what you’d like to practice."}</Text>
    <View><Pressable accessibilityRole="button" accessibilityState={{ expanded: about }} onPress={() => setAbout(value => !value)} style={u.disclosure}><View style={about ? u.openIcon : undefined}><PersonalIcon name="chevron" size={14} /></View><Text style={[u.buttonText, u.flex]}>About your learning focus</Text></Pressable>{about && <View style={u.field}><Text style={u.small}>These are topics and lessons you’d like to practice. Available lessons may differ.</Text><Text style={u.small}>Your choices are saved to your profile. They don’t measure your ability or give you a grade.</Text></View>}</View>
  </SetupFrame>;
}
