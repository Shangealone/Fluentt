import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { b, BuilderButton, BuilderNotice } from "./BuilderUI";
import type { AssignmentPage } from "../../services/api/assignments";

export const r = StyleSheet.create({
  art: { width: 83, height: 86, borderRadius: 25, backgroundColor: "#EEE9F9", flexShrink: 0 },
  folderBack: { position: "absolute", left: 14, top: 27, width: 56, height: 43, backgroundColor: "#B9D1AE", borderWidth: 2, borderColor: "#68967D", borderRadius: 5, transform: [{ rotate: "-7deg" }] },
  tab: { position: "absolute", left: 0, top: -9, width: 26, height: 10, borderWidth: 2, borderBottomWidth: 0, borderColor: "#68967D", backgroundColor: "#B9D1AE", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  paper: { position: "absolute", left: 29, top: 13, width: 36, height: 47, borderWidth: 2, borderColor: "#8181A7", borderRadius: 4, backgroundColor: "#FFFDF1", transform: [{ rotate: "7deg" }] },
  check: { position: "absolute", left: 3, top: 2, fontSize: 13, color: "#56896E", fontWeight: "700" },
  line: { position: "absolute", left: 16, width: 11, height: 3, borderRadius: 2, backgroundColor: "#B4C7A7" },
  front: { position: "absolute", left: 14, top: 45, width: 58, height: 29, borderRadius: 6, borderWidth: 2, borderColor: "#68967D", backgroundColor: "#D5E5BB", transform: [{ skewX: "-7deg" }] },
  folderLabel: { width: 17, height: 5, borderRadius: 2, backgroundColor: "#F2B784", alignSelf: "center", marginTop: 9 },
  person: { flexDirection: "row", alignItems: "center", gap: 12 }, avatar: { width: 45, height: 45, borderRadius: 15, backgroundColor: "#EEE9F9", alignItems: "center", justifyContent: "center" }, avatarText: { fontSize: 18, fontWeight: "700", color: "#7565AA" },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, backgroundColor: "#F4ECD9" }, badgeText: { fontSize: 12, lineHeight: 20, color: "#876523", fontWeight: "600" }, shared: { backgroundColor: "#E9F2DF" }, sharedText: { color: "#176556" }, review: { backgroundColor: "#EEE9F9" }, reviewText: { color: "#7565AA" },
  score: { fontSize: 38, lineHeight: 48, color: "#173E3B", fontWeight: "700", letterSpacing: -1 }, scoreTotal: { fontSize: 18, color: "#63766D", fontWeight: "500", letterSpacing: 0 }, grow: { flex: 1 },
});
export function ResultsArt() { return <View accessible={false} importantForAccessibility="no-hide-descendants" style={r.art}><View style={r.folderBack}><View style={r.tab} /></View><View style={r.paper}><Text style={r.check}>✓</Text>{[12, 21, 30].map(top => <View key={top} style={[r.line, { top }]} />)}</View><View style={r.front}><View style={r.folderLabel} /></View></View>; }
export function ResultsHero({ detail = false }: { detail?: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  return <View style={[b.hero, (width < 360 || fontScale > 1.2) && b.stacked]}><View style={b.heroText}><Text accessibilityRole="header" style={b.title}>{detail ? "Student result" : "Assignment results"}</Text><Text style={b.muted}>{detail ? "Review their work, then choose when to share." : "Open a submission to review and share its result."}</Text></View><ResultsArt /></View>;
}
export function ResultsShell({ children, onBack, onAccount, detail }: { children: ReactNode; onBack: () => void; onAccount: () => void; detail: boolean }) {
  return <SafeAreaView style={b.safe} edges={["top", "bottom"]}><View style={b.frame}><View style={b.header}><Pressable accessibilityRole="button" accessibilityLabel={detail ? "Back to submitted students" : "Back to assignments"} onPress={onBack} style={[b.circle, b.back]}><PersonalIcon name="chevron" size={18} /></Pressable><FluenttLogo size={32} /><Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={onAccount} style={b.circle}><PersonalIcon name="account" size={18} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={b.content}>{children}</ScrollView></View></SafeAreaView>;
}
export function ResultsPerson({ username, submitted }: { username: string; submitted: string | null }) { return <View style={r.person}><View accessible={false} style={r.avatar}><Text style={r.avatarText}>{username.charAt(0).toUpperCase()}</Text></View><View style={r.grow}><Text style={b.label}>{username}</Text>{submitted && <Text style={b.muted}>Submitted {new Date(submitted).toLocaleString()}</Text>}</View></View>; }
export function ResultsDisclosure({ title, children }: { title: string; children: ReactNode }) { const [open, setOpen] = useState(false); return <View style={b.stack}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={b.buttonText}>{open ? "−" : "+"} {title}</Text></Pressable>{open && children}</View>; }
export function ResultsAbout() { return <ResultsDisclosure title="About these results"><Text style={b.muted}>Objective points reflect an equal-point evaluation. They do not change the original classroom submission or represent an original examination grade.</Text><Text style={b.muted}>Only currently eligible students can access their own shared result. Expected answers, private rubrics, explanations, and flashcard backs remain hidden.</Text></ResultsDisclosure>; }
export function ResultsPager<T>({ fetch, render, emptyTitle, emptyDescription, errorTitle = "We couldn’t load results", paginate = true }: { fetch: (offset: number) => Promise<AssignmentPage<T>>; render: (row: T, index: number) => ReactNode; emptyTitle: string; emptyDescription: string; errorTitle?: string; paginate?: boolean }) {
  const [offset, setOffset] = useState(0), [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<{ fetch: typeof fetch; offset: number; retry: number; page?: AssignmentPage<T>; error?: string } | null>(null);
  useEffect(() => { let active = true; void fetch(offset).then(page => { if (active) setLoaded({ fetch, offset, retry, page }); }).catch(cause => { if (active) setLoaded({ fetch, offset, retry, error: cause instanceof Error ? cause.message : "Check your connection and try again." }); }); return () => { active = false; }; }, [fetch, offset, retry]);
  const current = loaded?.fetch === fetch && loaded.offset === offset && loaded.retry === retry ? loaded : null;
  if (current?.error) return <View style={b.card}><Text accessibilityRole="header" style={b.heading}>{errorTitle}</Text><BuilderNotice error>{current.error}</BuilderNotice><BuilderButton label="Try again" primary onPress={() => setRetry(x => x + 1)} /></View>;
  if (!current?.page) return <View style={b.note}><ActivityIndicator color="#176556" accessibilityLabel="Loading results" /><Text accessibilityLiveRegion="polite" style={b.body}>Loading results…</Text></View>;
  const page = current.page;
  return <View style={b.stack}>{!page.items.length && <View style={[b.card, b.empty]}><ResultsArt /><Text style={[b.heading, b.center]}>{emptyTitle}</Text><Text style={[b.muted, b.center]}>{emptyDescription}</Text></View>}{page.items.map(render)}{paginate && (offset > 0 || page.items.length > 0) && <View style={b.row}><BuilderButton label="Previous" quiet disabled={!offset} onPress={() => setOffset(Math.max(0, offset - 20))} /><Text style={b.muted}>Page {Math.floor(offset / 20) + 1}</Text><BuilderButton label="Next" quiet disabled={!page.has_more} onPress={() => setOffset(offset + 20)} /></View>}</View>;
}
