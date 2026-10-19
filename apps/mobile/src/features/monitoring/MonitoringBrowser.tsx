import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Input, s } from "../../components/ui";
import { Choices } from "../../components/onboarding";
import { Picker } from "../assignments/AssignmentEditor";
import { HistoryCard } from "../progress/HistoryBrowser";
import { resultMessage } from "../assignments/ResultDetails";
import type { MonitoringAccess, MonitoringFilters, Overview, Counts, ResultCounts, MonitoredStudent, MonitoredAssignment, StudentDetail, AssignmentDetail } from "../../services/api/monitoring";

export function CountSummary({ counts, results, denominator }: { counts: Counts; results: ResultCounts; denominator: string }) {
  return <View style={{ gap: 8 }}>
    <Text style={s.heading}>{counts.submitted} submitted / {counts.available} {denominator}</Text>
    <Text style={s.body}>Not started: {counts.not_started} · In progress: {counts.in_progress} · Submitted: {counts.submitted}</Text>
    {!counts.available && <Text style={s.body}>No progress denominator is available in this scope.</Text>}
    <Text style={s.body}>Submitted outcomes — awaiting evaluation: {results.awaiting_evaluation}; awaiting manual review: {results.awaiting_manual_review}; withheld: {results.withheld}; released: {results.released}; not applicable: {results.not_applicable}.</Text>
    <Text style={s.body}>Finalized work counts as submitted even when incomplete or its result is withheld. These are submission counts, not mastery or academic grades.</Text>
  </View>;
}
export function ClassOverview({ row }: { row: Overview }) {
  return <View style={s.card}><Text accessibilityRole="header" style={s.heading}>{row.classroom.class_name}</Text>
    <Text style={s.body}>Grade {row.classroom.grade} · {row.classroom.language} · {row.eligible_students} current eligible students · {row.available_assignments} available published assignments</Text>
    <CountSummary counts={row.counts} results={row.results} denominator="student-assignment opportunities" />
    <Text style={s.body}>As of {new Date(row.as_of).toLocaleString()}. Membership and publications can change the denominator.</Text>
  </View>;
}
export function StudentSummary({ row }: { row: MonitoredStudent }) {
  return <View style={s.card}><Text accessibilityRole="header" style={s.heading}>{row.username}</Text><CountSummary counts={row.counts} results={row.results} denominator="available assignments" /></View>;
}
export function AssignmentSummary({ row }: { row: MonitoredAssignment }) {
  const mean = row.mean;
  return <View style={s.card}><Text accessibilityRole="header" style={s.heading}>{row.title}</Text>
    <Text style={s.body}>Lesson: {row.context.lesson_name} · Subject: {row.context.subject_name} · Edition: {row.context.curriculum_name}</Text>
    <Text style={s.body}>Published {new Date(row.published_at).toLocaleString()}. Pinned assignment version: {row.version_id}</Text>
    <CountSummary counts={row.counts} results={row.results} denominator="current eligible students" />
    <Text style={s.heading}>{mean.status === "available" ? `Mean released objective points: ${mean.mean_points} / ${mean.max_points}` : mean.status === "not_comparable" ? "Released results are not comparable" : "No comparable released objective mean available"}</Text>
    <Text style={s.body}>Eligible released objective results: {mean.eligible_results} / {row.counts.available} current students. Missing, pending, withheld, review-required and not-applicable outcomes are excluded.</Text>
    {mean.status === "available" && <Text style={s.body}>Engine: {mean.engine_version} · Policy: {mean.policy_version}. Rounded once to two decimal places, half up. This mean covers this assignment version only.</Text>}
  </View>;
}
const open = (classId: string, extra: { studentId?: string; assignmentId?: string } = {}) => router.push({ pathname: "/instructor-monitoring", params: { classId, ...extra } });
const review = (assignmentId: string, attemptId: string) => router.push({ pathname: "/assignment-results", params: { id: assignmentId, attemptId } });

