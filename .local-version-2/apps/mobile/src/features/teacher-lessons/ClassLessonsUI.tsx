import { useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon, type PersonalIconName } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";

/** Dedicated to the lesson directory; the lesson editor's shared UI stays unchanged. */
export function ClassLessonsFrame({ children, classScoped, onBack, onAccount }: { children: ReactNode; classScoped: boolean; onBack: () => void; onAccount: () => void }) {
  const { width } = useWindowDimensions();
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={cl.screen}>
    <View style={[cl.header, width < 360 && cl.compact]}>
      <Pressable accessibilityRole="button" accessibilityLabel={classScoped ? "Back to class" : "Back to home"} onPress={onBack} style={[cl.circle, cl.back]}><View style={cl.backIcon}><PersonalIcon name="chevron" size={18} /></View></Pressable>
      <FluenttLogo size={32} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={onAccount} style={cl.circle}><PersonalIcon name="account" size={19} /></Pressable>
    </View>
    <KeyboardAvoidingView style={cl.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[cl.content, width < 360 && cl.compact]}>{children}</ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function LessonOrganizerArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={cl.art}>
    <View style={cl.organizerBack} />
    <View style={[cl.divider, cl.lilacDivider]}><View style={cl.dividerTab} /></View>
    <View style={[cl.divider, cl.blueDivider]}><View style={[cl.dividerTab, cl.blueTab]} /></View>
    <View style={[cl.divider, cl.coralDivider]}><View style={[cl.dividerTab, cl.coralTab]} /></View>
    <View style={cl.artSheet}><View style={cl.artLine} /><View style={cl.artLine} /><View style={[cl.artLine, cl.shortLine]} /></View>
    <View style={cl.organizerFront}><View style={cl.organizerLabel}><View style={cl.labelLine} /></View></View>
    <View style={cl.artGround} />
  </View>;
}

export function ClassLessonsHero({ classScoped }: { classScoped: boolean }) {
  const { fontScale } = useWindowDimensions();
  return <View style={[cl.hero, fontScale > 1.2 && cl.heroStack]}>
    <View style={cl.heroCopy}><Text style={cl.eyebrow}>YOUR TEACHING SPACE</Text><Text accessibilityRole="header" style={cl.title}>{classScoped ? "Class lessons" : "My lessons"}</Text><Text style={cl.lead}>{classScoped ? "Good ideas. Ready to share." : "Your ideas. More ways to learn."}</Text></View>
    <LessonOrganizerArt />
  </View>;
}

export function DirectoryTabIcon({ catalog, selected }: { catalog: boolean; selected: boolean }) {
  const borderColor = selected ? c.teal : c.muted;
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={cl.tabIcon}>
    {catalog ? <><View style={[cl.searchRing, { borderColor }]} /><View style={[cl.searchHandle, { backgroundColor: borderColor }]} /></>
      : <><View style={[cl.layerBack, { borderColor }]} /><View style={[cl.layerFront, { borderColor, backgroundColor: selected ? "#FFFFFF" : "#EDF2E8" }]} /></>}
  </View>;
}

export function DirectoryAction({ label, onPress, primary = false, quiet = false, disabled = false, icon }: { label: string; onPress: () => void; primary?: boolean; quiet?: boolean; disabled?: boolean; icon?: PersonalIconName }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [cl.button, primary && cl.primary, quiet && cl.quiet, disabled && cl.dim, pressed && cl.pressed]}>
    {icon && <PersonalIcon name={icon} size={17} color={primary ? "#FFFFFF" : c.teal} />}<Text style={[cl.buttonText, primary && cl.primaryText]}>{label}</Text>
  </Pressable>;
}

export function DirectoryHeading({ title, loading, onRefresh }: { title: string; loading: boolean; onRefresh: () => void }) {
  return <View style={cl.sectionHeading}><Text accessibilityRole="header" style={cl.heading}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh lessons" accessibilityState={{ disabled: loading }} disabled={loading} onPress={onRefresh} style={[cl.circle, loading && cl.dim]}><PersonalIcon name="refresh" size={17} color={c.teal} /></Pressable></View>;
}

export function LessonDirectoryTile({ alternate = false }: { alternate?: boolean }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[cl.tile, alternate && cl.lilacTile]}><View style={cl.tileSheet}><View style={cl.tileLine} /><View style={cl.tileLine} /><View style={[cl.tileLine, cl.tileShortLine]} /></View></View>;
}

export function DirectoryBadge({ status, catalog = false }: { status: "draft" | "published" | "archived"; catalog?: boolean }) {
  const label = catalog ? "Published lesson" : { draft: "Draft", published: "Published", archived: "Archived" }[status];
  return <View style={[cl.badge, status === "draft" && cl.draftBadge, status === "archived" && cl.archivedBadge]}><View style={[cl.dot, status === "draft" && cl.draftDot, status === "archived" && cl.archivedDot]} /><Text style={[cl.badgeText, status === "draft" && cl.draftText, status === "archived" && cl.archivedText]}>{label}</Text></View>;
}

