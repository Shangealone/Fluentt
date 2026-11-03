import { type ComponentRef, useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import type { MaterialPage, MaterialResourceType, MaterialView } from "../../services/api/materials";
import { homeColors as c } from "../../theme/personal";

type Props = {
  page: MaterialPage | null; loading: boolean; error: string; unavailable: boolean; missingLesson: boolean;
  selectedId: string | null; materialRemoved: boolean; lessonId: string;
  onBack: () => void; onAccount: () => void; onRead: (id: string) => void; onList: () => void; onRefresh: () => void;
};
const labels: Record<MaterialResourceType, string> = { reading: "Reading", reference_guide: "Reference guide", vocabulary_list: "Vocabulary list", activity_sheet: "Activity sheet", audio_transcript: "Audio transcript" };

function ResourceTrayArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.art}>
    <View style={[s.paper, s.firstPaper]}><View style={s.paperLine} /><View style={s.secondPaperLine} /></View>
    <View style={[s.paper, s.middlePaper]}><View style={s.paperLine} /><View style={s.secondPaperLine} /></View>
    <View style={[s.paper, s.lastPaper]}><View style={s.paperLine} /><View style={s.secondPaperLine} /></View>
    <View style={s.tray}><View style={s.trayLabel}><View style={s.trayMark} /></View></View>
  </View>;
}

function ResourceIcon({ type }: { type: MaterialResourceType }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[s.tile, type === "reference_guide" && s.referenceTile, type === "vocabulary_list" && s.vocabularyTile, type === "activity_sheet" && s.activityTile, type === "audio_transcript" && s.transcriptTile]}>
    {type === "vocabulary_list" ? <Text style={s.letters}>Aa</Text> : <View style={s.miniSheet}>
      {type === "activity_sheet" ? <><View style={s.miniBox} /><View style={[s.miniBox, s.lowerBox]} /><View style={s.boxLine} /><View style={[s.boxLine, s.lowerBoxLine]} /></> : type === "audio_transcript" ? <View style={s.wave}>{[7, 13, 7, 11, 7].map((height, index) => <View key={index} style={[s.waveBar, { height }]} />)}</View> : <><View style={s.miniLine} /><View style={[s.miniLine, s.lineTwo]} /><View style={[s.miniLine, s.lineThree]} /></>}
      {type === "reference_guide" && <View style={s.miniTab} />}
    </View>}
  </View>;
}
function RequiredBadge() { return <View style={s.required}><Text style={s.requiredText}>Required</Text></View>; }
function MaterialButton({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[s.button, primary && s.primary]}><Text style={[s.buttonText, primary && s.primaryText]}>{label}</Text>{primary && <PersonalIcon name="arrow" size={17} color="#FFFFFF" />}</Pressable>;
}

function MaterialCard({ material, onRead }: { material: MaterialView; onRead: () => void }) {
  return <View style={s.card}><View style={s.cardTop}><ResourceIcon type={material.resource_type} /><View style={[s.section, s.flex]}><Text style={s.kind}>{labels[material.resource_type] ?? "Material"}</Text>{material.is_required && <RequiredBadge />}</View></View><Text accessibilityRole="header" style={s.itemTitle}>{material.title}</Text>{!!material.description && <Text style={s.body}>{material.description}</Text>}<MaterialButton primary label="Read material" onPress={onRead} /></View>;
}

