import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Text } from "../../accessibility/Primitives";
import { PersonalIcon } from "../../components/PersonalIcon";
import { useSession } from "../../session/provider";
import { homeColors as c } from "../../theme/personal";
import { h, HomeAction, HomeDisclosure, HomeReadError } from "./SchoolHomeUI";

type ReadState<T> = { phase: "loading" | "ready" | "error"; data: T | null; error: string | null };

/** Every focus/retry owns its response lifetime; protected data is discarded on blur. */
function useHomeRead<T>(read: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ReadState<T>>({ phase: "loading", data: null, error: null });
  useFocusEffect(useCallback(() => {
    let active = true;
    setState({ phase: "loading", data: null, error: null });
    void read().then(data => {
      if (active) setState({ phase: "ready", data, error: null });
    }).catch(cause => {
      if (active) setState({ phase: "error", data: null, error: cause instanceof Error ? cause.message : "Check your connection and try again." });
    });
    return () => { active = false; setState({ phase: "loading", data: null, error: null }); };
  }, [read, revision]));
  return { state, reload: () => setRevision(value => value + 1) };
}

function CardHeading({ title, refresh, busy }: { title: string; refresh: () => void; busy?: boolean }) {
  return <View style={h.row}><Text accessibilityRole="header" style={styles.label}>{title}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Refresh ${title.toLowerCase()}`} disabled={busy}
      accessibilityState={{ disabled: !!busy }} onPress={refresh} style={({ pressed }) => [styles.refresh, (pressed || busy) && h.dimmed]}>
      <PersonalIcon name="refresh" size={17} color={c.teal} />
    </Pressable>
  </View>;
}

function LearningPathCard() {
  const { pathway } = useSession();
  const read = useCallback(() => pathway.pathway(), [pathway]);
  const { state, reload } = useHomeRead(read);
  if (state.phase === "error") return <HomeReadError title="We couldn’t load your learning path" error={state.error} retry={reload} />;
  const data = state.data;
  const position = data?.current_position;
  const hasLearning = data?.availability === "available" && !!(position || data.eligible_activities.length || data.recommendations.length || data.completed_milestones.length);
  return <View style={h.card}>
    <CardHeading title="Your learning path" refresh={reload} busy={state.phase === "loading"} />
    {state.phase === "loading" && <Text accessibilityLiveRegion="polite" style={h.body}>Loading your learning path…</Text>}
    {state.phase === "ready" && data && <>
      {!hasLearning ? <Text style={h.body}>{data.availability === "unavailable" ? "Your learning path is currently unavailable." : "Your class learning will appear here when it’s available for your classes."}</Text> : <>
        {!!position && !!(position.lesson_name || position.topic_name) && <Text style={h.subheading}>{position.lesson_name || position.topic_name}</Text>}
        {!!position && !!(position.subject_name || position.grade_number) && <Text style={h.small}>
          {[position.subject_name, position.grade_number ? `Grade ${position.grade_number}` : null].filter(Boolean).join(" · ")}
        </Text>}
        <HomeDisclosure title="Learning path details">
          {!!data.class_name && <Text style={h.small}>Class: {data.class_name}</Text>}
          {!!position?.topic_name && <Text style={h.body}>Topic: {position.topic_name}</Text>}
          {!!position?.lesson_name && <Text style={h.body}>Current lesson: {position.lesson_name}</Text>}
          {!!position && position.total_lessons_in_topic > 0 && <Text style={h.small}>Lesson {position.position_index} of {position.total_lessons_in_topic} in this topic.</Text>}
          {data.recommendations.map(rec => <View key={rec.id} style={styles.detailRow}>
            <Text style={styles.detailTitle}>{rec.title}</Text><Text style={h.small}>{rec.reason}</Text>
            <Text style={h.small}>{rec.is_required ? "Required" : "Optional practice"}</Text>
          </View>)}
          {data.eligible_activities.length > 0 && <Text style={styles.label}>Class activities</Text>}
          {data.eligible_activities.map(activity => <View key={activity.id} style={styles.detailRow}>
            <Text style={styles.detailTitle}>{activity.position}. {activity.title}</Text>
            <Text style={h.small}>{({ lesson: "Lesson", assignment: "Class assignment", flashcard_practice: "Flashcard practice" })[activity.activity_type]} · {({ available: "Available", in_progress: "In progress", completed: "Completed", locked: "Locked" })[activity.status]}</Text>
            {activity.prerequisites.total_required > 0 && <Text style={h.small}>Prerequisites: {activity.prerequisites.fulfilled} of {activity.prerequisites.total_required}</Text>}
            {!!activity.lesson_id && activity.status !== "locked" && <HomeAction label="Learning materials" onPress={() => router.push({ pathname: "/learning-materials", params: { lessonId: activity.lesson_id! } })} />}
          </View>)}
          {data.completed_milestones.length > 0 && <Text style={styles.label}>Completed milestones</Text>}
          {data.completed_milestones.map(milestone => <Text key={milestone.id} style={h.body}>{milestone.title}</Text>)}
          <Text style={h.small}>Your path follows available curriculum information. It does not predict your grades or language ability.</Text>
        </HomeDisclosure>
      </>}
      <Text style={h.small}>Checked {new Date(data.as_of).toLocaleString()}</Text>
    </>}
  </View>;
}

function AssignmentSummaryCard() {
  const { progress } = useSession();
  const read = useCallback(() => progress.summary(), [progress]);
  const { state, reload } = useHomeRead(read);
  if (state.phase === "error") return <HomeReadError title="We couldn’t load your assignment summary" error={state.error} retry={reload} />;
  const data = state.data;
  const counts = data?.counts;
  return <View style={h.card}>
    <CardHeading title="Your assignment summary" refresh={reload} busy={state.phase === "loading"} />
    {state.phase === "loading" && <Text accessibilityLiveRegion="polite" style={h.body}>Loading your assignment summary…</Text>}
    {state.phase === "ready" && data && <>
      {data.availability === "unavailable" ? <Text style={h.body}>Your assignment summary is currently unavailable.</Text> : !counts?.available ?
        <Text style={h.body}>No available assignments. Your teacher’s published assignments will appear here.</Text> : <>
          <Text style={h.subheading}>{counts.submitted} submitted / {counts.available} available</Text>
          <View style={styles.counts}><Text style={h.body}><Text style={styles.count}>{counts.not_started}</Text> Not started</Text><Text style={h.body}><Text style={styles.count}>{counts.in_progress}</Text> In progress</Text></View>
          <HomeAction label="View my progress" icon="arrow" onPress={() => router.push("/learning-history")} />
        </>}
      <HomeDisclosure title="About these numbers">
        {data.availability === "available" && <Text style={h.small}>{data.class_name ? `Class: ${data.class_name}` : `Across ${data.class_count} currently eligible classes.`}</Text>}
        {counts && <Text style={h.small}>{counts.pending} assignments pending: {counts.not_started} not started and {counts.in_progress} in progress.</Text>}
        <Text style={h.small}>Submitted work can still have unanswered questions or results that haven’t been shared. These counts show submissions, not measured ability or a grade. Available totals change when assignments or class memberships change.</Text>
        <Text style={h.small}>Checked {new Date(data.as_of).toLocaleString()}</Text>
      </HomeDisclosure>
    </>}
  </View>;
}

export function SchoolHomeLearning() {
  return <View style={h.section}><Text accessibilityRole="header" style={h.heading}>Your class learning</Text><LearningPathCard /><AssignmentSummaryCard /></View>;
}

const styles = StyleSheet.create({
  label: { fontSize: 13, lineHeight: 21, fontWeight: "600", color: c.ink, flexShrink: 1 },
  refresh: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  counts: { flexDirection: "row", flexWrap: "wrap", gap: 15 }, count: { fontSize: 16, fontWeight: "600", color: c.ink },
  detailRow: { paddingVertical: 9, borderBottomWidth: 1, borderColor: c.line, gap: 5 },
  detailTitle: { fontSize: 14, lineHeight: 22, fontWeight: "600", color: c.ink },
});