export function MonitoringBrowser({ api, classId, studentId, assignmentId }: { api: MonitoringAccess; classId?: string; studentId?: string; assignmentId?: string }) {
  const [text, setText] = useState(""), [q, setQ] = useState(""), [reload, setReload] = useState(0);
  const [tab, setTab] = useState<"students" | "assignments">("students");
  const [scope, setScope] = useState<MonitoringFilters>({}), [scopeLabel, setScopeLabel] = useState("All assigned lessons and editions");
  const [kind, setKind] = useState<"lesson" | "edition" | null>(null), [status, setStatus] = useState<"all" | "not_started" | "in_progress" | "submitted">("all");
  const filters = { ...scope, q, status };
  const classes = useCallback((offset: number) => api.classes(q, offset), [api, q]);
  const overview = useCallback(async () => ({ items: [await api.overview(classId!, scope)], limit: 1, offset: 0, has_more: false }), [api, classId, scope]);
  const contexts = useCallback((offset: number) => api.contexts(classId!, kind!, offset), [api, classId, kind]);
  const students = useCallback((offset: number) => api.students(classId!, { ...scope, q }, offset), [api, classId, scope, q]);
  const assignments = useCallback((offset: number) => api.assignments(classId!, { ...scope, q }, offset), [api, classId, scope, q]);
  const student = useCallback((offset: number) => api.student(classId!, studentId!, { ...scope, q, status }, offset), [api, classId, studentId, scope, q, status]);
  const assignment = useCallback((offset: number) => api.assignment(classId!, assignmentId!, { ...scope, q, status }, offset), [api, classId, assignmentId, scope, q, status]);
  const key = JSON.stringify([classId, studentId, assignmentId, filters, tab, reload]);
  return <View style={{ gap: 16 }}>
    <Text style={s.body}>Only current eligible members of your active classes appear. Scores in monitoring are released objective results only. No rankings, research analytics or curriculum mastery are calculated.</Text>
    {classId && <Button label="Choose another monitored class" secondary onPress={() => router.push("/instructor-monitoring")} />}
    {(studentId || assignmentId) && <Button label="Back to class monitoring" secondary onPress={() => open(classId!)} />}
    <Input accessibilityLabel={classId ? assignmentId || (!studentId && tab === "students") ? "Search student usernames" : "Search assignment titles" : "Search owned class names"} maxLength={200} value={text} onChangeText={setText} autoCorrect={false} />
    <Button label="Apply monitoring search" onPress={() => { setQ(text); setReload(value => value + 1); }} />
    <Button label="Refresh monitoring and access" secondary onPress={() => setReload(value => value + 1)} />
    {!classId ? <Picker key={key} fetch={classes} emptyTitle="No active owned classes" emptyDescription="Create a class, or clear the class-name search."
      render={row => <Button key={row.id} label={`Monitor ${row.class_name} · Grade ${row.grade} · ${row.language}`} onPress={() => open(row.id)} />} /> : <>
      {!studentId && !assignmentId && <Picker key={`overview:${key}`} fetch={overview} render={row => <ClassOverview key={row.classroom.id} row={row} />} />}
      <Text style={s.body}>Curriculum filter: {scopeLabel}. Filtering uses the pinned lesson/edition on assignments, including retained editions; it does not measure curriculum coverage.</Text>
      <Button label="Filter by assigned lesson" secondary onPress={() => setKind("lesson")} />
      <Button label="Filter by assigned edition" secondary onPress={() => setKind("edition")} />
      <Button label="Clear curriculum filter" secondary onPress={() => { setScope({}); setScopeLabel("All assigned lessons and editions"); setKind(null); }} />
      {kind && <><Picker key={kind} fetch={contexts} emptyTitle="No assigned curriculum contexts" emptyDescription="Only pinned contexts from published assignments are available."
        render={row => <Button key={row.id} label={`Use ${row.label}`} onPress={() => { setScope(kind === "lesson" ? { lesson_id: row.id } : { curriculum_version_id: row.id }); setScopeLabel(row.label); setKind(null); }} />} /><Button label="Close curriculum filter choices" secondary onPress={() => setKind(null)} /></>}
      {(studentId || assignmentId) && <><Text style={s.heading}>Submission filter</Text><Choices values={["all", "not_started", "in_progress", "submitted"]} value={status} onChange={value => setStatus(value as typeof status)} label={value => value.replaceAll("_", " ")} />
        <Text style={s.body}>Search and submission filters affect the rows below; summary counts and means cover the full selected curriculum scope.</Text></>}
      {studentId ? <Picker key={key} fetch={student} renderHeader={page => <StudentSummary row={(page as StudentDetail).summary} />}
        emptyTitle="No assignments match" emptyDescription="Clear search, submission or curriculum filters."
        render={row => <HistoryCard key={row.id} row={row} onOpen={row.submission_status === "submitted" && row.attempt_id ? () => review(row.id, row.attempt_id!) : null} />} />
      : assignmentId ? <Picker key={key} fetch={assignment} renderHeader={page => <AssignmentSummary row={(page as AssignmentDetail).summary} />}
        emptyTitle="No current students match" emptyDescription="The roster excludes former, removed and disabled students. Try clearing filters."
        render={row => <View key={row.id} style={s.card}><Text style={s.heading}>{row.username}</Text><Text style={s.body}>Submission: {row.submission_status.replaceAll("_", " ")}</Text>
          <Text style={s.body}>{resultMessage({ state: row.result_state, submission_status: row.submission_status })}</Text>
          {row.submitted_at && <Text style={s.body}>Submitted {new Date(row.submitted_at).toLocaleString()}</Text>}
          {row.result_state === "released" && <Text style={s.heading}>Released objective points: {row.earned_points} / {row.possible_points}</Text>}
          <Button label={`View class history for ${row.username}`} secondary onPress={() => open(classId, { studentId: row.id })} />
          {row.attempt_id && row.submission_status === "submitted" && <Button label={`Review authorized result for ${row.username}`} onPress={() => review(assignmentId, row.attempt_id!)} />}
        </View>} />
      : <><Choices values={["students", "assignments"]} value={tab} onChange={value => { setTab(value as typeof tab); setText(""); setQ(""); }} label={value => value === "students" ? "Current student roster" : "Published assignments"} />
        <Text style={s.body}>Class totals cover the full selected curriculum scope, regardless of search or page.</Text>
        {tab === "students" ? <Picker key={key} fetch={students} emptyTitle="No current students match" emptyDescription="No eligible enrollment exists, or the username search has no matches."
          render={row => <View key={row.id} style={{ gap: 8 }}><StudentSummary row={row} /><Button label={`View class history for ${row.username}`} onPress={() => open(classId, { studentId: row.id })} /></View>} />
          : <Picker key={key} fetch={assignments} emptyTitle="No published assignments match" emptyDescription="Drafts are private and are not counted. Clear filters or publish an eligible draft."
            render={row => <View key={row.id} style={{ gap: 8 }}><AssignmentSummary row={row} /><Button label={`Monitor assignment: ${row.title}`} onPress={() => open(classId, { assignmentId: row.id })} /></View>} />}
      </>}
      {(studentId || assignmentId) && <Text style={s.body}>Opening a submitted result uses the existing separately authorized instructor review and release workflow. That workflow may inspect withheld evaluations; this monitoring view does not expose their scores.</Text>}
    </>}
  </View>;
}
