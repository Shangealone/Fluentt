import { AssessedProficiency } from "./AssessedProficiency";
import { classProficiencyLabel } from "../../services/api/classProficiency";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { Text, TextInput, useWindowDimensions } from "../../accessibility/Primitives";

import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";
import type { MonitoringAccess, MonitoringFilters, Overview, Counts, ResultCounts, MonitoredStudent, MonitoredAssignment, StudentDetail, AssignmentDetail, StudentOutcome } from "../../services/api/monitoring";
import type { HistoryItem, SubmissionStatus } from "../../services/api/progress";
import { MonitoringPage } from "./MonitoringPage";
import { AboutNumbers, Action, AssignmentMean, CountsRow, Hero, ResultStatus, Updated, classroomArt, m, submissionLabels } from "./MonitoringUI";

type MonitoringScope = Pick<MonitoringFilters, "lesson_id" | "curriculum_version_id">;
type MonitoringRouteScope = MonitoringScope & { scopeLabel?: string };
const open = (classId: string, extra: { studentId?: string; assignmentId?: string } & MonitoringRouteScope = {}) => router.push({ pathname: "/instructor-monitoring", params: { classId, ...extra } });
const review = (assignmentId: string, attemptId: string) => router.push({ pathname: "/assignment-results", params: { id: assignmentId, attemptId } });

export function CountSummary({ counts, results, denominator, unit = "class" }: { counts: Counts; results: ResultCounts; denominator: string; unit?: "class" | "student" | "assignment" }) {
  return <><CountsRow counts={counts} /><Text style={[m.note, m.noteSpace]}>{counts.available ? `${counts.submitted} submitted out of ${counts.available} ${denominator}.` : `No available ${denominator} yet.`}</Text><AboutNumbers counts={counts} results={results} unit={unit} /></>;
}

export function ClassOverview({ row }: { row: Overview }) {
  return <View style={[m.card, m.summary]}>
    <View style={m.titleRow}><Text style={m.kicker}>At a glance</Text><Text style={m.note}>{row.classroom.language === "tagalog" ? "Tagalog" : "English"} · {classProficiencyLabel(row.classroom.proficiency_level)}</Text></View>
    <View style={m.totals}><View style={m.total}><Text style={m.totalValue}>{row.eligible_students}</Text><Text style={m.totalLabel}>Current students</Text></View><View style={[m.total, m.secondTotal]}><Text style={m.totalValue}>{row.available_assignments}</Text><Text style={m.totalLabel}>Published assignments</Text></View></View>
    <CountSummary counts={row.counts} results={row.results} denominator="student–assignment combinations" />
  </View>;
}

export function StudentSummary({ row }: { row: MonitoredStudent }) {
  return <View style={[m.card, m.summary]}><View style={m.rowTop}>
    <View style={[m.tile, m.avatar]}><Text accessible={false} style={m.avatarText}>{row.username.slice(0, 1).toUpperCase()}</Text></View>
    <View style={m.rowCopy}><Text accessibilityRole="header" style={m.cardTitle}>{row.username}</Text><Text style={m.subline}>{row.counts.available} available {row.counts.available === 1 ? "assignment" : "assignments"}</Text></View>
  </View><CountSummary counts={row.counts} results={row.results} denominator="available assignments" unit="student" /></View>;
}

