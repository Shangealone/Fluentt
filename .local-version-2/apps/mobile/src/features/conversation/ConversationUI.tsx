import { useState, type ReactNode } from "react";
import { Image, Pressable, View } from "react-native";
import { Text } from "../../accessibility/Primitives";
import { PersonalIcon } from "../../components/PersonalIcon";
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

export function ConversationNotice({ message, error = false }: { message: string; error?: boolean }) {
  return <View accessibilityLiveRegion="polite" accessibilityRole={error ? "alert" : undefined} style={[s.notice, error && s.error]}><Text style={[s.small, error && s.errorText]}>{message}</Text></View>;
}
