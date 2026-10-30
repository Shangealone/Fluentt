import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";

import { SafeAreaView } from "react-native-safe-area-context";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import type { AssignmentPage, AssignmentSummary } from "../../services/api/assignments";
import { homeColors as c } from "../../theme/personal";

type Props = {
  fetch: (offset: number) => Promise<AssignmentPage<AssignmentSummary>>;
  canCreate: boolean;
  onRefresh: () => void;
  onBack: () => void;
  onAccount: () => void;
  onCreate: () => void;
  onOpen: (row: AssignmentSummary) => void;
  onResults: (row: AssignmentSummary) => void;
};
const classroom = require("../../../assets/illustrations/instructor-classroom.png");
const statusLabels = { draft: "Draft", published: "Published", archived: "Archived" };

export function ClassAssignmentsView({ fetch, canCreate, onRefresh, onBack, onAccount, onCreate, onOpen, onResults }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360;
  const stacked = fontScale > 1.2;
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState<AssignmentPage<AssignmentSummary> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setPage(null);
      setError("");
      fetch(offset).then(value => { if (active) setPage(value); }).catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : "Please check your connection and try again.");
      });
    });
    return () => { active = false; };
  }, [fetch, offset, retry]);
  const loading = !page && !error;
  function changePage(next: number) {
    setPage(null);
    setError("");
    setOffset(next);
  }
  return <SafeAreaView style={s.screen}>
    <ScrollView contentContainerStyle={[s.content, compact && s.compact]} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to class" onPress={onBack} style={({ pressed }) => [s.circle, s.back, pressed && s.pressed]}>
          <View style={s.backIcon}><PersonalIcon name="chevron" size={19} /></View>
        </Pressable>
        <FluenttLogo size={32} />
        <Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={onAccount} style={({ pressed }) => [s.circle, pressed && s.pressed]}>
          <PersonalIcon name="account" size={20} />
        </Pressable>
      </View>
      <View style={[s.hero, stacked && s.heroStack]}>
        <View style={s.heroCopy}>
          <Text style={s.eyebrow}>Your teaching space</Text>
          <Text accessibilityRole="header" style={[s.title, compact && s.compactTitle]}>Class assignments</Text>
          <Text style={s.subtitle}>A little preparation. More room to learn.</Text>
        </View>
        <View style={[s.heroArt, compact && s.compactArt]}><Image accessible={false} source={classroom} resizeMode="contain" style={s.heroImage} /></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canCreate }} disabled={!canCreate} onPress={onCreate} style={({ pressed }) => [s.create, !canCreate && s.disabled, pressed && s.pressed]}>
        <PersonalIcon name="plus" size={18} color="#FFFFFF" /><Text style={s.createText}>Create assignment</Text>
      </Pressable>
      <View style={s.sectionHeader}>
        <Text accessibilityRole="header" style={s.heading}>Your assignments</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh assignments" disabled={loading} accessibilityState={{ disabled: loading }} onPress={onRefresh} style={({ pressed }) => [s.circle, loading && s.disabled, pressed && s.pressed]}>
          <PersonalIcon name="refresh" size={16} color={c.teal} />
        </Pressable>
      </View>
      {loading && <View style={s.stateCard} accessibilityLiveRegion="polite" accessibilityState={{ busy: true }}>
        <View style={s.stateArt}><ActivityIndicator color={c.teal} /></View>
        <Text accessibilityRole="header" style={s.stateTitle}>Loading your assignments…</Text>
        <Text style={s.stateDescription}>Getting the latest activities.</Text>
      </View>}
      {!!error && <View style={s.stateCard} accessibilityRole="alert">
        <Text accessibilityRole="header" style={s.stateTitle}>We couldn’t load your assignments</Text>
        <Text style={s.stateDescription}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => { setError(""); setRetry(value => value + 1); }} style={({ pressed }) => [s.retry, pressed && s.pressed]}>
          <Text style={s.retryText}>Try again</Text>
        </Pressable>
      </View>}
      {page && <>
        {!page.items.length && <View style={s.stateCard}>
          <View style={s.stateArt}><Image accessible={false} source={classroom} resizeMode="contain" style={s.emptyImage} /></View>
          <Text accessibilityRole="header" style={s.stateTitle}>No assignments yet</Text>
          <Text style={s.stateDescription}>Create an assignment when you’re ready.</Text>
        </View>}
        <View style={s.list}>{page.items.map(row => <View key={row.id} style={s.card}>
          <View style={s.cardTop}>
            <View style={s.cardArt}><PersonalIcon name="assignments" size={22} color="#7863A4" /></View>
            <View style={[s.status, row.status === "draft" && s.draft, row.status === "archived" && s.archived]}>
              <View style={[s.statusDot, row.status === "draft" && s.draftDot, row.status === "archived" && s.archivedDot]} />
              <Text style={[s.statusText, row.status === "draft" && s.draftText, row.status === "archived" && s.archivedText]}>{statusLabels[row.status]}</Text>
            </View>
          </View>
          <Text accessibilityRole="header" style={s.cardTitle}>{row.title}</Text>
          <Text style={s.questionCount}>{row.question_count} {row.question_count === 1 ? "question" : "questions"}</Text>
          <View style={s.lesson}><PersonalIcon name="learn" size={16} color="#7B8E7E" /><Text style={s.lessonText}>{row.context.lesson_name}</Text></View>
          <View style={[s.actions, stacked && s.stackedActions]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open ${row.title}`} onPress={() => onOpen(row)} style={({ pressed }) => [s.open, pressed && s.pressed]}>
              <Text style={s.openText}>Open</Text><PersonalIcon name="arrow" size={16} color={c.teal} />
            </Pressable>
            {row.status === "published" && <Pressable accessibilityRole="button" accessibilityLabel={`View results for ${row.title}`} onPress={() => onResults(row)} style={({ pressed }) => [s.results, pressed && s.pressed]}>
              <Text style={s.resultsText}>View results</Text>
            </Pressable>}
          </View>
        </View>)}</View>
        {(offset > 0 || page.has_more) && <View style={[s.pagination, stacked && s.stackedActions]}>
          <Pressable accessibilityRole="button" disabled={!offset} accessibilityState={{ disabled: !offset }} onPress={() => changePage(Math.max(0, offset - 20))} style={({ pressed }) => [s.pageButton, !offset && s.disabled, pressed && s.pressed]}><Text style={s.pageText}>Previous</Text></Pressable>
          <Text accessibilityLiveRegion="polite" style={s.pageLabel}>Page {Math.floor(offset / 20) + 1}</Text>
          <Pressable accessibilityRole="button" disabled={!page.has_more} accessibilityState={{ disabled: !page.has_more }} onPress={() => changePage(offset + 20)} style={({ pressed }) => [s.pageButton, !page.has_more && s.disabled, pressed && s.pressed]}><Text style={s.pageText}>Next</Text></Pressable>
        </View>}
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 27 }, compact: { paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 27 },
  circle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center" },
  back: { backgroundColor: "#EDF3E8", borderColor: "transparent" }, backIcon: { transform: [{ rotate: "90deg" }] },
  hero: { flexDirection: "row", alignItems: "center", gap: 15, marginBottom: 22 }, heroStack: { flexDirection: "column-reverse", alignItems: "flex-start" }, heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: c.teal, fontSize: 11, lineHeight: 18, fontWeight: "600", marginBottom: 7 },
  title: { color: c.ink, fontSize: 27, lineHeight: 34, letterSpacing: -1.1, fontWeight: "700" }, compactTitle: { fontSize: 25, lineHeight: 32 },
  subtitle: { color: c.muted, fontSize: 13, lineHeight: 21, marginTop: 11 },
  heroArt: { width: 78, height: 85, borderTopLeftRadius: 25, borderTopRightRadius: 25, borderBottomRightRadius: 31, borderBottomLeftRadius: 17, backgroundColor: "#EAF1DA", alignItems: "center", justifyContent: "center", transform: [{ rotate: "3deg" }] },
  compactArt: { width: 65, height: 73 }, heroImage: { width: 66, height: 66, transform: [{ rotate: "-3deg" }] },
  create: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, minHeight: 55, padding: 14, borderRadius: 15, backgroundColor: c.coral, borderBottomWidth: 3, borderBottomColor: "#AC3E23" },
  createText: { color: "#FFFFFF", fontSize: 14, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 27, marginBottom: 12 },
  heading: { color: c.ink, fontSize: 20, lineHeight: 28, letterSpacing: -0.6, fontWeight: "700", flexShrink: 1 },
  list: { gap: 14 }, card: { padding: 19, borderWidth: 1, borderColor: c.line, borderRadius: 22, backgroundColor: "#FFFFFF" },
  cardTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 15 },
  cardArt: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#EEE8FA", alignItems: "center", justifyContent: "center" },
  status: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9, backgroundColor: "#EDF4E7" },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.teal }, statusText: { color: c.teal, fontSize: 11, lineHeight: 18, fontWeight: "500" },
  draft: { backgroundColor: "#FFF0DD" }, draftText: { color: "#966C30" }, draftDot: { backgroundColor: "#966C30" },
  archived: { backgroundColor: "#F0F2EE" }, archivedText: { color: "#758078" }, archivedDot: { backgroundColor: "#758078" },
  cardTitle: { color: c.ink, fontSize: 16, lineHeight: 24, letterSpacing: -0.4, fontWeight: "700" },
  questionCount: { color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 9 },
  lesson: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: "#EEF1EB" },
  lessonText: { color: c.muted, fontSize: 12, lineHeight: 20, flex: 1 },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 }, stackedActions: { flexDirection: "column" },
  open: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 45, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#EAF2E3" },
  openText: { color: c.teal, fontSize: 13, lineHeight: 20, fontWeight: "700", flexShrink: 1 },
  results: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 45, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF" },
  resultsText: { color: c.teal, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  stateCard: { paddingVertical: 27, paddingHorizontal: 19, borderWidth: 1, borderColor: c.line, borderRadius: 21, backgroundColor: "#FFFFFF", alignItems: "center", gap: 8 },
  stateArt: { width: 72, height: 76, borderRadius: 21, backgroundColor: "#EAF1DA", alignItems: "center", justifyContent: "center", marginBottom: 7 }, emptyImage: { width: 66, height: 66 },
  stateTitle: { color: c.ink, fontSize: 17, lineHeight: 25, fontWeight: "700", textAlign: "center" }, stateDescription: { color: c.muted, fontSize: 12, lineHeight: 21, textAlign: "center" },
  retry: { minHeight: 44, paddingVertical: 11, paddingHorizontal: 20, marginTop: 8, borderRadius: 12, backgroundColor: "#EAF2E3", justifyContent: "center" }, retryText: { color: c.teal, fontSize: 13, fontWeight: "600", lineHeight: 20 },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 16 },
  pageButton: { minHeight: 44, paddingVertical: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: "#FFFFFF", justifyContent: "center" },
  pageText: { color: c.teal, fontSize: 12, lineHeight: 19, fontWeight: "600" }, pageLabel: { color: c.muted, fontSize: 12, lineHeight: 19 },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.7 },
});
