import { type ComponentRef, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import type { AssessmentResult, ReviewItem } from "../../services/api/results";
import { AssignmentPresentation } from "../../theme/assignment";
import { homeColors as c } from "../../theme/personal";
import { CaptureQuestion } from "./CaptureQuestion";

type Props = {
  row: AssessmentResult | null; loading: boolean; error: string; unavailable: boolean; missing: boolean;
  onBack: () => void; onAccount: () => void; onRefresh: () => void; onOpen: () => void; onClasses: () => void;
};
const ignore = () => {};
const statuses: Record<AssessmentResult["state"], { title: string; body: string; waiting?: boolean }> = {
  not_submitted: { title: "Not started", body: "You haven’t started this assignment yet." },
  submitted: { title: "Waiting for evaluation", body: "Your work is submitted. It hasn’t been evaluated yet.", waiting: true },
  awaiting_manual_review: { title: "Needs review", body: "Your submission needs further review. A final score isn’t available yet.", waiting: true },
  withheld: { title: "Not shared yet", body: "Your teacher hasn’t shared this result with you yet.", waiting: true },
  released: { title: "Results shared", body: "Your teacher has shared your points and answer review." },
  not_applicable: { title: "No score available", body: "Objective scoring doesn’t apply to this assignment. There are no points to show." },
};

function ResultEnvelopeArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.art}>
    <View style={s.envelopeBack} /><View style={s.sheet}><View style={s.artLine} /><View style={[s.artLine, s.shortLine]} /><View style={s.artLine} /></View>
    <View style={s.envelopeFront}><View style={s.flap} /></View><View style={s.seal}><Text style={s.sealCheck}>✓</Text></View>
  </View>;
}

function itemOutcome(item: ReviewItem) {
  if (!item.answer) return item.response_id ? "Response unavailable" : "No answer submitted";
  if (item.state === "AUTO_GRADABLE" && typeof item.correct === "boolean") return item.correct ? "✓ Correct" : "Incorrect";
  return item.state === "MANUAL_REVIEW_REQUIRED" || item.state === "UNSUPPORTED" ? "Needs review" : "No score available";
}

function ResultButton({ label, onPress, primary = false, disabled = false }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, primary && s.primary, disabled && s.disabled]}><Text style={[s.buttonText, primary && s.primaryText]}>{label}</Text></Pressable>;
}

