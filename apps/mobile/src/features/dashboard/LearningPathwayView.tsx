import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Button, EmptyState, s } from "../../components/ui";
import { LoadState } from "../../components/navigation";
import { theme } from "../../theme/tokens";
import type { LearningPathway, PathwayAccess, EligibleActivity } from "../../services/api/pathways";

export function PathwayOverview({ api, classId }: { api: PathwayAccess; classId?: string }) {
  const [state, setState] = useState<{ phase: "loading" | "ready" | "error"; pathway: LearningPathway | null; error: string | null }>({
    phase: "loading",
    pathway: null,
    error: null,
  });

  const load = useCallback(() => {
    setState({ phase: "loading", pathway: null, error: null });
    api
      .pathway(classId)
      .then((data) => setState({ phase: "ready", pathway: data, error: null }))
      .catch((err) => setState({ phase: "error", pathway: null, error: err instanceof Error ? err.message : "Unable to load pathway." }));
  }, [api, classId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        .pathway(classId)
        .then((data) => {
          if (active) setState({ phase: "ready", pathway: data, error: null });
        })
        .catch((err) => {
          if (active) setState({ phase: "error", pathway: null, error: err instanceof Error ? err.message : "Unable to load pathway." });
        });
      return () => {
        active = false;
        setState({ phase: "loading", pathway: null, error: null });
      };
    }, [api, classId])
  );

  return (
    <View style={{ gap: 14 }}>
      <LoadState phase={state.phase} error={state.error} retry={load} />
      {state.phase === "ready" && state.pathway && <PathwayContent pathway={state.pathway} onRefresh={load} />}
    </View>
  );
}

function PathwayContent({ pathway, onRefresh }: { pathway: LearningPathway; onRefresh: () => void }) {
  if (pathway.availability === "empty" || (!pathway.current_position && pathway.eligible_activities.length === 0)) {
    return (
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>
          Personal Learning Pathway
        </Text>
        <EmptyState
          title="Pathway preparing"
          description="Content is being prepared for your curriculum scope. Ensure your class or grade selection is active."
        />
        <Button secondary label="Refresh pathway" onPress={onRefresh} />
      </View>
    );
  }

  const pos = pathway.current_position;

  return (
    <View style={s.card}>
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" style={s.heading}>
          Personal Learning Pathway
        </Text>
        <Text style={styles.badge}>
          {pathway.student_role === "school_student" ? "Classroom Scope" : "Self-Study Scope"}
        </Text>
      </View>

      {pos && (
        <View style={styles.positionBox}>
          <Text style={styles.positionTitle}>Current Position</Text>
          <Text style={styles.positionSubtitle}>
            {pos.topic_name ? `${pos.topic_name} · ` : ""}
            {pos.lesson_name ?? "Next Lesson"}
          </Text>
          {pos.subject_name && (
            <Text style={styles.metaText}>
              {pos.subject_name} {pos.grade_number ? `(Grade ${pos.grade_number})` : ""}
            </Text>
          )}
          {pos.total_lessons_in_topic > 0 && (
            <Text style={styles.progressText}>
              Lesson {pos.position_index} of {pos.total_lessons_in_topic} in this unit
            </Text>
          )}
        </View>
      )}

      {pathway.recommendations.length > 0 && (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text style={s.subheading}>Recommended Next Actions</Text>
          {pathway.recommendations.map((rec) => (
            <View key={rec.id} style={styles.recCard}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.recTitle}>{rec.title}</Text>
                <Text style={styles.recReason}>{rec.reason}</Text>
              </View>
              {rec.is_required ? (
                <Text style={styles.requiredTag}>Required</Text>
              ) : (
                <Text style={styles.optionalTag}>Optional Practice</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {pathway.eligible_activities.length > 0 && (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text style={s.subheading}>Upcoming Curriculum Activities</Text>
          {pathway.eligible_activities.map((act) => (
            <ActivityRow key={act.id} activity={act} />
          ))}
        </View>
      )}

      {pathway.completed_milestones.length > 0 && (
        <View style={{ gap: 6, marginTop: 4 }}>
          <Text style={s.subheading}>Completed Milestones ({pathway.completed_milestones.length})</Text>
          {pathway.completed_milestones.map((m) => (
            <View key={m.id} style={styles.milestoneRow}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.milestoneTitle}>{m.title}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[s.body, { fontSize: 11, color: theme.colors.muted, marginTop: 4 }]}>
        Deterministic curriculum progression (deterministic-curriculum-v1). No predictive ML or automated grade extrapolation. Checked {new Date(pathway.as_of).toLocaleTimeString()}.
      </Text>

      <Button secondary label="Refresh pathway" onPress={onRefresh} />
    </View>
  );
}

function ActivityRow({ activity }: { activity: EligibleActivity }) {
  const isLocked = activity.status === "locked";
  const isInProgress = activity.status === "in_progress";
  const isCompleted = activity.status === "completed";

  return (
    <View style={[styles.activityRow, isLocked && styles.activityLocked]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.activityTitle, isLocked && { color: theme.colors.muted }]}>
          {activity.position}. {activity.title}
        </Text>
        <Text style={styles.activityMeta}>
          {activity.activity_type === "assignment"
            ? "Classroom Assignment"
            : activity.activity_type === "flashcard_practice"
            ? "Flashcard Vocabulary"
            : "Lesson"}
          {activity.prerequisites.total_required > 0 &&
            ` · Prereqs: ${activity.prerequisites.fulfilled}/${activity.prerequisites.total_required}`}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {isCompleted ? (
          <Text style={styles.statusCompleted}>Completed</Text>
        ) : isInProgress ? (
          <Text style={styles.statusInProgress}>In Progress</Text>
        ) : isLocked ? (
          <Text style={styles.statusLocked}>Locked</Text>
        ) : (
          <Text style={styles.statusAvailable}>Available</Text>
        )}
        {activity.lesson_id && !isLocked && (
          <Button
            size="sm"
            variant="ghost"
            label="Materials 📖"
            onPress={() =>
              router.push({
                pathname: "/learning-materials",
                params: { lessonId: activity.lesson_id! },
              })
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  positionBox: {
    backgroundColor: "#F4F6FB",
    padding: 12,
    borderRadius: 10,
    gap: 3,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  positionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.subtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  positionSubtitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  metaText: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.primary,
    marginTop: 2,
  },
  recCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  recTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  recReason: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  requiredTag: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B42318",
    backgroundColor: "#FEF3F2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  optionalTag: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF0F7",
  },
  activityLocked: {
    opacity: 0.6,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  activityMeta: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  statusAvailable: {
    fontSize: 11,
    fontWeight: "700",
    color: "#027A48",
  },
  statusInProgress: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B54708",
  },
  statusCompleted: {
    fontSize: 11,
    fontWeight: "700",
    color: "#027A48",
  },
  statusLocked: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.subtle,
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkIcon: {
    fontSize: 12,
    fontWeight: "800",
    color: "#027A48",
  },
  milestoneTitle: {
    fontSize: 13,
    color: theme.colors.ink,
  },
});
