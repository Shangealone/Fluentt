import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput, useWindowDimensions } from "../../accessibility/Primitives";

import { SafeAreaView } from "react-native-safe-area-context";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon, type PersonalIconName } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";
import type { AssignmentPage } from "../../services/api/assignments";

export const classroomArt = require("../../../assets/illustrations/instructor-classroom.png");

export function CommunicationLayout({ children, onBack, onAccount }: { children: ReactNode; onBack: () => void; onAccount: () => void }) {
  const { width } = useWindowDimensions();
  return <SafeAreaView style={m.screen}>
    <KeyboardAvoidingView style={m.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={[m.content, width < 360 && m.compact]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={m.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={({ pressed }) => [m.circle, m.back, pressed && m.pressed]}><View style={m.backIcon}><PersonalIcon name="chevron" size={18} /></View></Pressable>
          <FluenttLogo size={32} />
          <Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={onAccount} style={({ pressed }) => [m.circle, pressed && m.pressed]}><PersonalIcon name="account" size={18} /></Pressable>
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function Action({ label, onPress, primary = false, quiet = false, icon, disabled = false, busy = false, expanded, accessibilityLabel }: {
  label: string; onPress: () => void; primary?: boolean; quiet?: boolean; icon?: PersonalIconName;
  disabled?: boolean; busy?: boolean; expanded?: boolean; accessibilityLabel?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled, busy, ...(expanded === undefined ? {} : { expanded }) }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [m.action, primary && m.primary, quiet && m.quiet, disabled && m.disabled, pressed && m.pressed]}>
    {busy && <ActivityIndicator size="small" color={primary ? "#FFFFFF" : c.teal} />}
    <Text style={[m.actionText, primary && m.primaryText, quiet && m.quietText]}>{label}</Text>
    {icon && <PersonalIcon name={icon} size={15} color={primary ? "#FFFFFF" : c.teal} />}
  </Pressable>;
}

export function Hero({ className }: { className?: string }) {
  const { width, fontScale } = useWindowDimensions();
  return <View style={[m.hero, fontScale > 1.2 && m.heroStack]}>
    <View style={m.heroCopy}><Text style={m.eyebrow}>{className ? "Stay connected" : "Your class space"}</Text><Text accessibilityRole="header" style={m.title}>Messages</Text><Text style={m.intro}>{className ?? "Stay connected with your class."}</Text></View>
    <View accessible={false} style={[m.heroArt, width < 360 && m.compactArt]}><PersonalIcon name="tutor" size={width < 360 ? 32 : 37} color="#7863A4" /></View>
  </View>;
}

export function SearchField({ label, placeholder, value, onChange, onSearch }: { label: string; placeholder: string; value: string; onChange: (value: string) => void; onSearch: () => void }) {
  const { fontScale } = useWindowDimensions();
  return <View><Text style={m.label}>{label}</Text><View style={[m.search, fontScale > 1.2 && m.searchStack]}>
    <TextInput accessibilityLabel={label} style={m.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#88958D" maxLength={200} autoCorrect={false} autoCapitalize="none" returnKeyType="search" onSubmitEditing={onSearch} />
    <Action label="Search" primary onPress={onSearch} />
  </View></View>;
}

export function SectionHeading({ title, onRefresh }: { title: string; onRefresh?: () => void }) {
  return <View style={m.sectionHeading}><Text accessibilityRole="header" style={m.heading}>{title}</Text>{onRefresh && <Pressable accessibilityRole="button" accessibilityLabel={`Refresh ${title.toLowerCase()}`} onPress={onRefresh} style={({ pressed }) => [m.circle, pressed && m.pressed]}><PersonalIcon name="refresh" size={17} color={c.teal} /></Pressable>}</View>;
}

export function AboutMessages() {
  const [expanded, setExpanded] = useState(false);
  return <View style={m.about}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={({ pressed }) => [m.aboutToggle, pressed && m.pressed]}><Text style={m.aboutLabel}>About class messages</Text><View style={expanded && m.up}><PersonalIcon name="chevron" size={14} color={c.teal} /></View></Pressable>
    {expanded && <View style={m.aboutBody}>
      <Text style={m.caption}>Announcements are for the whole class and don’t accept replies. Private messages are between a teacher and one enrolled student in this class.</Text>
      <Text style={m.caption}>Use text only, up to 4,000 characters. Sent messages can’t be edited or deleted. Keep private grades, answer keys, and research information out of messages.</Text>
      <Text style={m.caption}>Open a received message to mark it read for yourself. “Sent” confirms your message was saved; it doesn’t tell you whether someone else read it. Refresh to check for new messages.</Text>
      <Text style={m.caption}>For practice accounts only until the school’s real-student message retention and moderation arrangements are approved. Current class membership is required. Message history is retained when access is suspended.</Text>
    </View>}
  </View>;
}

export function CommunicationPage<T>({ fetch, render, emptyTitle = "No messages yet", emptyDescription = "New messages will appear here.", loadingLabel = "Loading your messages…", errorTitle = "We couldn’t load your messages" }: {
  fetch: (offset: number) => Promise<AssignmentPage<T>>; render: (row: T, index: number) => ReactNode;
  emptyTitle?: string; emptyDescription?: string; loadingLabel?: string; errorTitle?: string;
}) {
  const [offset, setOffset] = useState(0), [retry, setRetry] = useState(0);
  const [page, setPage] = useState<AssignmentPage<T> | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setPage(null); setError("");
      fetch(offset).then(value => { if (active) setPage(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message || "Check your connection and try again." : "Check your connection and try again."); });
    });
    return () => { active = false; };
  }, [fetch, offset, retry]);
  function move(next: number) { setPage(null); setError(""); setOffset(next); }
  if (error) return <View accessibilityRole="alert" style={[m.card, m.stateCard]}><View style={m.stateArt}><PersonalIcon name="tutor" size={29} color="#7863A4" /></View><Text accessibilityRole="header" style={m.stateTitle}>{errorTitle}</Text><Text style={m.stateMessage}>{error}</Text><View style={{ alignSelf: "stretch" }}><Action label="Try again" primary onPress={() => { setError(""); setRetry(value => value + 1); }} /></View></View>;
  if (!page) return <View accessibilityState={{ busy: true }} accessibilityLiveRegion="polite" style={m.loading}><View style={m.loadingLabel}><ActivityIndicator size="small" color={c.teal} /><Text style={m.loadingText}>{loadingLabel}</Text></View><View accessible={false} style={m.skeleton} /><View accessible={false} style={m.skeleton} /></View>;
  return <>
    {!page.items.length && <View style={[m.card, m.stateCard]}><View style={m.stateArt}><PersonalIcon name="tutor" size={29} color="#7863A4" /></View><Text accessibilityRole="header" style={m.stateTitle}>{emptyTitle}</Text><Text style={m.stateMessage}>{emptyDescription}</Text></View>}
    <View style={m.list}>{page.items.map(render)}</View>
    {(offset > 0 || page.has_more) && <View style={m.pagination}><Action label="Previous" disabled={!offset} onPress={() => move(Math.max(0, offset - 20))} /><Text accessibilityLiveRegion="polite" style={m.caption}>Page {Math.floor(offset / 20) + 1}</Text><Action label="Next" disabled={!page.has_more} onPress={() => move(offset + 20)} /></View>}
  </>;
}

