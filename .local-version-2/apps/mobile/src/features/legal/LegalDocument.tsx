import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Text } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { homeColors as c } from "../../theme/personal";
import { legalSections, type LegalKind } from "./content";

const titles = { privacy: "Privacy Policy", terms: "Terms & Conditions" };
export function LegalDocument({ kind, onBack }: { kind: LegalKind; onBack: () => void }) {
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to previous page" onPress={onBack} style={s.back}><Text style={s.arrow}>‹</Text></Pressable><FluenttLogo size={32} /><View style={s.spacer} /></View>
    <Text accessibilityRole="header" style={s.title}>{titles[kind]}</Text>
    <Text style={s.body}>{kind === "privacy" ? "Your information. Clearly explained." : "Learning together, respectfully."}</Text>
    <View style={s.notice}><Text style={s.label}>Review draft — not yet effective</Text><Text style={s.body}>Prepared 4 November 2026. Client confirmation is pending. This is not a final policy or a request for consent.</Text></View>
    <Text style={s.body}>Retention periods, hosting and service recipients, and arrangements for children’s information must be confirmed before this notice is published for real student use.</Text>
    {legalSections[kind].map(section => <View key={section.title} style={s.card}><Text accessibilityRole="header" style={s.heading}>{section.title}</Text><Text selectable style={s.body}>{section.body}</Text></View>)}
    <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Have a question?</Text><Text style={s.body}>NE Learning Inc.</Text><Text selectable style={s.label}>nelearninginc@outlook.com</Text><Text style={s.body}>Developed by Fluency, a thesis group from Lyceum of the Philippines University - Cavite.</Text></View>
  </ScrollView></SafeAreaView>;
}

export function LegalPage({ kind }: { kind: LegalKind }) {
  return <LegalDocument kind={kind} onBack={() => { if (router.canGoBack()) router.back(); else router.replace("/"); }} />;
}

/** Reading a notice keeps authentication fields and request state in their host. */
export function LegalLinks({ disabled = false }: { disabled?: boolean }) {
  const [kind, setKind] = useState<LegalKind | null>(null);
  return <><View style={s.links}>{(["privacy", "terms"] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => setKind(value)} style={[s.link, disabled && s.disabled]}><Text style={s.label}>{titles[value]}</Text></Pressable>)}</View>
    {kind && <Modal visible animationType="slide" onRequestClose={() => setKind(null)}><LegalDocument kind={kind} onBack={() => setKind(null)} /></Modal>}
  </>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, content: { width: "100%", maxWidth: 430, alignSelf: "center", padding: 20, gap: 16, paddingBottom: 36 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }, back: { width: 46, minHeight: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF3E8" }, arrow: { fontSize: 30, color: c.ink }, spacer: { width: 46 },
  title: { fontSize: 29, lineHeight: 39, fontWeight: "700", color: c.ink }, heading: { fontSize: 17, lineHeight: 27, fontWeight: "700", color: c.ink }, body: { fontSize: 14, lineHeight: 25, color: c.muted }, label: { fontSize: 13, lineHeight: 24, fontWeight: "600", color: c.teal },
  notice: { padding: 16, gap: 8, backgroundColor: "#EDF3E4", borderRadius: 18 }, card: { padding: 18, gap: 10, borderWidth: 1, borderColor: c.line, borderRadius: 20, backgroundColor: "#FFFFFF" }, links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 }, link: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 4, justifyContent: "center" }, disabled: { opacity: 0.5 },
});
