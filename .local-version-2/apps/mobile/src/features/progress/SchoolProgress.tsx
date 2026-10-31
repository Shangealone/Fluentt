import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Text, TextInput, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import type { HistoryFilters, HistoryItem, ProgressAccess, ProgressClass, SubmissionStatus } from "../../services/api/progress";
import { homeColors as c, PersonalDesign } from "../../theme/personal";
import { historyFilters } from "./filters";
import { AssignmentRecordArt, AssignmentTimelineArt, ProgressAction, ProgressDisclosure, ProgressState, s } from "./SchoolProgressUI";

/** Read identity hides the previous scope immediately; cleanup rejects late replies. */
function useRead<T>(fetch: () => Promise<T>) {
  const [snapshot, setSnapshot] = useState<{ fetch: () => Promise<T>; data?: T; error?: string } | null>(null);
  useEffect(() => {
    let active = true;
    void fetch().then(data => { if (active) setSnapshot({ fetch, data }); })
      .catch(cause => { if (active) setSnapshot({ fetch, error: cause instanceof Error ? cause.message : "We couldn’t connect. Please try again." }); });
    return () => { active = false; };
  }, [fetch]);
  const current = snapshot?.fetch === fetch ? snapshot : null;
  return { data: current?.data, error: current?.error, loading: !current };
}