export function AssignmentSummary({ row, compact = false, onOpen }: { row: MonitoredAssignment; compact?: boolean; onOpen?: () => void }) {
  return <View style={[m.card, !compact && m.summary]}>
    <View style={m.rowTop}><View style={m.tile}><PersonalIcon name="assignments" size={21} color="#7863A4" /></View><View style={m.rowCopy}><Text accessibilityRole="header" style={m.cardTitle}>{row.title}</Text></View></View>
    <View style={m.lesson}><PersonalIcon name="learn" size={15} color={c.muted} /><Text style={m.lessonText}>{row.context.lesson_name}</Text></View>
    {!compact && <Text style={m.subline}>Published {new Date(row.published_at).toLocaleString()}</Text>}
    <CountsRow counts={row.counts} /><AssignmentMean row={row} />
    {!compact && <AboutNumbers counts={row.counts} results={row.results} unit="assignment">
      <Text style={m.note}>Lesson: {row.context.lesson_name}{"\n"}Subject: {row.context.subject_name}{"\n"}Edition: {row.context.curriculum_name ?? "Teacher lesson"}</Text>
      <Text style={m.note}>This average uses released objective points from this assignment version only. Missing, pending, withheld, review-required and unscored outcomes are excluded.</Text>
      {row.mean.status === "available" && <Text style={m.note}>Engine: {row.mean.engine_version}{"\n"}Policy: {row.mean.policy_version}. Rounded once to two decimal places, half up.</Text>}
    </AboutNumbers>}
    {onOpen && <View style={m.cardAction}><Action label="View assignment" icon="arrow" accessibilityLabel={`View assignment ${row.title}`} onPress={onOpen} /></View>}
  </View>;
}

function StudentCard({ row, classId, scope }: { row: MonitoredStudent; classId: string; scope: MonitoringRouteScope }) {
  return <View style={m.card}>
    <View style={m.rowTop}><View style={[m.tile, m.avatar]}><Text accessible={false} style={m.avatarText}>{row.username.slice(0, 1).toUpperCase()}</Text></View><View style={m.rowCopy}><Text accessibilityRole="header" style={m.cardTitle}>{row.username}</Text><Text style={m.subline}>{row.counts.available} available {row.counts.available === 1 ? "assignment" : "assignments"}</Text></View></View>
    <CountsRow counts={row.counts} /><View style={m.cardAction}><Action label="View history" icon="arrow" accessibilityLabel={`View history for ${row.username}`} onPress={() => open(classId, { studentId: row.id, ...scope })} /></View>
  </View>;
}

function SharedPoints({ earned, possible }: { earned: string | null; possible: string | null }) {
  return earned !== null && possible !== null ? <View style={m.mean}><Text style={m.note}>Shared objective points</Text><Text style={m.points}>{earned} / {possible}</Text></View> : <Text style={m.note}>Points are unavailable.</Text>;
}

function StudentHistoryCard({ row }: { row: HistoryItem }) {
  return <View style={m.card}>
    <View style={m.rowTop}><View style={m.tile}><PersonalIcon name="assignments" size={21} color="#7863A4" /></View><View style={m.rowCopy}><Text accessibilityRole="header" style={m.cardTitle}>{row.title}</Text></View></View>
    <View style={m.lesson}><PersonalIcon name="learn" size={15} color={c.muted} /><Text style={m.lessonText}>{row.context.lesson_name}</Text></View>
    <Text style={m.subline}>{row.context.subject_name} · {row.context.curriculum_name ?? "Teacher lesson"}</Text>
    <ResultStatus state={row.result_state} submission={row.submission_status} />
    <Text style={m.subline}>Published {new Date(row.published_at).toLocaleString()}</Text>
    {!!row.started_at && <Text style={m.subline}>Started {new Date(row.started_at).toLocaleString()}</Text>}
    {!!row.last_activity_at && <Text style={m.subline}>Last activity {new Date(row.last_activity_at).toLocaleString()}</Text>}
    {!!row.submitted_at && <Text style={m.subline}>Submitted {new Date(row.submitted_at).toLocaleString()}</Text>}
    {row.result_state === "released" && <SharedPoints earned={row.earned_points} possible={row.possible_points} />}
    {row.submission_status === "submitted" && row.attempt_id && <View style={m.cardAction}><Action label="Review result" icon="arrow" accessibilityLabel={`Review result for ${row.title}`} onPress={() => review(row.id, row.attempt_id!)} /></View>}
  </View>;
}