export function StudentResultView(p: Props) {
  const { width, fontScale } = useWindowDimensions();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null), reviewY = useRef(0), scrollPending = useRef(false);
  const [position, setPosition] = useState(0), [about, setAbout] = useState(false);
  const row = p.row, item = row?.released ? row.items[position] : undefined;
  useEffect(() => {
    if (!scrollPending.current) return;
    scrollPending.current = false;
    const frame = requestAnimationFrame(() => scroll.current?.scrollTo({ y: reviewY.current, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [position]);
  const move = (next: number) => {
    if (!row?.released || next < 0 || next >= row.items.length || next === position) return;
    scrollPending.current = true; setPosition(next);
  };
  const status = row?.state === "not_submitted" && row.submission_status === "in_progress"
    ? { title: "In progress", body: "Your assignment is still in progress. Submit your work before results can become available.", waiting: true }
    : row ? statuses[row.state] : null;
  return <AssignmentPresentation.Provider value={true}><SafeAreaView edges={["top", "left", "right", "bottom"]} style={s.screen}>
    <View style={[s.header, width < 360 && s.compact]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={p.onBack} style={s.circle}><View style={s.backIcon}><PersonalIcon name="chevron" size={18} /></View></Pressable>
      <FluenttLogo size={32} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={p.onAccount} style={s.circle}><PersonalIcon name="account" size={18} /></Pressable>
    </View>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, width < 360 && s.compact]}>
      <View style={[s.hero, fontScale > 1.2 && s.stacked]}><View style={s.heroCopy}><Text accessibilityRole="header" style={s.title}>Your results</Text><Text style={s.body}>See the results shared by your teacher.</Text></View><ResultEnvelopeArt /></View>
      {p.loading ? <View style={[s.card, s.center]}><ActivityIndicator color={c.teal} accessibilityLabel="Loading your results" /><Text accessibilityRole="header" style={s.heading}>Loading your results…</Text><Text style={s.body}>Checking the latest result and access.</Text></View>
        : p.missing ? <View style={[s.card, s.center]}><Text accessibilityRole="header" style={s.heading}>Choose an assignment</Text><Text style={s.body}>Open an assignment from your classes to view its results.</Text><ResultButton primary label="Back to My classes" onPress={p.onClasses} /></View>
          : p.error ? <View style={[s.card, s.center]}><Text accessibilityRole="header" style={s.heading}>{p.unavailable ? "Results unavailable" : "We couldn’t load your results"}</Text><Text accessibilityRole="alert" style={s.error}>{p.unavailable ? "This assignment or your access to it is no longer available. " : ""}{p.error}</Text>{!p.unavailable && <ResultButton primary label="Try again" onPress={p.onRefresh} />}{p.unavailable && <ResultButton primary label="Back to My classes" onPress={p.onClasses} />}</View>
            : row && status && <>
              <View style={s.section}><View style={s.row}><Text style={s.kicker}>Assignment</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh result" onPress={p.onRefresh} style={s.circle}><PersonalIcon name="refresh" size={18} /></Pressable></View><Text accessibilityRole="header" style={s.heading}>{row.title}</Text>{!!row.submitted_at && <Text style={s.small}>Submitted {new Date(row.submitted_at).toLocaleString()}</Text>}</View>
              <View style={s.card}><View style={[s.badge, status.waiting && s.waitBadge]}><Text accessibilityLiveRegion="polite" style={[s.badgeText, status.waiting && s.waitText]}>{status.title}</Text></View>
                {row.released && row.earned_points !== null && row.possible_points !== null && <View><Text style={s.pointsLabel}>Assignment points</Text><Text style={s.score}>{row.earned_points}<Text style={s.scoreTotal}> / {row.possible_points} points</Text></Text></View>}
                <Text style={s.body}>{status.body}</Text>
              </View>
              {item && <View style={s.card} onLayout={event => { reviewY.current = event.nativeEvent.layout.y; }}>
                <View style={s.row}><Text accessibilityRole="header" style={s.heading}>Answer review</Text><Text style={s.small}>Question {position + 1} of {row.items.length}</Text></View>
                <View style={[s.badge, item.correct === false && s.incorrectBadge]}><Text accessibilityLiveRegion="polite" style={[s.badgeText, item.correct === false && s.incorrectText]}>{itemOutcome(item)}{item.awarded_points !== null && item.max_points !== null ? ` · ${item.awarded_points} / ${item.max_points} points` : ""}</Text></View>
                {!item.answer && <Text style={s.body}>{item.response_id ? "Your stored response is unavailable for display. Further review is needed." : "You didn’t submit an answer to this question."}</Text>}
                <CaptureQuestion key={item.result_id} item={{ ...item.question, assignment_question_id: item.assignment_question_id }} answer={item.answer ?? undefined} back={null} disabled review onChange={ignore} onReveal={ignore} />
                <Text style={s.small}>Original response · Read only</Text>
                <View style={s.actions}><View style={s.action}><ResultButton label="Previous" disabled={position === 0} onPress={() => move(position - 1)} /></View><View style={s.action}><ResultButton label="Next" disabled={position === row.items.length - 1} onPress={() => move(position + 1)} /></View></View>
              </View>}
              <ResultButton label="Open assignment" onPress={p.onOpen} />
              <View><Pressable accessibilityRole="button" accessibilityState={{ expanded: about }} onPress={() => setAbout(value => !value)} style={s.about}><View style={about ? s.openIcon : undefined}><PersonalIcon name="chevron" size={14} /></View><Text style={[s.buttonText, s.flex]}>About your results</Text></Pressable>{about && <View style={s.section}><Text style={s.small}>Your teacher decides when to share your points and answer review.</Text><Text style={s.small}>Assignment points describe objective questions in this assignment. They aren’t an examination grade or a measure of your overall ability.</Text><Text style={s.small}>Answer review shows your original responses. Expected answers, private feedback, and Flashcard backs aren’t shown.</Text></View>}</View>
            </>}
    </ScrollView>
  </SafeAreaView></AssignmentPresentation.Provider>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, flex: { flex: 1, minWidth: 0 }, header: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 22, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  circle: { width: 46, minHeight: 46, borderRadius: 23, backgroundColor: "#EDF3E8", alignItems: "center", justifyContent: "center" }, backIcon: { transform: [{ rotate: "90deg" }] }, openIcon: { transform: [{ rotate: "180deg" }] },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 22, paddingTop: 18, paddingBottom: 30, gap: 20 }, compact: { paddingHorizontal: 16 }, hero: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 3 }, stacked: { flexDirection: "column-reverse", alignItems: "flex-start" }, heroCopy: { flex: 1, minWidth: 0, gap: 10 },
  title: { fontSize: 29, lineHeight: 37, letterSpacing: -1, fontWeight: "700", color: c.ink }, heading: { fontSize: 19, lineHeight: 29, letterSpacing: -0.5, fontWeight: "700", color: c.ink }, body: { fontSize: 14, lineHeight: 25, color: c.muted }, small: { fontSize: 12, lineHeight: 22, color: c.muted }, kicker: { fontSize: 12, lineHeight: 21, fontWeight: "600", color: c.muted },
  section: { gap: 10 }, row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }, card: { padding: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, borderRadius: 24, gap: 14 }, center: { paddingVertical: 25, gap: 16 },
  badge: { alignSelf: "flex-start", maxWidth: "100%", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "#EEF2E7" }, badgeText: { fontSize: 12, lineHeight: 21, fontWeight: "600", color: c.teal }, waitBadge: { backgroundColor: "#FBEFDA" }, waitText: { color: "#8A6238" }, incorrectBadge: { backgroundColor: "#F4EBE4" }, incorrectText: { color: "#99543B" },
  pointsLabel: { fontSize: 13, lineHeight: 23, color: c.muted, marginBottom: 4 }, score: { fontSize: 36, lineHeight: 47, letterSpacing: -1, fontWeight: "700", color: c.ink }, scoreTotal: { fontSize: 20, lineHeight: 30, fontWeight: "500", letterSpacing: -0.4, color: c.muted },
  button: { minHeight: 50, borderWidth: 1, borderColor: c.line, borderRadius: 15, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }, buttonText: { fontSize: 14, lineHeight: 24, fontWeight: "600", color: c.teal, textAlign: "center" }, primary: { borderColor: c.coral, backgroundColor: c.coral }, primaryText: { color: "#FFFFFF" }, disabled: { opacity: 0.45 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, action: { flex: 1, minWidth: 95 }, error: { color: "#A33E2B", fontSize: 13, lineHeight: 23 }, about: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9 },
  art: { width: 90, height: 94, borderRadius: 28, backgroundColor: "#EEE9F9" }, envelopeBack: { position: "absolute", left: 12, top: 38, width: 66, height: 42, backgroundColor: "#C8DCB5", borderWidth: 2, borderColor: "#5F8A6D", borderRadius: 5 }, sheet: { position: "absolute", top: 17, left: 25, width: 43, height: 51, backgroundColor: "#FFFDF3", borderWidth: 2, borderColor: "#5F8A6D", borderRadius: 5, transform: [{ rotate: "7deg" }], paddingVertical: 9, paddingHorizontal: 6 }, artLine: { height: 4, marginBottom: 7, backgroundColor: "#9AB784", borderRadius: 2, width: 24 }, shortLine: { width: 17, backgroundColor: "#C4D5AE" }, envelopeFront: { position: "absolute", left: 12, top: 47, width: 66, height: 34, borderWidth: 2, borderColor: "#5F8A6D", borderRadius: 5, backgroundColor: "#DCE8C6", overflow: "hidden" }, flap: { position: "absolute", width: 44, height: 44, left: 9, top: -31, backgroundColor: "#B9D19F", borderWidth: 2, borderColor: "#5F8A6D", transform: [{ rotate: "45deg" }], borderRadius: 3 }, seal: { position: "absolute", bottom: 10, right: 8, width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 2, borderColor: "#A97950", backgroundColor: "#F2BC92" }, sealCheck: { color: "#735338", fontSize: 14, lineHeight: 19, fontWeight: "700" },
});