export const m = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, flex: { flex: 1 }, content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingTop: 20, paddingHorizontal: 20, paddingBottom: 28 }, compact: { paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 30 }, circle: { width: 44, height: 44, flexShrink: 0, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, back: { backgroundColor: "#EDF3E8", borderColor: "transparent" }, backIcon: { transform: [{ rotate: "90deg" }] }, up: { transform: [{ rotate: "180deg" }] },
  hero: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 15, marginBottom: 23 }, heroCopy: { flex: 1, minWidth: 0 }, heroStack: { flexDirection: "column-reverse", alignItems: "flex-start", gap: 18 }, eyebrow: { color: c.teal, fontSize: 11, lineHeight: 18, fontWeight: "600", marginBottom: 7 }, title: { color: c.ink, fontSize: 27, lineHeight: 35, fontWeight: "700", letterSpacing: -1 }, intro: { color: c.muted, fontSize: 13, lineHeight: 23, marginTop: 9 }, heroArt: { width: 76, height: 84, flexShrink: 0, borderTopLeftRadius: 25, borderTopRightRadius: 25, borderBottomRightRadius: 31, borderBottomLeftRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#EEE8FA", transform: [{ rotate: "3deg" }] }, compactArt: { width: 62, height: 72 },
  heading: { flex: 1, color: c.ink, fontSize: 19, lineHeight: 29, fontWeight: "700", letterSpacing: -0.5 }, cardTitle: { color: c.ink, fontSize: 15, lineHeight: 24, fontWeight: "700", letterSpacing: -0.3 }, sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 23, marginBottom: 13 }, label: { color: c.ink, fontSize: 12, lineHeight: 20, fontWeight: "600", marginBottom: 7 }, search: { flexDirection: "row", gap: 8, marginBottom: 1 }, searchStack: { flexDirection: "column" }, input: { flex: 1, minWidth: 0, minHeight: 48, padding: 13, borderWidth: 1, borderColor: c.line, borderRadius: 13, backgroundColor: "#FFFFFF", color: c.ink, fontSize: 16, lineHeight: 25 },
  action: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, paddingVertical: 11, paddingHorizontal: 13, backgroundColor: "#EAF2E3", borderRadius: 12 }, actionText: { color: c.teal, fontSize: 12, lineHeight: 20, fontWeight: "600", flexShrink: 1, textAlign: "center" }, primary: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 3, borderBottomColor: "#AC3E23", borderRadius: 14, backgroundColor: c.coral }, primaryText: { color: "#FFFFFF", fontSize: 13, lineHeight: 21, fontWeight: "700" }, quiet: { backgroundColor: "transparent", paddingHorizontal: 0, paddingVertical: 8 }, quietText: { fontSize: 11, lineHeight: 19 }, classChange: { marginTop: -10, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: c.line, borderRadius: 21, padding: 18, backgroundColor: "#FFFFFF" }, list: { gap: 12 }, classTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }, classCopy: { flex: 1, minWidth: 0 }, classArt: { width: 46, height: 48, flexShrink: 0, borderRadius: 15, backgroundColor: "#EAF1DA", alignItems: "center", justifyContent: "center" }, classImage: { width: 38, height: 38 },
  tabs: { flexDirection: "row", padding: 5, gap: 5, borderRadius: 14, backgroundColor: "#EDF1E9", marginTop: 2, marginBottom: 19 }, tab: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 9, paddingHorizontal: 6, borderRadius: 10 }, tabStack: { flexDirection: "column" }, selectedTab: { backgroundColor: "#FFFFFF" }, tabText: { color: c.muted, fontSize: 12, lineHeight: 20, fontWeight: "600", flexShrink: 1, textAlign: "center" }, selectedTabText: { color: c.teal }, tabImage: { width: 17, height: 17, tintColor: c.teal }, caption: { color: c.muted, fontSize: 11, lineHeight: 20 }, newest: { marginTop: -6, marginBottom: 14 },
  messageTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }, avatar: { width: 38, height: 40, flexShrink: 0, borderRadius: 13, backgroundColor: "#EEE8FA", alignItems: "center", justifyContent: "center" }, avatarText: { color: "#7863A4", fontSize: 13, lineHeight: 21, fontWeight: "700" }, authorCopy: { flex: 1, minWidth: 0 }, messageDate: { marginTop: 3 }, body: { color: c.ink, fontSize: 13, lineHeight: 24 }, messageActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 15, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#EEF1EB" }, status: { flexDirection: "row", alignItems: "center", gap: 5 }, statusText: { color: c.teal, fontSize: 11, lineHeight: 19, fontWeight: "600" }, unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.teal }, announcementTag: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 7, backgroundColor: "#FFF0DD", marginBottom: 13 }, announcementText: { color: "#8A6735", fontSize: 11, lineHeight: 18, fontWeight: "600" },
  composerHost: { gap: 10 }, composer: { marginTop: 3, marginBottom: 20, gap: 12 }, textarea: { flex: 0, width: "100%", minHeight: 112, textAlignVertical: "top", backgroundColor: "#FAFCF8" }, composeMeta: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: -5 }, counter: { textAlign: "right", marginLeft: "auto" }, notice: { backgroundColor: "#FFF5E2", borderRadius: 13, padding: 13, color: c.ink, fontSize: 12, lineHeight: 22 }, error: { backgroundColor: "#FFF0E9", borderRadius: 13, padding: 13, color: "#973921", fontSize: 12, lineHeight: 22 }, success: { color: c.teal, fontSize: 12, lineHeight: 21 }, leave: { gap: 12, borderColor: "#D1DBCF" },
  peer: { marginTop: 18, marginBottom: 4 }, peerCaption: { marginBottom: 10 }, person: { flexDirection: "row", alignItems: "center", gap: 11, padding: 15, minHeight: 73, borderWidth: 1, borderColor: c.line, borderRadius: 18, backgroundColor: "#FFFFFF" }, personCopy: { flex: 1, minWidth: 0 }, personName: { color: c.ink, fontSize: 13, lineHeight: 22, fontWeight: "700" }, personCaption: { marginTop: 3 },
  about: { marginTop: 22, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 7 }, aboutToggle: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 12 }, aboutLabel: { color: c.teal, fontSize: 11, lineHeight: 19, fontWeight: "600" }, aboutBody: { gap: 12 },
  stateCard: { alignItems: "center", marginTop: 16, paddingVertical: 30, paddingHorizontal: 18, gap: 12 }, stateArt: { width: 65, height: 68, borderRadius: 22, backgroundColor: "#EEE8FA", alignItems: "center", justifyContent: "center", marginBottom: 4 }, stateTitle: { textAlign: "center", color: c.ink, fontSize: 18, lineHeight: 27, fontWeight: "700", letterSpacing: -0.3 }, stateMessage: { textAlign: "center", color: c.muted, fontSize: 13, lineHeight: 23 }, loading: { marginTop: 20, gap: 12 }, loadingLabel: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }, loadingText: { flex: 1, color: c.muted, fontSize: 13, lineHeight: 22 }, skeleton: { height: 124, backgroundColor: "#EDF2E8", borderRadius: 20 }, pagination: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16 }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.7 },
});