function OutcomeCard({ row, classId, assignmentId, scope }: { row: StudentOutcome; classId: string; assignmentId: string; scope: MonitoringRouteScope }) {
  return <View style={m.card}>
    <View style={m.rowTop}><View style={[m.tile, m.avatar]}><Text accessible={false} style={m.avatarText}>{row.username.slice(0, 1).toUpperCase()}</Text></View><View style={m.rowCopy}><Text accessibilityRole="header" style={m.cardTitle}>{row.username}</Text><Text style={m.subline}>Student submission</Text></View></View>
    <ResultStatus state={row.result_state} submission={row.submission_status} />
    {!!row.submitted_at && <Text style={m.subline}>Submitted {new Date(row.submitted_at).toLocaleString()}</Text>}
    {row.result_state === "released" && <SharedPoints earned={row.earned_points} possible={row.possible_points} />}
    <View style={m.cardAction}><Action label="View history" icon="arrow" accessibilityLabel={`View history for ${row.username}`} onPress={() => open(classId, { studentId: row.id, ...scope })} /></View>
    {row.attempt_id && row.submission_status === "submitted" && <Action label="Review result" quiet accessibilityLabel={`Review result for ${row.username}`} onPress={() => review(assignmentId, row.attempt_id!)} />}
  </View>;
}

