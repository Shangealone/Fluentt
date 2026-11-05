import { useState, type ReactNode } from "react";
import { Image, Pressable, View } from "react-native";
import { Text } from "../../accessibility/Primitives";
import { PersonalIcon } from "../../components/PersonalIcon";
import type { FormativeFeedback } from "../../services/api/conversation";
import { cs as s } from "./conversationStyles";

export function ConversationArt({ complete = false }: { complete?: boolean }) {
  if (complete) return <View accessible={false} style={s.completeArt}><View style={s.completeBubble}><View style={s.completeLine} /><View style={[s.completeLine, { width: 15 }]} /><View style={s.completeTail} /></View><View style={s.completeCheck}><Text style={s.checkText}>✓</Text></View></View>;
  return <View style={s.art}><Image accessible={false} source={require("../../../assets/illustrations/activity-chat.png")} resizeMode="contain" style={s.artImage} /></View>;
}

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={s.disclosure}><PersonalIcon name="chevron" size={14} /><Text style={s.quietText}>{title}</Text></Pressable>{open && <View style={s.stack}>{children}</View>}</View>;
}

export function ConversationHelp() {
  return <Disclosure title="How conversations work"><Text style={s.small}>Choose a topic and take turns replying to your practice partner. You can type or send a recording.</Text><Text style={s.small}>Sending a recording shares your voice for processing. A pronunciation score appears only when the service provides one.</Text><Text style={s.small}>Practice feedback helps you learn. It is not a school grade.</Text></Disclosure>;
}

export function ConversationFeedback({ feedback, transcript, original }: {
  feedback: FormativeFeedback;
  transcript?: boolean;
  original?: string;
}) {
  const improvement = feedback.sentence_improvement;
  const tagalog = feedback.feedback_language === "tagalog";
  return <>
    {improvement && <View style={s.goal}>
      <Text accessibilityRole="header" style={s.subheading}>{tagalog ? "Puna sa iyong sagot" : "Sentence feedback"}</Text>
      {transcript && <Text style={s.small}>{tagalog ? "Batay sa transkripsiyon ng sinabi mo." : "Based on the transcript of your spoken reply."}</Text>}
      {original && <><Text style={s.label}>{tagalog ? "Ang sagot mo" : "Your reply"}</Text><Text style={s.body}>{original}</Text></>}
      <Text style={s.label}>{tagalog ? "Subukan ito" : "Try this"}</Text>
      <Text style={s.body}>{improvement.revised_sentence}</Text>
      <Text style={s.label}>{tagalog ? "Bakit ito mas angkop" : "Why it helps"}</Text>
      <Text style={s.body}>{improvement.explanation}</Text>
    </View>}
    {!improvement && <Text style={s.small}>{feedback.summary}</Text>}
    <Disclosure title={tagalog ? "Mga payo sa pagsasanay" : "Practice tips"}>
      {!!improvement && <Text style={s.small}>{feedback.summary}</Text>}
      {feedback.politeness_marker_detected && <Text style={s.label}>{tagalog ? "Gumamit ka ng magagalang na salita." : "You used polite words."}</Text>}
      {feedback.corrections?.map((tip, index) => <Text key={`c-${index}`} style={s.small}>{tip}</Text>)}
      {feedback.suggestions?.map((tip, index) => <Text key={`s-${index}`} style={s.small}>{tip}</Text>)}
      {!!feedback.uncertainty_notice && <Text style={s.small}>{feedback.uncertainty_notice}</Text>}
    </Disclosure>
  </>;
}

export function ConversationNotice({ message, error = false }: { message: string; error?: boolean }) {
  return <View accessibilityLiveRegion="polite" accessibilityRole={error ? "alert" : undefined} style={[s.notice, error && s.error]}><Text style={[s.small, error && s.errorText]}>{message}</Text></View>;
}