const statuses: { value: "all" | SubmissionStatus; label: string }[] = [
  { value: "all", label: "All" }, { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" }, { value: "submitted", label: "Submitted" },
];
const resultLabels: Record<HistoryItem["result_state"], string> = {
  not_submitted: "", submitted: "Waiting for evaluation", awaiting_manual_review: "Waiting for review",
  withheld: "Not shared yet", released: "Shared with you", not_applicable: "No score available",
};
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

function ClassChoices({ api, onChoose }: { api: ProgressAccess; onChoose: (row: ProgressClass) => void }) {
  const [offset, setOffset] = useState(0), [retry, setRetry] = useState(0);
  const fetch = useCallback(() => api.classes(offset), [api, offset, retry]);
  const read = useRead(fetch);
  return <View style={s.section}>
    {read.loading ? <Text accessibilityLiveRegion="polite" style={s.small}>Loading your classes…</Text> : read.error ? <>
      <Text accessibilityRole="alert" style={s.error}>{read.error}</Text><ProgressAction label="Try again" secondary onPress={() => setRetry(value => value + 1)} />
    </> : read.data ? <>
      {!read.data.items.length && <Text style={s.body}>No eligible classes. Join a class to see its published assignments.</Text>}
      {read.data.items.map(row => <ProgressAction key={row.id} secondary label={`${row.class_name} · Grade ${row.grade} · ${row.language === "tagalog" ? "Tagalog" : "English"}`} onPress={() => onChoose(row)} />)}
      {(offset > 0 || read.data.has_more) && <View style={s.row}>
        <ProgressAction label="Previous classes" secondary disabled={!offset} onPress={() => setOffset(value => Math.max(0, value - 20))} />
        <ProgressAction label="More classes" secondary disabled={!read.data.has_more} onPress={() => setOffset(value => value + 20)} />
      </View>}
    </> : null}
  </View>;
}

function AssignmentCard({ row }: { row: HistoryItem }) {
  const result = resultLabels[row.result_state];
  const relevantDate = row.submission_status === "submitted" ? row.submitted_at ?? row.sort_at
    : row.submission_status === "in_progress" ? row.last_activity_at ?? row.started_at ?? row.sort_at : row.published_at;
  const dateLabel = row.submission_status === "submitted" ? "Submitted" : row.submission_status === "in_progress" ? "Last activity" : "Published";
  const points = row.result_state === "released" && row.earned_points !== null && row.possible_points !== null;
  const { width, fontScale } = useWindowDimensions();
  return <View style={s.card}>
    <View style={[s.recordTop, width < 360 && fontScale > 1.2 && { flexDirection: "column" }]}>
      <AssignmentRecordArt /><View style={[s.recordCopy, width < 360 && fontScale > 1.2 && s.stackedCopy]}>
        <Text accessibilityRole="header" style={s.itemTitle}>{row.title}</Text>
        <Text style={s.small}>{row.class_name} · Grade {row.context.grade} · {row.language === "tagalog" ? "Tagalog" : "English"}</Text>
      </View>
    </View>
    <View style={[s.badge, row.submission_status === "in_progress" && s.started, row.submission_status === "submitted" && s.submitted]}>
      <Text style={s.badgeText}>{statuses.find(item => item.value === row.submission_status)?.label}</Text>
    </View>
    <View><Text style={s.small}>{row.context.lesson_name}</Text><Text style={s.small}>{dateLabel}: {date(relevantDate)}</Text></View>
    {!!result && <View style={s.result}><Text style={s.label}>{result}</Text>{points && <>
      <Text style={s.body}>Shared points: <Text style={s.label}>{row.earned_points} / {row.possible_points}</Text></Text>
      <Text style={s.small}>Points for evaluated questions.</Text>
    </>}</View>}
    <Pressable accessibilityRole="button" accessibilityLabel={`${row.submission_status === "submitted" ? "View results" : "Open assignment"}: ${row.title}`} onPress={() => router.push({
      pathname: row.submission_status === "submitted" ? "/assessment-results" : "/assignment-attempt", params: { id: row.id },
    })} style={({ pressed }) => [s.action, pressed && s.dim]}><Text style={s.actionText}>{row.submission_status === "submitted" ? "View results" : "Open assignment"}</Text></Pressable>
    <View style={s.details}><ProgressDisclosure title="Assignment details">
      <Text style={s.small}>Subject: {row.context.subject_name}{"\n"}Lesson: {row.context.lesson_name}{"\n"}Curriculum: {row.context.curriculum_name}{"\n"}Grade {row.context.grade} · {row.language === "tagalog" ? "Tagalog" : "English"}</Text>
      <Text style={s.small}>Published: {date(row.published_at)}{row.started_at ? `\nStarted: ${date(row.started_at)}` : ""}{row.last_activity_at ? `\nLast activity: ${date(row.last_activity_at)}` : ""}{row.submitted_at ? `\nSubmitted: ${date(row.submitted_at)}` : ""}</Text>
      {points && <Text style={s.small}>These are objective points shared by your teacher, rather than an examination grade.</Text>}
    </ProgressDisclosure></View>
  </View>;
}

function SchoolProgressContent({ api, initialClassId }: { api: ProgressAccess; initialClassId?: string }) {
  const { width, fontScale } = useWindowDimensions();
  const [filters, setFilters] = useState<HistoryFilters>({ ...(initialClassId ? { class_id: initialClassId } : {}), status: "all" });
  const [classDraft, setClassDraft] = useState(initialClassId), [className, setClassName] = useState("");
  const [status, setStatus] = useState<"all" | SubmissionStatus>("all"), [from, setFrom] = useState(""), [through, setThrough] = useState("");
  const [appliedDates, setAppliedDates] = useState({ from: "", through: "" });
  const [filtersOpen, setFiltersOpen] = useState(false), [choosing, setChoosing] = useState(false), [validation, setValidation] = useState("");
  const [offset, setOffset] = useState(0), [reload, setReload] = useState(0);
  const fetchSummary = useCallback(() => api.summary(filters.class_id), [api, filters.class_id, reload]);
  const fetchHistory = useCallback(() => api.history(filters, offset), [api, filters, offset, reload]);
  const summary = useRead(fetchSummary), history = useRead(fetchHistory);
  const refresh = () => { setOffset(0); setReload(value => value + 1); };
  function apply() {
    try {
      const next = historyFilters(classDraft, status, from, through);
      setFilters(next); setAppliedDates({ from, through }); setValidation(""); setFiltersOpen(false); setChoosing(false); refresh();
    } catch (cause) { setValidation(cause instanceof Error ? cause.message : "Check your date filters."); setFiltersOpen(true); }
  }
  function clear() {
    setClassDraft(undefined); setClassName(""); setStatus("all"); setFrom(""); setThrough(""); setAppliedDates({ from: "", through: "" });
    setFilters({ status: "all" }); setValidation(""); setChoosing(false); setFiltersOpen(false); refresh();
  }
  const dirty = classDraft !== filters.class_id || status !== filters.status || from !== appliedDates.from || through !== appliedDates.through;
  const draftName = !classDraft ? "All eligible classes" : className || (summary.data?.class_id === classDraft ? summary.data.class_name : null) || "Selected class";
  const counts = summary.data?.availability === "available" ? summary.data.counts : null;
  const filtered = !!filters.since || !!filters.before || filters.status !== "all";
  const emptyTitle = filtered ? "No assignments match" : "Your classwork starts here";
  return <>
    {summary.loading ? <ProgressState loading title="Loading your assignment summary…" /> : summary.error ? <ProgressState title="We couldn’t load your summary" message={summary.error} onRetry={refresh} /> : summary.data ? <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>Your assignments</Text>
      <Text style={s.label}>{summary.data.class_name ?? (filters.class_id ? "Selected class" : "All eligible classes")}</Text>
      {counts ? <View style={[s.counts, fontScale > 1.2 && s.countsStacked]}>
        {[{ label: "Not started", value: counts.not_started }, { label: "In progress", value: counts.in_progress }, { label: "Submitted", value: counts.submitted }].map(item => <View key={item.label} style={[s.count, fontScale > 1.2 && s.countStacked]}>
          <Text style={s.number}>{item.value}</Text><Text style={s.countLabel}>{item.label}</Text>
        </View>)}
      </View> : <Text style={s.body}>An assignment summary isn’t available for this account.</Text>}
      <Text style={s.small}>Counts show submissions, rather than a grade.</Text>
    </View> : null}
    <View style={s.section}>
      <View style={s.row}><Text accessibilityRole="header" style={s.heading}>Assignment history</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh progress" accessibilityState={{ disabled: history.loading || summary.loading }} disabled={history.loading || summary.loading} onPress={refresh} style={({ pressed }) => [s.circle, (pressed || history.loading || summary.loading) && s.dim]}><PersonalIcon name="refresh" size={20} color={c.teal} /></Pressable></View>
      <View style={s.statuses}>{statuses.map(item => <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={`Submission status: ${item.label}`} accessibilityState={{ selected: status === item.value }} onPress={() => setStatus(item.value)}
        style={({ pressed }) => [s.status, (width < 360 || fontScale > 1.2) && s.narrowStatus, status === item.value && s.selectedStatus, pressed && s.dim]}>
        <Text style={[s.label, status === item.value && s.selectedText]}>{item.label}</Text>
      </Pressable>)}</View>
      <View style={filtersOpen ? s.filters : undefined}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen(value => !value)} style={s.disclosure}>
          <PersonalIcon name="settings" size={18} color={c.teal} /><Text style={s.label}>Filters</Text>
        </Pressable>
        {filtersOpen && <View style={s.section}>
          <View style={s.field}><Text style={s.label}>Class</Text><ProgressAction secondary label={draftName} onPress={() => setChoosing(value => !value)} /></View>
          {choosing && <View style={s.section}><ProgressAction secondary label="All eligible classes" onPress={() => { setClassDraft(undefined); setClassName(""); setChoosing(false); }} />
            <ClassChoices api={api} onChoose={row => { setClassDraft(row.id); setClassName(row.class_name); setChoosing(false); }} />
          </View>}
          <View style={s.field}><Text style={s.label}>From date (optional)</Text><TextInput accessibilityLabel="History start date, YYYY-MM-DD" placeholder="YYYY-MM-DD" placeholderTextColor={c.muted} value={from} onChangeText={setFrom} autoCapitalize="none" autoCorrect={false} style={s.input} /></View>
          <View style={s.field}><Text style={s.label}>Through date (optional)</Text><TextInput accessibilityLabel="History end date inclusive, YYYY-MM-DD" placeholder="YYYY-MM-DD" placeholderTextColor={c.muted} value={through} onChangeText={setThrough} autoCapitalize="none" autoCorrect={false} style={s.input} /></View>
          <Text style={s.small}>Dates use your device’s local time. The through date is included.</Text>
          {!!validation && <Text accessibilityRole="alert" style={s.error}>{validation}</Text>}
          <ProgressAction label="Apply filters" onPress={apply} />
          <Pressable accessibilityRole="button" onPress={clear} style={s.quiet}><Text style={s.label}>Clear filters</Text></Pressable>
        </View>}
      </View>
      {!filtersOpen && dirty && <ProgressAction label="Apply filters" onPress={apply} />}
      {!filtersOpen && !dirty && (filters.class_id || filtered) && <Pressable accessibilityRole="button" onPress={clear} style={s.quiet}><Text style={s.label}>Clear filters</Text></Pressable>}
      <Text style={s.small}>Status and dates filter the list. Summary counts cover every available assignment in the applied class scope.</Text>
      {history.loading ? <ProgressState loading title="Loading your assignments…" /> : history.error ? <ProgressState title="We couldn’t load your progress" message={history.error} onRetry={refresh} /> : history.data ? <>
        {history.data.availability === "unavailable" ? <ProgressState title="History isn’t available" message="Assignment history isn’t available for this account." /> : !history.data.items.length ? <View style={[s.card, s.state]}>
          <AssignmentRecordArt /><Text accessibilityRole="header" style={[s.heading, s.center]}>{emptyTitle}</Text>
          <Text style={[s.body, s.center]}>{filtered ? "Try another status or clear your filters." : "Assignments published by your teachers will appear here."}</Text>
          <ProgressAction label={filtered ? "Clear filters" : "View my classes"} onPress={filtered ? clear : () => router.push("/my-classes")} />
        </View> : history.data.items.map(row => <AssignmentCard key={row.id} row={row} />)}
        {(offset > 0 || history.data.has_more) && <View style={s.row}>
          <ProgressAction label="Newer" secondary disabled={!offset} onPress={() => setOffset(value => Math.max(0, value - (history.data?.limit ?? 20)))} />
          <Text style={s.small}>Page {Math.floor(offset / history.data.limit) + 1}</Text>
          <ProgressAction label="Older" secondary disabled={!history.data.has_more} onPress={() => setOffset(value => value + (history.data?.limit ?? 20))} />
        </View>}
      </> : null}
    </View>
    <ProgressDisclosure title="About your progress">
      <Text style={s.small}>These counts show assignment submissions, rather than measured ability or an examination grade. Submitted work can still contain unanswered questions.</Text>
      <Text style={s.small}>Only assignments in classes you can currently access appear here. Shared points appear only when your teacher has made the result available.</Text>
      <Text style={s.small}>Dates filter the submission time, latest recorded attempt change, or publication time for unstarted assignments. Revealing a card records activity, rather than completion.</Text>
      <Text style={s.small}>Your records keep the lesson and content version originally assigned to you.</Text>
      {summary.data && <Text style={s.small}>Summary checked: {new Date(summary.data.as_of).toLocaleString()}</Text>}
    </ProgressDisclosure>
  </>;
}

export function SchoolProgress({ api, initialClassId }: { api: ProgressAccess; initialClassId?: string }) {
  const { width, fontScale } = useWindowDimensions();
  return <PersonalDesign.Provider value={true}><SafeAreaView edges={["top", "left", "right"]} style={s.screen}>
    <View style={[s.header, width < 360 && s.compact]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/student"); }} style={({ pressed }) => [s.circle, pressed && s.dim]}><View style={s.backIcon}><PersonalIcon name="arrow" size={20} color={c.teal} /></View></Pressable>
      <FluenttLogo size={32} /><Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={() => router.push("/account")} style={({ pressed }) => [s.circle, pressed && s.dim]}><PersonalIcon name="account" size={20} color={c.ink} /></Pressable>
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, width < 360 && s.compact]}>
        <View style={[s.hero, fontScale > 1.2 && s.stackedHero]}><View style={[s.heroCopy, fontScale > 1.2 && s.stackedCopy]}><Text accessibilityRole="header" style={s.title}>My progress</Text><Text style={s.body}>Keep track of your class assignments.</Text></View><AssignmentTimelineArt /></View>
        <SchoolProgressContent api={api} initialClassId={initialClassId} />
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView></PersonalDesign.Provider>;
}
