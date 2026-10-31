import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import type { Membership } from "../../services/api/enrollment";
import { homeColors as c, PersonalDesign } from "../../theme/personal";
import type { ListState } from "../dashboard/paging";
import { h, HomeAction, SchoolbagIllustration } from "../dashboard/SchoolHomeUI";

type Props = {
  state: ListState<Membership>;
  onRefresh: () => void; onMore: () => void; onJoin: () => void; onBack: () => void; onAccount: () => void;
  onAssignments: (row: Membership) => void; onMessages: (row: Membership) => void;
};

/** Decorative class pinboard, drawn with native shapes to match the approved preview. */
function ClassPinboard({ compact }: { compact: boolean }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[s.pinboardArt, compact && s.compactArt]}>
    <View style={[s.board, compact && s.compactBoard]}>
      <View style={s.boardHole} /><View style={s.boardInset} />
      {[false, true].map(right => <View key={String(right)} style={[s.nameTag, right ? s.nameRight : s.nameLeft]}>
        <View style={s.pin} /><View style={s.tagPortrait} /><View style={s.tagLine} /><View style={s.tagShortLine} />
      </View>)}
      <View style={s.boardNote} />
    </View>
  </View>;
}

export function MyClassesView({ state, onRefresh, onMore, onJoin, onBack, onAccount, onAssignments, onMessages }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360;
  const enlarged = fontScale > 1.2;
  const stackedCard = compact && enlarged;
  const loading = state.phase === "loading";
  return <PersonalDesign.Provider value={true}><SafeAreaView edges={["top", "left", "right"]} style={s.screen}>
    <View style={[s.header, compact && s.compactHeader]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={onBack} style={({ pressed }) => [s.circle, s.back, pressed && h.dimmed]}>
        <View style={s.backIcon}><PersonalIcon name="arrow" size={20} color={c.teal} /></View>
      </Pressable>
      <FluenttLogo size={33} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={onAccount} style={({ pressed }) => [s.circle, pressed && h.dimmed]}>
        <PersonalIcon name="account" size={20} color={c.ink} />
      </Pressable>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, compact && s.compactContent]}>
      <View style={[s.hero, enlarged && s.stackedHero]}>
        <View style={[s.heroCopy, enlarged && s.stackedCopy]}><Text accessibilityRole="header" style={s.title}>My classes</Text><Text style={h.body}>A place to learn together.</Text></View>
        <ClassPinboard compact={compact} />
      </View>
      <HomeAction label="Join a class" icon="plus" variant="primary" onPress={onJoin} />
      <View style={h.section}>
        <View style={h.row}><Text accessibilityRole="header" style={h.heading}>Your classes</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh classes" accessibilityState={{ disabled: loading }} disabled={loading}
            onPress={onRefresh} style={({ pressed }) => [s.circle, s.refresh, (pressed || loading) && h.dimmed]}>
            <PersonalIcon name="refresh" size={20} color={c.teal} />
          </Pressable>
        </View>
        {loading && <View style={[h.card, s.state]} accessibilityState={{ busy: true }}>
          <View style={s.loadingArt}><ActivityIndicator color={c.teal} accessibilityLabel="Loading classes" /></View>
          <Text accessibilityLiveRegion="polite" style={[h.subheading, s.center]}>Loading your classes…</Text>
        </View>}
        {state.phase === "error" && <View style={[h.card, s.state]}>
          <View style={s.errorArt}><PersonalIcon name="refresh" size={25} color="#9E4C2E" /></View>
          <Text accessibilityRole="header" style={[h.subheading, s.center]}>We couldn’t load your classes</Text>
          <Text accessibilityRole="alert" style={[h.body, s.center]}>{state.error || "Check your connection and try again."}</Text>
          <View style={s.full}><HomeAction label="Try again" variant="primary" onPress={onRefresh} /></View>
        </View>}
        {state.phase === "ready" && state.rows.length === 0 && <View style={[h.card, s.state]}>
          <SchoolbagIllustration /><Text accessibilityRole="header" style={[h.subheading, s.center]}>Your class belongs here</Text>
          <Text style={[h.body, s.center]}>Enter the class code your teacher gave you to start learning together.</Text>
          <HomeAction label="Join a class" icon="plus" onPress={onJoin} />
        </View>}
        {state.phase === "ready" && <View style={s.list}>{state.rows.map(row => <View key={row.id} style={[h.card, s.classCard]}>
          <View style={[s.classTop, stackedCard && s.stacked]}>
            <SchoolbagIllustration /><View style={[s.classCopy, stackedCard && s.stackedCopy]}>
              <Text accessibilityRole="header" style={h.subheading}>{row.class_name}</Text>
              <Text style={h.small}>Grade {row.grade_level} · {row.language === "english" ? "English" : "Tagalog"}</Text>
            </View>
          </View>
          <View style={s.teacher}><PersonalIcon name="account" size={16} color={c.muted} /><Text style={[h.small, s.teacherName]}>{row.instructor_display_name || "Instructor"}</Text></View>
          <View style={[s.classActions, enlarged && s.stacked]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`View assignments for ${row.class_name}`} onPress={() => onAssignments(row)}
              style={({ pressed }) => [h.action, h.primary, !enlarged && s.primarySlot, pressed && h.dimmed]}><Text style={[h.actionLabel, h.primaryLabel]}>View assignments</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Class messages for ${row.class_name}`} onPress={() => onMessages(row)}
              style={({ pressed }) => [h.action, h.secondary, !enlarged && s.secondarySlot, pressed && h.dimmed]}>
              <PersonalIcon name="tutor" size={16} color={c.teal} /><Text style={h.actionLabel}>Class messages</Text>
            </Pressable>
          </View>
          <Text style={s.joined}>Joined {new Date(row.joined_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</Text>
        </View>)}</View>}
        {state.phase === "ready" && state.hasMore && <HomeAction label="Load more classes" variant="secondary" onPress={onMore} />}
      </View>
    </ScrollView>
  </SafeAreaView></PersonalDesign.Provider>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  header: { width: "100%", maxWidth: 430, alignSelf: "center", minHeight: 80, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  compactHeader: { paddingHorizontal: 16 },
  circle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  back: { backgroundColor: "#EDF3E8", borderColor: "transparent" }, backIcon: { transform: [{ rotate: "180deg" }] }, refresh: { borderWidth: 0, backgroundColor: "transparent" },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 22, paddingTop: 20, paddingBottom: 28, gap: 22, flexGrow: 1 }, compactContent: { paddingHorizontal: 18 },
  hero: { flexDirection: "row", alignItems: "center", gap: 16 }, heroCopy: { flex: 1, minWidth: 0, gap: 9 },
  stackedHero: { flexDirection: "column-reverse", alignItems: "flex-start" }, stackedCopy: { flex: 0, width: "100%" },
  title: { fontSize: 28, lineHeight: 36, fontWeight: "700", letterSpacing: -1, color: c.ink },
  pinboardArt: { width: 84, height: 86, borderRadius: 27, backgroundColor: "#EEE9F9", flexShrink: 0 }, compactArt: { width: 74, height: 78, borderRadius: 24 },
  board: { position: "absolute", left: 11, top: 17, width: 63, height: 51, borderWidth: 2, borderColor: "#64896C", borderRadius: 6, backgroundColor: "#EDCDA5", transform: [{ rotate: "-5deg" }] }, compactBoard: { left: 6, top: 14 },
  boardInset: { position: "absolute", top: 3, bottom: 3, left: 3, right: 3, borderWidth: 1, borderColor: "#CCAC83", borderRadius: 3 },
  boardHole: { position: "absolute", width: 7, height: 7, top: -8, left: 26, borderWidth: 2, borderBottomWidth: 0, borderColor: "#64896C", borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  nameTag: { position: "absolute", width: 31, height: 21, borderWidth: 1.5, borderColor: "#6C987C", borderRadius: 3, backgroundColor: "#FFFCEF" },
  nameLeft: { left: 5, top: 7, transform: [{ rotate: "-9deg" }] }, nameRight: { right: 4, bottom: 5, backgroundColor: "#DCE8C5", transform: [{ rotate: "11deg" }] },
  pin: { position: "absolute", left: 13, top: -4, width: 5, height: 5, borderWidth: 1, borderColor: "#BD7851", backgroundColor: "#E9A875", borderRadius: 3 },
  tagPortrait: { position: "absolute", left: 4, top: 6, width: 7, height: 7, backgroundColor: "#B8CFA1", borderWidth: 1, borderColor: "#739578", borderRadius: 4 },
  tagLine: { position: "absolute", left: 14, top: 7, width: 10, height: 2, backgroundColor: "#8DAC7C", borderRadius: 2 },
  tagShortLine: { position: "absolute", left: 14, top: 12, width: 7, height: 2, backgroundColor: "#8DAC7C", borderRadius: 2 },
  boardNote: { position: "absolute", width: 10, height: 13, right: 7, top: 6, backgroundColor: "#F8E5B9", borderWidth: 1, borderColor: "#B69569", borderRadius: 1, transform: [{ rotate: "9deg" }] },
  state: { alignItems: "center", paddingVertical: 26, paddingHorizontal: 19, gap: 14 }, center: { textAlign: "center" }, full: { alignSelf: "stretch" },
  loadingArt: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#EDF3E8", alignItems: "center", justifyContent: "center" },
  errorArt: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#FCE9DC", alignItems: "center", justifyContent: "center" },
  list: { gap: 14 }, classCard: { gap: 14 }, classTop: { flexDirection: "row", alignItems: "center", gap: 14 }, classCopy: { flex: 1, minWidth: 0, gap: 5 },
  teacher: { flexDirection: "row", alignItems: "center", gap: 7 }, teacherName: { flex: 1 },
  classActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, stacked: { flexDirection: "column", alignItems: "stretch" },
  primarySlot: { flexGrow: 1, flexBasis: 150 }, secondarySlot: { flexGrow: 1, flexBasis: 120 },
  joined: { fontSize: 11, lineHeight: 19, color: c.muted, paddingTop: 1 },
});