export function LearningMaterialsView(p: Props) {
  const { width, fontScale } = useWindowDimensions();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const selected = p.page?.items.find(item => item.id === p.selectedId);
  const reading = !!selected && !p.loading && !p.error;
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [p.selectedId, p.lessonId]);
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={s.screen}>
    <View style={[s.header, width < 360 && s.compact]}>
      <Pressable accessibilityRole="button" accessibilityLabel={p.selectedId ? "Back to materials" : "Go back"} onPress={p.onBack} style={s.circle}><View style={s.backIcon}><PersonalIcon name="chevron" size={18} /></View></Pressable>
      <FluenttLogo size={32} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={p.onAccount} style={s.circle}><PersonalIcon name="account" size={18} /></Pressable>
    </View>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, width < 360 && s.compact]}>
      {reading ? <>
        <View style={s.readerHeading}><Text style={s.small}>Learning materials{p.page?.lesson_name ? ` · ${p.page.lesson_name}` : ""}</Text><View style={s.row}><Text style={s.kind}>{labels[selected.resource_type] ?? "Material"}</Text>{selected.is_required && <RequiredBadge />}</View><Text accessibilityRole="header" style={s.readerTitle}>{selected.title}</Text>{!!selected.description && <Text style={s.body}>{selected.description}</Text>}</View>
        {typeof selected.content_text === "string" && selected.content_text.trim().length > 0 ? <View style={s.card}><Text selectable style={s.reading}>{selected.content_text}</Text></View> : <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Text isn’t available here</Text><Text style={s.body}>There’s no reading text supplied for this material.</Text></View>}
        <MaterialButton label="Back to materials" onPress={p.onList} />
      </> : <>
        <View style={[s.hero, (width < 360 || fontScale > 1.2) && s.stacked]}><View style={s.heroCopy}><Text accessibilityRole="header" style={s.title}>Learning materials</Text><Text style={s.body}>Resources to help you explore your lesson.</Text></View><ResourceTrayArt /></View>
        {p.missingLesson ? <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Choose a lesson first</Text><Text style={s.body}>Open Learning materials from a lesson to see its resources.</Text><MaterialButton primary label="Go back" onPress={p.onBack} /></View>
          : p.loading ? <View style={s.card}><ActivityIndicator color={c.teal} accessibilityLabel="Loading your materials" /><Text accessibilityLiveRegion="polite" style={s.heading}>Loading your materials…</Text><Text style={s.body}>Checking the latest lesson resources.</Text></View>
            : p.error ? <View style={s.card}><Text accessibilityRole="header" style={s.heading}>{p.unavailable ? "Materials unavailable" : "We couldn’t load your materials"}</Text><Text accessibilityRole="alert" style={s.error}>{p.error}</Text><MaterialButton primary label={p.unavailable ? "Go back" : "Try again"} onPress={p.unavailable ? p.onBack : p.onRefresh} /></View>
              : p.page && <>
                <View style={s.section}><View style={s.row}><Text style={s.small}>Lesson</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh materials" onPress={p.onRefresh} style={s.circle}><PersonalIcon name="refresh" size={18} /></Pressable></View>{!!p.page.lesson_name && <Text accessibilityRole="header" style={s.heading}>{p.page.lesson_name}</Text>}</View>
                {p.materialRemoved && <View style={s.notice}><Text accessibilityLiveRegion="polite" style={s.body}>That material is no longer available. Here are the current materials for this lesson.</Text></View>}
                {p.page.items.length === 0 ? <View style={s.card}><Text accessibilityRole="header" style={s.heading}>No materials available</Text><Text style={s.body}>There are no materials for this lesson yet.</Text><MaterialButton label="Refresh materials" onPress={p.onRefresh} /></View> : p.page.items.map(material => <MaterialCard key={material.id} material={material} onRead={() => p.onRead(material.id)} />)}
              </>}
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, flex: { flex: 1, minWidth: 0 }, header: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 22, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, circle: { width: 46, minHeight: 46, borderRadius: 23, backgroundColor: "#EDF3E8", alignItems: "center", justifyContent: "center" }, backIcon: { transform: [{ rotate: "90deg" }] },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 22, paddingTop: 18, paddingBottom: 30, gap: 20 }, compact: { paddingHorizontal: 16 }, hero: { flexDirection: "row", alignItems: "center", gap: 15, marginBottom: 3 }, stacked: { flexDirection: "column-reverse", alignItems: "flex-start" }, heroCopy: { flex: 1, minWidth: 0, gap: 10 },
  title: { fontSize: 29, lineHeight: 38, fontWeight: "700", letterSpacing: -1, color: c.ink }, heading: { fontSize: 19, lineHeight: 30, fontWeight: "700", letterSpacing: -0.4, color: c.ink }, itemTitle: { fontSize: 17, lineHeight: 27, fontWeight: "700", letterSpacing: -0.3, color: c.ink }, body: { fontSize: 14, lineHeight: 25, color: c.muted }, small: { fontSize: 12, lineHeight: 22, color: c.muted }, kind: { fontSize: 12, lineHeight: 22, fontWeight: "600", color: c.teal },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }, section: { gap: 10 }, card: { padding: 18, borderWidth: 1, borderColor: c.line, borderRadius: 23, backgroundColor: "#FFFFFF", gap: 13 }, cardTop: { flexDirection: "row", alignItems: "center", gap: 11 }, required: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 9, borderRadius: 10, backgroundColor: "#F2F4EB" }, requiredText: { fontSize: 11, lineHeight: 20, fontWeight: "600", color: "#637458" },
  button: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 13, paddingHorizontal: 14, minHeight: 51, borderRadius: 15, borderWidth: 1, borderColor: c.line, backgroundColor: c.background }, buttonText: { flexShrink: 1, fontSize: 14, lineHeight: 25, fontWeight: "600", color: c.teal, textAlign: "center" }, primary: { backgroundColor: c.coral, borderColor: c.coral }, primaryText: { color: "#FFFFFF" }, reading: { fontSize: 16, lineHeight: 31, color: c.ink }, readerHeading: { gap: 12 }, readerTitle: { fontSize: 27, lineHeight: 38, letterSpacing: -0.7, fontWeight: "700", color: c.ink }, error: { fontSize: 13, lineHeight: 23, color: "#A33E2B" }, notice: { padding: 13, borderRadius: 14, backgroundColor: "#EDF3E5" },
  art: { width: 90, height: 96, borderRadius: 28, backgroundColor: "#FAECD7" }, paper: { position: "absolute", width: 28, height: 48, borderWidth: 2, borderColor: "#658B6B", borderRadius: 5, paddingVertical: 7, paddingHorizontal: 4 }, firstPaper: { left: 16, top: 20, transform: [{ rotate: "-9deg" }], backgroundColor: "#FFFDF3" }, middlePaper: { left: 32, top: 16, transform: [{ rotate: "2deg" }], backgroundColor: "#E5DFF5" }, lastPaper: { left: 48, top: 23, transform: [{ rotate: "11deg" }], backgroundColor: "#F6D2B0" }, paperLine: { width: 13, height: 4, borderRadius: 2, backgroundColor: "#92AE7E" }, secondPaperLine: { width: 13, height: 4, borderRadius: 2, backgroundColor: "#B2C69B", marginTop: 4 }, tray: { position: "absolute", left: 11, top: 51, width: 69, height: 29, borderWidth: 2, borderColor: "#658B6B", borderRadius: 6, backgroundColor: "#D7E5BE", transform: [{ rotate: "-3deg" }], alignItems: "center", justifyContent: "center" }, trayLabel: { width: 26, height: 9, borderWidth: 1.5, borderColor: "#658B6B", borderRadius: 4, backgroundColor: "#FFFDF3", alignItems: "center", justifyContent: "center" }, trayMark: { width: 8, height: 3, borderRadius: 2, backgroundColor: "#CF7755" },
  tile: { width: 47, height: 50, borderRadius: 15, backgroundColor: "#EAF0DC", alignItems: "center", justifyContent: "center" }, referenceTile: { backgroundColor: "#EEE9F9" }, vocabularyTile: { backgroundColor: "#E4F0F1" }, activityTile: { backgroundColor: "#FAECD7" }, transcriptTile: { backgroundColor: "#F6E9E1" }, miniSheet: { width: 23, height: 30, borderWidth: 1.6, borderColor: "#658B6B", borderRadius: 4, backgroundColor: "#FFFDF3", transform: [{ rotate: "-5deg" }] }, miniLine: { position: "absolute", left: 5, top: 7, width: 11, height: 2, borderRadius: 1, backgroundColor: "#A4BA8C" }, lineTwo: { top: 13 }, lineThree: { top: 19, backgroundColor: "#C3D2AF" }, miniTab: { position: "absolute", width: 5, height: 9, top: 5, right: -4, backgroundColor: "#D1C4EB", borderWidth: 1, borderColor: "#658B6B", borderRadius: 2 }, letters: { fontSize: 18, lineHeight: 25, fontWeight: "600", color: "#658B6B", letterSpacing: -0.6 }, miniBox: { position: "absolute", width: 5, height: 5, left: 4, top: 6, borderWidth: 1, borderColor: "#658B6B", borderRadius: 1, backgroundColor: "#DBE8C3" }, lowerBox: { top: 15 }, boxLine: { position: "absolute", left: 12, top: 8, width: 6, height: 2, backgroundColor: "#A4BA8C" }, lowerBoxLine: { top: 17 }, wave: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, paddingTop: 7 }, waveBar: { width: 2, borderRadius: 2, backgroundColor: "#8FA97E" },
});