export function MonitoringBrowser({ api, classId = "", studentId, assignmentId, scope, scopeLabel = "" }: { api: MonitoringAccess; classId?: string; studentId?: string; assignmentId?: string; scope: MonitoringScope; scopeLabel?: string }) {
  const { width, fontScale } = useWindowDimensions();
  const [text, setText] = useState(""), [q, setQ] = useState(""), [reload, setReload] = useState(0);
  const [tab, setTab] = useState<"students" | "assignments">("students");
  const [filtersOpen, setFiltersOpen] = useState(false), [kind, setKind] = useState<"lesson" | "edition" | null>(null);
  const [status, setStatus] = useState<"all" | SubmissionStatus>("all");
  const scopeActive = !!scope.lesson_id || !!scope.curriculum_version_id;
  const displayScopeLabel = scopeActive ? scopeLabel || (scope.lesson_id ? "Selected lesson" : "Selected edition") : "";
  const routeScope: MonitoringRouteScope = scopeActive ? { ...scope, scopeLabel: displayScopeLabel } : {};
  const classes = useCallback((offset: number) => api.classes(q, offset), [api, q]);
  const overview = useCallback(async () => ({ items: [await api.overview(classId, scope)], limit: 1, offset: 0, has_more: false }), [api, classId, scope]);
  const contexts = useCallback((offset: number) => api.contexts(classId, kind!, offset), [api, classId, kind]);
  const students = useCallback((offset: number) => api.students(classId, { ...scope, q }, offset), [api, classId, scope, q]);
  const assignments = useCallback((offset: number) => api.assignments(classId, { ...scope, q }, offset), [api, classId, scope, q]);
  const student = useCallback((offset: number) => api.student(classId, studentId!, { ...scope, q, status }, offset), [api, classId, studentId, scope, q, status]);
  const assignment = useCallback((offset: number) => api.assignment(classId, assignmentId!, { ...scope, q, status }, offset), [api, classId, assignmentId, scope, q, status]);
  const key = JSON.stringify([classId, studentId, assignmentId, scope, q, status, tab, reload]);
  const detail = !!studentId || !!assignmentId;
  const filtered = !!q || scopeActive || (detail && status !== "all");
  const searchLabel = !classId ? "Search classes" : assignmentId || (!studentId && tab === "students") ? "Search students" : "Search assignments";
  const clear = () => { setText(""); setQ(""); router.setParams({ lesson_id: undefined, curriculum_version_id: undefined, scopeLabel: undefined }); setStatus("all"); setKind(null); setReload(value => value + 1); };
  const submitSearch = () => { setQ(text); setReload(value => value + 1); };
  const scopeHelp = !detail && tab === "students"
    ? scopeActive
      ? `All students stay visible. Counts and history use ${displayScopeLabel}.`
      : "All students stay visible. Choose a lesson or edition to narrow counts and history."
    : `Search${detail ? " and submission filters change" : " filters"} the list. Totals cover ${studentId ? "this student’s assignments" : "the selected class"} in ${scopeActive ? "the selected lesson or edition" : "all assigned lessons and editions"}.`;
  function back() {
    if (detail && classId) router.replace({ pathname: "/instructor-monitoring", params: { classId, ...routeScope } });
    else if (classId) router.replace({ pathname: "/class-details", params: { id: classId } });
    else router.replace("/instructor");
  }
  function controls() {
    return <>
      <View style={m.search}><Text nativeID="monitoring-search-label" style={m.fieldLabel}>{searchLabel}</Text>
        <View style={[m.searchRow, fontScale > 1.2 && m.searchStack]}>
          <TextInput accessibilityLabel={searchLabel} placeholder={!classId ? "Class name" : searchLabel === "Search students" ? "Student username" : "Assignment title"} placeholderTextColor="#88958D" maxLength={200} value={text} onChangeText={setText} autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={submitSearch} style={m.input} />
          <Action label="Search" primary onPress={submitSearch} />
        </View>
      </View>
      <View style={m.toolbar}>
        {classId ? <Action label={`Filters${scopeActive || (detail && status !== "all") ? " · Active" : ""}`} icon="settings" quiet expanded={filtersOpen} onPress={() => setFiltersOpen(value => !value)} /> : <View />}
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh overview" onPress={() => setReload(value => value + 1)} style={({ pressed }) => [m.circle, pressed && m.pressed]}><PersonalIcon name="refresh" size={16} color={c.teal} /></Pressable>
      </View>
      {classId && filtersOpen && <View style={m.filters}>
        <Text style={m.fieldLabel}>Lesson or edition</Text><Text style={m.note}>{displayScopeLabel || "All assigned lessons and editions"}</Text>
        <View style={m.filterActions}><Action label="Choose lesson" outline expanded={kind === "lesson"} onPress={() => setKind(value => value === "lesson" ? null : "lesson")} /><Action label="Choose edition" outline expanded={kind === "edition"} onPress={() => setKind(value => value === "edition" ? null : "edition")} /></View>
        {kind && <View style={m.filterOptions}>
          <MonitoringPage key={kind} fetch={contexts} loadingLabel="Loading filter choices…" emptyTitle="No assigned choices yet" emptyDescription="Choices appear after assignments are published."
            render={row => <Action key={row.id} label={row.label} outline onPress={() => { router.setParams({ lesson_id: kind === "lesson" ? row.id : undefined, curriculum_version_id: kind === "edition" ? row.id : undefined, scopeLabel: row.label }); setKind(null); }} />}/>
          <Action label="Close choices" quiet onPress={() => setKind(null)} />
        </View>}
        {detail && <><Text style={m.fieldLabel}>Submission</Text><View style={m.filterActions}>
          {(["all", "not_started", "in_progress", "submitted"] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: status === value }} onPress={() => setStatus(value)} style={({ pressed }) => [m.action, status !== value && m.outline, pressed && m.pressed]}><Text style={m.actionText}>{value === "all" ? "All submissions" : submissionLabels[value]}</Text></Pressable>)}
        </View></>}
        <Action label="Clear filters" quiet onPress={clear} />
      </View>}
      {!!displayScopeLabel && <Text style={m.filterText}>Showing: {displayScopeLabel}</Text>}
      {filtered && <Action label="Clear search and filters" quiet onPress={clear} />}
      {!!classId && <Text style={[m.note, m.scopeNote]}>{scopeHelp}</Text>}
    </>;
  }
  function hero(row?: Overview) {
    if (!classId) return <Hero title="Choose a class" subtitle="A closer look at your students’ activity." />;
    return <Hero title={studentId ? "Student history" : assignmentId ? "Assignment overview" : "Class overview"} subtitle={row?.classroom.class_name}
      illustration={studentId ? "student" : assignmentId ? "assignment" : "classroom"} proficiency={row?.classroom.proficiency_level} language={row?.classroom.language} />;
  }
  function tabs() {
    return <View style={m.tabs}>
      {(["students", "assignments"] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: tab === value }} onPress={() => { setTab(value); setText(""); setQ(""); }} style={({ pressed }) => [m.tab, tab === value && m.selectedTab, fontScale > 1.2 && m.tabStack, pressed && m.pressed]}>
        <PersonalIcon name={value === "students" ? "account" : "assignments"} size={17} color={tab === value ? c.teal : c.muted} /><Text style={[m.tabText, tab === value && m.selectedTabText]}>{value === "students" ? "Students" : "Assignments"}</Text>
      </Pressable>)}
    </View>;
  }
  return <SafeAreaView style={m.screen}><ScrollView contentContainerStyle={[m.content, width < 360 && m.compact]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={m.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={detail ? "Back to class overview" : classId ? "Back to class" : "Back to classes"} onPress={back} style={({ pressed }) => [m.circle, m.back, pressed && m.pressed]}><View style={m.backIcon}><PersonalIcon name="chevron" size={19} /></View></Pressable>
      <FluenttLogo size={32} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={() => router.push("/account")} style={({ pressed }) => [m.circle, pressed && m.pressed]}><PersonalIcon name="account" size={20} /></Pressable>
    </View>
    {!classId ? <MonitoringPage key={key} fetch={classes} renderHeader={() => <>{hero()}{controls()}</>} filtered={!!q} onClear={clear} emptyTitle="Your classes will appear here" emptyDescription="Create an active class to see its overview."
      render={row => <View key={row.id} style={m.card}><View style={m.rowTop}><View style={[m.tile, m.avatar]}><Image accessible={false} source={classroomArt} resizeMode="contain" style={m.tileImage} /></View><View style={m.rowCopy}><Text accessibilityRole="header" style={m.cardTitle}>{row.class_name}</Text><Text style={m.subline}>{classProficiencyLabel(row.proficiency_level)} · {row.language === "tagalog" ? "Tagalog" : "English"}</Text></View></View><Action label="Open overview" icon="arrow" onPress={() => open(row.id)} /></View>} />
    : studentId ? <MonitoringPage<StudentDetail> key={key} fetch={student} renderHeader={page => <>{hero(page?.overview)}{page && <><StudentSummary row={page.summary} /><AssessedProficiency classId={classId} studentId={studentId} /></>}<Text accessibilityRole="header" style={[m.heading, m.sectionTitle]}>Assignments</Text>{controls()}</>}
      filtered={filtered} onClear={clear} emptyTitle="No assignments yet" emptyDescription="Published class assignments will appear here." render={row => <StudentHistoryCard key={row.id} row={row} />} renderFooter={page => <Updated value={page.overview.as_of} />} />
    : assignmentId ? <MonitoringPage<AssignmentDetail> key={key} fetch={assignment} renderHeader={page => <>{hero(page?.overview)}{page && <AssignmentSummary row={page.summary} />}<Text accessibilityRole="header" style={[m.heading, m.sectionTitle]}>Student submissions</Text>{controls()}</>}
      filtered={filtered} onClear={clear} emptyTitle="No current students" emptyDescription="Students appear here when they are eligible for this assignment." render={row => <OutcomeCard key={row.id} row={row} classId={classId} assignmentId={assignmentId} scope={routeScope} />} renderFooter={page => <Updated value={page.overview.as_of} />} />
    : <MonitoringPage key={`overview:${key}`} fetch={overview} emptyTitle="Overview unavailable" emptyDescription="Refresh to check this class again." render={() => null}
      renderHeader={page => <>{hero(page?.items[0])}{page?.items[0] && <ClassOverview row={page.items[0]} />}<Action label="Choose another class" quiet onPress={() => router.push("/instructor-monitoring")} />{tabs()}{controls()}</>}
      renderFooter={page => <>{tab === "students" ? <MonitoringPage key={key} fetch={students} filtered={filtered} onClear={clear} emptyTitle="No students yet" emptyDescription="Eligible students appear here after they join your class." render={row => <StudentCard key={row.id} row={row} classId={classId} scope={routeScope} />} />
        : <MonitoringPage key={key} fetch={assignments} filtered={filtered} onClear={clear} emptyTitle="No published assignments yet" emptyDescription="Publish an eligible class assignment to see it here." render={row => <AssignmentSummary key={row.id} row={row} compact onOpen={() => open(classId, { assignmentId: row.id, ...routeScope })} />} />}{page.items[0] && <Updated value={page.items[0].as_of} />}</>} />}
  </ScrollView></SafeAreaView>;
}