export function DirectoryDisclosure({ label, children, about = false }: { label: string; children: ReactNode; about?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={about ? cl.about : cl.disclosure}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded }} onPress={() => setExpanded(v => !v)} style={cl.disclosureControl}>
      <View style={cl.disclosureLabel}>{about && <PersonalIcon name="overview" color={c.teal} size={16} />}<Text style={cl.detailLabel}>{label}</Text></View><View style={expanded && cl.chevronUp}><PersonalIcon name="chevron" color={c.teal} size={16} /></View>
    </Pressable>
    {expanded && <View style={cl.detailCopy}>{children}</View>}
  </View>;
}

export function DirectoryState({ kind, title, description, onRetry, actionLabel, onAction }: { kind: "loading" | "error" | "empty"; title: string; description?: string; onRetry?: () => void; actionLabel?: string; onAction?: () => void }) {
  return <View style={[cl.card, cl.state]} accessibilityLiveRegion="polite" accessibilityState={{ busy: kind === "loading" }}>
    {kind === "loading" ? <ActivityIndicator color={c.teal} /> : kind === "empty" ? <LessonOrganizerArt /> : null}
    <Text accessibilityRole={kind === "error" ? "alert" : "header"} style={[cl.heading, cl.center]}>{title}</Text>
    {!!description && <Text style={[cl.body, cl.center]}>{description}</Text>}
    {onRetry && <DirectoryAction label="Try again" primary onPress={onRetry} />}
    {actionLabel && onAction && <DirectoryAction label={actionLabel} onPress={onAction} />}
  </View>;
}

