import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";

import { SafeAreaView } from "react-native-safe-area-context";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";
import type { NotificationEventType, NotificationItem, NotificationPage } from "../../services/api/materials";

export type NotificationsState = { phase: "loading" | "ready" | "error"; page: NotificationPage | null; error: string | null };
type Props = {
  state: NotificationsState; operation: string | null; actionError: string;
  onBack: () => void; onAccount: () => void; onRefresh: () => void;
  onRead: (item: NotificationItem) => void; onReadAll: () => void;
};

function UpdateIcon({ type }: { type: NotificationEventType }) {
  if (type === "class_announcement") return <View style={[s.tile, s.announcementTile]}><Image accessible={false} source={require("../../../assets/icons/speaker.png")} resizeMode="contain" style={s.speaker} /></View>;
  if (type === "learning_material_available") return <View style={[s.tile, s.materialTile]}><Image accessible={false} source={require("../../../assets/illustrations/activity-learn.png")} resizeMode="contain" style={s.book} /></View>;
  return <View style={[s.tile, type === "general" && s.generalTile]}><PersonalIcon name={type === "assignment_published" ? "assignments" : "notifications"} size={22} color={type === "assignment_published" ? "#7863A4" : c.teal} /></View>;
}

function updateDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const day = date.toDateString() === now.toDateString() ? "Today" : date.toDateString() === yesterday.toDateString() ? "Yesterday" : date.toLocaleDateString();
  return `${day} · ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function NotificationsView({ state, operation, actionError, onBack, onAccount, onRefresh, onRead, onReadAll }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360;
  const busy = operation !== null;
  const loading = state.phase === "loading";
  const page = state.phase === "ready" ? state.page : null;
  const unread = page?.unread_count ?? 0;
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={[s.content, compact && s.compact]} showsVerticalScrollIndicator={false}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={({ pressed }) => [s.circle, s.back, pressed && s.pressed]}><View style={s.backIcon}><PersonalIcon name="chevron" size={18} /></View></Pressable>
      <FluenttLogo size={32} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={onAccount} style={({ pressed }) => [s.circle, pressed && s.pressed]}><PersonalIcon name="account" size={18} /></Pressable>
    </View>
    <View style={[s.hero, fontScale > 1.2 && s.heroStack]}>
      <View style={s.heroCopy}><Text style={s.eyebrow}>Stay in the loop</Text><Text accessibilityRole="header" style={[s.title, compact && s.compactTitle]}>Notifications</Text><Text style={s.intro}>Your latest updates,{"\n"}all in one place.</Text></View>
      <View accessible={false} style={[s.heroArt, compact && s.compactArt]}><PersonalIcon name="notifications" size={compact ? 30 : 38} color={c.teal} /><View style={s.heroDot} /></View>
    </View>
    <View style={s.listHeading}>
      <View style={s.headingCopy}><Text accessibilityRole="header" style={s.heading}>Your updates</Text>{page && (page.items.length > 0 || unread > 0) && <View style={s.unreadCount}><Text accessibilityLiveRegion="polite" style={s.unreadCountText}>{unread ? `${unread} unread` : "All caught up"}</Text></View>}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh notifications" accessibilityState={{ disabled: busy || loading, busy: loading }} disabled={busy || loading} onPress={onRefresh} style={({ pressed }) => [s.circle, (busy || loading) && s.disabled, pressed && s.pressed]}><PersonalIcon name="refresh" size={17} color={c.teal} /></Pressable>
    </View>
    {page && unread > 0 && <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy: operation === "all" }} disabled={busy} onPress={onReadAll} style={({ pressed }) => [s.readAll, busy && s.disabled, pressed && s.pressed]}>{operation === "all" && <ActivityIndicator size="small" color={c.teal} />}<Text style={s.readAllText}>{operation === "all" ? "Marking updates as read…" : "Mark all as read"}</Text></Pressable>}
    {!!actionError && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.actionError}>{actionError}</Text>}
    {loading && <View accessibilityLiveRegion="polite" accessibilityState={{ busy: true }} style={s.loading}><View style={s.loadingLabel}><ActivityIndicator size="small" color={c.teal} /><Text style={s.loadingText}>Loading your updates…</Text></View>{[0, 1, 2].map(index => <View key={index} accessible={false} style={s.skeleton} />)}</View>}
    {state.phase === "error" && <View accessibilityRole="alert" style={s.stateCard}><View style={s.stateArt}><PersonalIcon name="notifications" size={31} color={c.teal} /></View><Text accessibilityRole="header" style={s.stateTitle}>We couldn’t load your updates</Text><Text style={s.stateMessage}>{state.error || "Check your connection and try again."}</Text><Pressable accessibilityRole="button" onPress={onRefresh} style={({ pressed }) => [s.retry, pressed && s.pressed]}><Text style={s.retryText}>Try again</Text></Pressable></View>}
    {page && (page.items.length === 0 ? <View style={s.stateCard}><View style={s.stateArt}><PersonalIcon name="notifications" size={31} color={c.teal} /></View><Text accessibilityRole="header" style={s.stateTitle}>No updates yet</Text><Text style={s.stateMessage}>New updates will appear here.</Text></View> : <>
      <View style={s.list}>{page.items.map(item => {
        const isUnread = item.read_at === null;
        return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.message}. ${isUnread ? "Unread" : "Read"}. ${updateDate(item.created_at)}`} accessibilityState={{ disabled: busy, busy: operation === item.id }} disabled={busy} onPress={() => onRead(item)} style={({ pressed }) => [s.item, isUnread && s.unreadItem, compact && s.compactItem, pressed && s.pressed]}>
          <UpdateIcon type={item.event_type} /><View style={s.itemCopy}><View style={s.itemTitleRow}><Text style={[s.itemTitle, isUnread && s.unreadTitle]}>{item.title}</Text>{operation === item.id ? <ActivityIndicator size="small" color={c.teal} /> : isUnread ? <View accessible={false} style={s.unreadDot} /> : null}</View><Text style={s.message}>{item.message}</Text><Text style={s.date}>{updateDate(item.created_at)}</Text></View>
        </Pressable>;
      })}</View>
      {!page.has_more && <Text style={s.footer}>That’s everything for now.</Text>}
    </>)}
  </ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingTop: 20, paddingHorizontal: 20, paddingBottom: 28 }, compact: { paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 32 }, circle: { width: 44, height: 44, flexShrink: 0, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, back: { backgroundColor: "#EDF3E8", borderColor: "transparent" }, backIcon: { transform: [{ rotate: "90deg" }] },
  hero: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 31 }, heroCopy: { flex: 1, minWidth: 0 }, heroStack: { flexDirection: "column-reverse", alignItems: "flex-start", gap: 18 }, eyebrow: { color: c.teal, fontSize: 11, lineHeight: 18, fontWeight: "600", marginBottom: 7 }, title: { color: c.ink, fontSize: 27, lineHeight: 35, letterSpacing: -1, fontWeight: "700" }, compactTitle: { fontSize: 24, lineHeight: 32 }, intro: { color: c.muted, fontSize: 13, lineHeight: 23, marginTop: 10 },
  heroArt: { width: 76, height: 84, flexShrink: 0, backgroundColor: "#FFF0DD", borderTopLeftRadius: 25, borderTopRightRadius: 25, borderBottomRightRadius: 31, borderBottomLeftRadius: 17, alignItems: "center", justifyContent: "center", transform: [{ rotate: "3deg" }] }, compactArt: { width: 56, height: 64, borderRadius: 20 }, heroDot: { position: "absolute", width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: "#FFF0DD", backgroundColor: "#D97C45", top: 17, right: 14 },
  listHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, headingCopy: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }, heading: { color: c.ink, fontSize: 19, lineHeight: 29, fontWeight: "700", letterSpacing: -0.5 }, unreadCount: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: c.selected, borderRadius: 8 }, unreadCountText: { color: c.teal, fontSize: 11, lineHeight: 18, fontWeight: "600" },
  readAll: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", gap: 7, paddingVertical: 10, minHeight: 44, marginTop: 1, marginBottom: 10 }, readAllText: { color: c.teal, fontSize: 12, lineHeight: 19, fontWeight: "600", flexShrink: 1 },
  list: { gap: 11, marginTop: 14 }, item: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 17, paddingHorizontal: 15, borderWidth: 1, borderColor: c.line, borderRadius: 20, backgroundColor: "#FFFFFF" }, unreadItem: { borderColor: "#B7CDBE", backgroundColor: "#FEFFFC" }, compactItem: { gap: 10, paddingVertical: 16, paddingHorizontal: 13 },
  tile: { width: 40, height: 43, borderRadius: 13, flexShrink: 0, backgroundColor: "#EEE8FA", alignItems: "center", justifyContent: "center" }, announcementTile: { backgroundColor: "#FFF0DD" }, materialTile: { backgroundColor: c.selected }, generalTile: { backgroundColor: "#E7F1F2" }, speaker: { width: 22, height: 22, tintColor: "#AD6F32" }, book: { width: 30, height: 30 },
  itemCopy: { flex: 1, minWidth: 0 }, itemTitleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }, itemTitle: { flex: 1, color: c.ink, fontSize: 13, lineHeight: 22, fontWeight: "500" }, unreadTitle: { fontWeight: "700" }, unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.teal, marginTop: 7, flexShrink: 0 }, message: { marginTop: 5, marginBottom: 8, color: c.muted, fontSize: 12, lineHeight: 21 }, date: { color: c.muted, fontSize: 11, lineHeight: 18 }, footer: { color: c.muted, fontSize: 11, lineHeight: 19, textAlign: "center", marginTop: 22 },
  stateCard: { marginTop: 19, paddingVertical: 34, paddingHorizontal: 20, alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, borderRadius: 22 }, stateArt: { width: 68, height: 72, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF1DA", borderRadius: 23, marginBottom: 18 }, stateTitle: { textAlign: "center", color: c.ink, fontSize: 18, lineHeight: 27, fontWeight: "700", letterSpacing: -0.45 }, stateMessage: { textAlign: "center", color: c.muted, fontSize: 13, lineHeight: 23, marginTop: 9 }, retry: { width: "100%", alignItems: "center", justifyContent: "center", minHeight: 48, padding: 14, borderRadius: 14, borderBottomWidth: 3, borderBottomColor: "#AC3E23", backgroundColor: c.coral, marginTop: 21 }, retryText: { color: "#FFFFFF", fontSize: 13, lineHeight: 21, fontWeight: "700" },
  loading: { marginTop: 21 }, loadingLabel: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 18 }, loadingText: { flex: 1, color: c.muted, fontSize: 13, lineHeight: 22 }, skeleton: { height: 125, backgroundColor: "#EDF2E8", borderRadius: 20, marginBottom: 11 }, actionError: { color: "#973921", backgroundColor: "#FFF0E9", padding: 13, borderRadius: 12, marginTop: 12, fontSize: 13, lineHeight: 21 }, disabled: { opacity: 0.5 }, pressed: { opacity: 0.7 },
});
