import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Button, EmptyState, ErrorMessage, Input, s } from "../../components/ui";
import { Choices } from "../../components/onboarding";
import { Picker } from "../assignments/AssignmentEditor";
import { resultMessage } from "../assignments/ResultDetails";
import type { HistoryFilters, HistoryItem, ProgressAccess, SubmissionStatus } from "../../services/api/progress";
import { historyFilters } from "./filters";
import { ProgressOverview } from "./ProgressSummary";

export function HistoryCard({ row, onOpen }: { row: HistoryItem; onOpen?: (() => void) | null }) {
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.heading}>{row.title}</Text>
    <Text style={s.body}>{row.class_name} · Grade {row.context.grade} · {row.language === "tagalog" ? "Tagalog" : "English"}</Text>
    <Text style={s.body}>Subject: {row.context.subject_name} · Lesson: {row.context.lesson_name} · Edition: {row.context.curriculum_name}</Text>
    <Text style={s.body}>Submission: {row.submission_status === "not_started" ? "Not started" : row.submission_status === "in_progress" ? "In progress" : "Submitted"}</Text>
    <Text style={s.body}>Published: {new Date(row.published_at).toLocaleString()}</Text>
    {!!row.started_at && <Text style={s.body}>Started: {new Date(row.started_at).toLocaleString()}</Text>}
    {!!row.last_activity_at && <Text style={s.body}>Last recorded attempt change: {new Date(row.last_activity_at).toLocaleString()}</Text>}
    {!!row.submitted_at && <Text style={s.body}>Submitted: {new Date(row.submitted_at).toLocaleString()}</Text>}
    <Text style={s.body}>{resultMessage({ state: row.result_state, submission_status: row.submission_status })}</Text>
    {row.result_state === "released" && <><Text style={s.heading}>Released objective points: {row.earned_points} / {row.possible_points}</Text>
      <Text style={s.body}>Equal-point evaluation ({row.policy_version}); the original capture remains unscored. No class average or mastery is inferred.</Text></>}
    {onOpen !== null && <Button label={row.submission_status === "submitted" ? `View permitted result: ${row.title}` : `Open assignment: ${row.title}`} onPress={onOpen ?? (() => router.push({
      pathname: row.submission_status === "submitted" ? "/assessment-results" : "/assignment-attempt", params: { id: row.id },
    }))} />} 
    <Text style={s.body}>This record retains its assigned lesson and content version when newer editions are published.</Text>
  </View>;
}

export function HistoryBrowser({ api, initialClassId, personal = false }: { api: ProgressAccess; initialClassId?: string; personal?: boolean }) {
  const [selected, setSelected] = useState(initialClassId), [choosing, setChoosing] = useState(false);
  const [status, setStatus] = useState<"all" | SubmissionStatus>("all"), [from, setFrom] = useState(""), [through, setThrough] = useState("");
  const [filters, setFilters] = useState<HistoryFilters>(initialClassId ? { class_id: initialClassId, status: "all" } : { status: "all" });
  const [error, setError] = useState(""), [reload, setReload] = useState(0);
  const fetch = useCallback((offset: number) => api.history(filters, offset), [api, filters]);
  const classes = useCallback((offset: number) => api.classes(offset), [api]);
  return <View style={{ gap: 16 }}>
    <ProgressOverview key={`${filters.class_id ?? "all"}:${reload}`} api={api} classId={filters.class_id} />
    {personal ? <EmptyState title="Personal learning history is not yet recorded" description="No supported personal activity workflow currently supplies history. Preferences and curriculum browsing do not count as completed learning." /> : <>
      <Text style={s.body}>Summary counts cover all available assignments in the selected class scope, regardless of the status/date filters below. Records are ordered by submission, latest recorded attempt change, or publication time for unstarted assignments.</Text>
      <Text style={s.body}>Class filter: {selected ? "One selected class" : "All eligible classes"}. Class names and pinned curriculum context remain on each record.</Text>
      <Button secondary label="Choose history class" onPress={() => setChoosing(value => !value)} />
      <Button secondary label="Use all eligible classes" onPress={() => { setSelected(undefined); setChoosing(false); }} />
      {choosing && <Picker fetch={classes} emptyTitle="No eligible classes" emptyDescription="Join a class to see its published assignments."
        render={row => <Button key={row.id} label={`Choose ${row.class_name} · Grade ${row.grade} · ${row.language}`} onPress={() => { setSelected(row.id); setChoosing(false); }} />} />}
      <Text accessibilityRole="header" style={s.heading}>Submission filter</Text>
      <Choices values={["all", "not_started", "in_progress", "submitted"]} value={status} onChange={value => setStatus(value as typeof status)} label={value => value.replaceAll("_", " ")} />
      <Input accessibilityLabel="History start date" placeholder="Start date YYYY-MM-DD (optional)" value={from} onChangeText={setFrom} autoCapitalize="none" autoCorrect={false} />
      <Input accessibilityLabel="History end date inclusive" placeholder="End date YYYY-MM-DD (optional)" value={through} onChangeText={setThrough} autoCapitalize="none" autoCorrect={false} />
      <Text style={s.body}>Dates use the device calendar and local timezone. Unstarted assignments use their publication time; other records use their most recent attempt change or final submission. Revealing a card is activity, not completion or mastery.</Text>
      {!!error && <ErrorMessage message={error} />}
      <Button label="Apply history filters" onPress={() => {
        try { setFilters(historyFilters(selected, status, from, through)); setError(""); setReload(value => value + 1); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Check the date filters."); }
      }} />
      <Button secondary label="Clear history filters" onPress={() => { setSelected(undefined); setStatus("all"); setFrom(""); setThrough(""); setFilters({ status: "all" }); setError(""); setReload(value => value + 1); }} />
      <Button label="Refresh learning history" onPress={() => setReload(value => value + 1)} />
      <Picker key={`${JSON.stringify(filters)}:${reload}`} fetch={fetch} emptyTitle="No assignments match these filters" emptyDescription="Only published assignments in currently eligible classes appear. Try clearing the filters or refreshing."
        render={row => <HistoryCard key={row.id} row={row} />} />
    </>}
  </View>;
}