export const cl = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, flex: { flex: 1 },
  header: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 21, paddingTop: 20, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 21, paddingTop: 22, paddingBottom: 28, gap: 23 }, compact: { paddingHorizontal: 16 },
  circle: { width: 46, height: 46, flexShrink: 0, backgroundColor: "#FFFFFF", borderRadius: 23, borderWidth: 1, borderColor: c.line, justifyContent: "center", alignItems: "center" },
  back: { backgroundColor: "#EDF2E8", borderColor: "#EDF2E8" }, backIcon: { transform: [{ rotate: "90deg" }] },
  hero: { flexDirection: "row", alignItems: "center", gap: 14 }, heroStack: { flexDirection: "column-reverse", alignItems: "flex-start", gap: 18 }, heroCopy: { flex: 1, minWidth: 0, gap: 10 },
  eyebrow: { fontSize: 10, lineHeight: 18, letterSpacing: 1.4, fontWeight: "700", color: c.teal }, title: { fontSize: 29, lineHeight: 37, letterSpacing: -1, fontWeight: "700", color: c.ink },
  lead: { fontSize: 14, lineHeight: 24, color: c.muted }, heading: { fontSize: 18, lineHeight: 28, letterSpacing: -0.45, fontWeight: "700", color: c.ink, flexShrink: 1 },
  cardTitle: { fontSize: 18, lineHeight: 28, letterSpacing: -0.45, fontWeight: "700", color: c.ink }, body: { fontSize: 13, lineHeight: 24, color: c.muted }, small: { fontSize: 12, lineHeight: 22, color: c.muted },
  stack: { gap: 16 }, topActions: { gap: 2 }, button: { minHeight: 52, width: "100%", paddingHorizontal: 14, paddingVertical: 13, borderRadius: 15, borderWidth: 1, borderColor: c.line, backgroundColor: c.background, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 9 },
  buttonText: { color: c.teal, fontSize: 14, lineHeight: 24, fontWeight: "600", textAlign: "center", flexShrink: 1 }, primary: { backgroundColor: c.coral, borderColor: c.coral }, primaryText: { color: "#FFFFFF" },
  quiet: { backgroundColor: "transparent", borderWidth: 0, minHeight: 44, paddingVertical: 8, paddingHorizontal: 4 }, dim: { opacity: 0.5 }, pressed: { opacity: 0.78 },
  tabs: { flexDirection: "row", gap: 5, padding: 5, backgroundColor: "#EDF2E8", borderRadius: 16 }, tab: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 7, paddingVertical: 11, gap: 7, flexDirection: "row", justifyContent: "center", alignItems: "center", borderRadius: 12 },
  tabIcon: { width: 18, height: 18, flexShrink: 0 }, searchRing: { position: "absolute", left: 1, top: 1, width: 12, height: 12, borderWidth: 1.4, borderRadius: 6 }, searchHandle: { position: "absolute", left: 12, top: 11, width: 1.4, height: 6, borderRadius: 1, transform: [{ rotate: "-45deg" }] }, layerBack: { position: "absolute", left: 2, top: 6, width: 13, height: 10, borderWidth: 1.3, borderRadius: 2 }, layerFront: { position: "absolute", left: 4, top: 2, width: 13, height: 10, borderWidth: 1.3, borderRadius: 2 },
  tabStack: { flexDirection: "column" }, selectedTab: { backgroundColor: "#FFFFFF" }, tabLabel: { fontSize: 12, lineHeight: 20, color: c.muted, fontWeight: "600", flexShrink: 1, textAlign: "center" }, selectedTabLabel: { color: c.teal },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  card: { borderWidth: 1, borderColor: c.line, borderRadius: 22, backgroundColor: "#FFFFFF", padding: 18, gap: 12 }, cardTop: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 }, level: { backgroundColor: "#F0F5E9", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 }, levelText: { fontSize: 11, lineHeight: 20, color: "#41765B" },
  badge: { flexDirection: "row", flexShrink: 1, alignItems: "center", gap: 6, backgroundColor: "#EDF3E6", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#639576" }, badgeText: { fontSize: 11, lineHeight: 18, color: "#3E715C", fontWeight: "600", flexShrink: 1 },
  draftBadge: { backgroundColor: "#FAF0DB" }, draftDot: { backgroundColor: "#BC9957" }, draftText: { color: "#886932" }, archivedBadge: { backgroundColor: "#EFF0ED" }, archivedDot: { backgroundColor: "#7B887F" }, archivedText: { color: c.muted },
  disclosure: { borderTopWidth: 1, borderColor: "#EDF0EB" }, about: { borderTopWidth: 1, borderColor: c.line, paddingTop: 6 }, disclosureControl: { minHeight: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 9 }, disclosureLabel: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }, detailLabel: { color: c.teal, fontSize: 12, lineHeight: 22, flexShrink: 1 }, detailCopy: { gap: 10, paddingBottom: 10 }, chevronUp: { transform: [{ rotate: "180deg" }] },
  cardActions: { gap: 8 }, state: { alignItems: "center", paddingVertical: 26, paddingHorizontal: 20, gap: 14 }, center: { textAlign: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 }, searchStack: { flexDirection: "column", alignItems: "stretch" }, searchField: { flex: 1, minWidth: 0, minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF", padding: 12, fontSize: 16, lineHeight: 26, color: c.ink }, searchButton: { flexShrink: 0 }, searchLabel: { fontSize: 13, lineHeight: 23, color: c.ink, fontWeight: "600" }, field: { gap: 8 },
  art: { width: 94, height: 100, flexShrink: 0, borderRadius: 29, backgroundColor: "#E9F0D9" }, organizerBack: { position: "absolute", left: 15, top: 29, width: 64, height: 49, backgroundColor: "#B9D1A6", borderWidth: 2, borderColor: "#608C71", borderRadius: 6, transform: [{ rotate: "-5deg" }] },
  divider: { position: "absolute", width: 26, height: 48, borderWidth: 1.7, borderRadius: 5 }, dividerTab: { position: "absolute", left: 1, top: -5, width: 15, height: 7, borderWidth: 1.7, borderColor: "#8C84A2", backgroundColor: "#E2D9ED", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  lilacDivider: { left: 23, top: 19, backgroundColor: "#E2D9ED", borderColor: "#8C84A2", transform: [{ rotate: "-12deg" }] }, blueDivider: { left: 39, top: 20, backgroundColor: "#D4E9E9", borderColor: "#75A19C", transform: [{ rotate: "2deg" }] }, coralDivider: { left: 53, top: 24, backgroundColor: "#F3D3B8", borderColor: "#BE9976", transform: [{ rotate: "12deg" }] }, blueTab: { backgroundColor: "#D4E9E9", borderColor: "#75A19C" }, coralTab: { backgroundColor: "#F3D3B8", borderColor: "#BE9976" },
  artSheet: { position: "absolute", left: 29, top: 28, width: 34, height: 43, paddingHorizontal: 6, paddingTop: 10, gap: 5, backgroundColor: "#FFFDF2", borderWidth: 1.7, borderColor: "#799981", borderRadius: 4, transform: [{ rotate: "3deg" }] }, artLine: { width: 19, height: 2.5, borderRadius: 3, backgroundColor: "#9CB68B" }, shortLine: { width: 12 },
  organizerFront: { position: "absolute", left: 14, top: 53, width: 66, height: 28, backgroundColor: "#CBDCAF", borderWidth: 2, borderColor: "#608C71", borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 9, borderBottomRightRadius: 9, transform: [{ rotate: "-2deg" }] }, organizerLabel: { position: "absolute", left: 20, top: 7, width: 23, height: 10, borderRadius: 3, backgroundColor: "#FFF9E9", borderWidth: 1, borderColor: "#94AB83", alignItems: "center", justifyContent: "center" }, labelLine: { width: 11, height: 2, backgroundColor: "#D59C72", borderRadius: 2 }, artGround: { position: "absolute", left: 18, top: 85, width: 61, height: 2, borderRadius: 4, backgroundColor: "#BCCDAB" },
  tile: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#E9F2E4", alignItems: "center", justifyContent: "center" }, lilacTile: { backgroundColor: "#EEEBF7" }, tileSheet: { width: 22, height: 29, paddingHorizontal: 4, paddingTop: 6, gap: 3, borderWidth: 1.5, borderColor: "#A49D7C", borderRadius: 4, backgroundColor: "#FFFDF3", transform: [{ rotate: "7deg" }] }, tileLine: { width: 12, height: 2, borderRadius: 2, backgroundColor: "#9EAE8A" }, tileShortLine: { width: 8 },
});
