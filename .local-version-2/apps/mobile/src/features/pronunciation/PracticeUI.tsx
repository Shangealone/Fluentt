import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { PersonalIcon, type PersonalIconName } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";
import { practiceStyles as s } from "./practiceStyles";

export function PracticeHero({ selected = false }: { selected?: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  return <View style={[s.hero, fontScale > 1.2 && s.stacked]}>
    <View style={s.heroCopy}><Text style={s.eyebrow}>Speaking practice</Text><Text accessibilityRole="header" style={s.title}>{selected ? "One phrase at a time." : "Let’s practice speaking."}</Text><Text style={s.body}>{selected ? "Listen first. Then give it a try." : "Choose a phrase to get started."}</Text></View>
    <View style={[s.art, width < 360 && { width: 60, height: 68 }]}><Image accessible={false} source={require("../../../assets/illustrations/activity-speak.png")} style={[s.illustration, width < 360 && { width: 49, height: 49 }]} resizeMode="contain" /></View>
  </View>;
}

export function PracticeButton({ label, onPress, disabled = false, secondary = false, icon, grow = false, busy = false }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; icon?: PersonalIconName; grow?: boolean; busy?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, secondary && s.secondary, grow && s.listen, disabled && s.disabled, pressed && s.pressed]}>
    {busy ? <ActivityIndicator size="small" color={secondary ? c.teal : "#FFFFFF"} /> : icon ? <PersonalIcon name={icon} size={18} color={secondary ? c.teal : "#FFFFFF"} /> : null}
    <Text style={secondary ? s.secondaryText : s.buttonText}>{label}</Text>
  </Pressable>;
}

export function PracticeNotice({ message, error = false }: { message: string; error?: boolean }) {
  return <View accessibilityRole={error ? "alert" : undefined} accessibilityLiveRegion="polite" style={[s.notice, error && s.error]}><Text style={[s.small, error ? s.retryText : s.greenText]}>{message}</Text></View>;
}
