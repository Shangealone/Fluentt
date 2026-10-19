import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen, Button, Badge, s } from "../components/ui";
import { AppHeader, LoadState } from "../components/navigation";
import { CodeCard } from "../features/classes/CodeCard";
import { useSession } from "../session/provider";
import { usePagedList } from "../features/dashboard/usePagedList";
import { theme } from "../theme/tokens";

export default function ClassDetail() {
  const { id, created } = useLocalSearchParams<{ id?: string; created?: string }>();
  const { classes } = useSession();
  const classId = id || "demo-class-1";
  const fetchClass = useCallback(async () => {
    return [await classes.get(classId)];
  }, [classes, classId]);
  const { state, reload } = usePagedList(fetchClass);

  const row = state.phase === "ready" ? state.rows[0] : null;

  return (
    <Screen>
      <AppHeader
        title={row?.class_name ?? "Class Details"}
        subtitle="CLASSROOM MANAGEMENT"
        back
      />

      <LoadState phase={state.phase} error={state.error} retry={reload} />

      {row && (
        <View style={{ gap: 18 }}>
          {created === "1" && (
            <View style={detailStyles.successBanner}>
              <Text style={detailStyles.successIcon}>✓</Text>
              <Text style={detailStyles.successText}>
                Class created successfully! Share the invitation code below with students.
              </Text>
            </View>
          )}

          {/* Overview Card */}
          <View style={[s.card, detailStyles.overviewCard]}>
            <View style={detailStyles.badgeRow}>
              <Badge label={`GRADE ${row.grade_level}`} variant="info" />
              <Badge
                label={row.language === "english" ? "ENGLISH" : "TAGALOG"}
                variant="purple"
              />
              <Badge
                label={row.status.toUpperCase()}
                variant={row.status === "active" ? "success" : "neutral"}
                icon={row.status === "active" ? "●" : "○"}
              />
            </View>

            <Text style={s.heading}>{row.class_name}</Text>

            {!!row.description && (
              <Text style={[s.body, detailStyles.descText]}>
                {row.description}
              </Text>
            )}

            <Text style={[s.body, { fontSize: 13, color: theme.colors.subtle }]}>
              Created on {new Date(row.created_at).toLocaleDateString()} • Verified Classroom
            </Text>
          </View>

          {/* Invitation Code */}
          <CodeCard code={row.join_code} name={row.class_name} />

          {/* Module Action Cards */}
          <View style={detailStyles.modulesSection}>
            <Text style={[s.eyebrow, { color: theme.colors.muted }]}>
              CLASSROOM MODULES & ACTIONS
            </Text>

            {/* Assignments Module */}
            <View style={[s.card, detailStyles.moduleCard]}>
              <View style={detailStyles.moduleHeader}>
                <Text style={detailStyles.moduleIcon}>📝</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.subheading}>Assignment Drafts & Publication</Text>
                  <Text style={[s.body, { fontSize: 13 }]}>
                    Author 10-method items, bind lesson contexts, and publish distributions.
                  </Text>
                </View>
              </View>
              <Button
                label="Manage Assignments & Drafts →"
                variant="primary"
                onPress={() =>
                  router.push({
                    pathname: "/assignments",
                    params: { classId: row.id },
                  })
                }
              />
            </View>

            {/* Monitoring Module */}
            <View style={[s.card, detailStyles.moduleCard]}>
              <View style={detailStyles.moduleHeader}>
                <Text style={detailStyles.moduleIcon}>📊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.subheading}>Progress & Score Monitoring</Text>
                  <Text style={[s.body, { fontSize: 13 }]}>
                    Track active students, submission rates, and released objective results.
                  </Text>
                </View>
              </View>
              <Button
                label="Open Class Monitoring"
                variant="secondary"
                disabled={row.status !== "active"}
                onPress={() =>
                  router.push({
                    pathname: "/instructor-monitoring",
                    params: { classId: row.id },
                  })
                }
              />
            </View>

            {/* Communication Module */}
            <View style={[s.card, detailStyles.moduleCard]}>
              <View style={detailStyles.moduleHeader}>
                <Text style={detailStyles.moduleIcon}>💬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.subheading}>Classroom Communications</Text>
                  <Text style={[s.body, { fontSize: 13 }]}>
                    Broadcast announcements and reply to learner direct messages.
                  </Text>
                </View>
              </View>
              <Button
                label="Open Class Communication"
                variant="secondary"
                disabled={row.status !== "active"}
                onPress={() =>
                  router.push({
                    pathname: "/communication",
                    params: { classId: row.id },
                  })
                }
              />
            </View>

            {/* Settings */}
            <Button
              label="⚙️ Edit Classroom Settings"
              variant="outline"
              disabled={row.status !== "active"}
              onPress={() =>
                router.push({
                  pathname: "/class-edit",
                  params: { id: row.id },
                })
              }
            />
          </View>

          <Text style={[s.body, { fontSize: 13, color: theme.colors.subtle }]}>
            Students can enroll using your invitation code. Assignment drafts remain private.
            Published items and submission progress are available in monitoring.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const detailStyles = StyleSheet.create({
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.successLight,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 14,
    padding: 14,
  },
  successIcon: {
    fontSize: 18,
    color: "#065F46",
    fontWeight: "800",
  },
  successText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#065F46",
    flex: 1,
  },
  overviewCard: {
    gap: 12,
    borderTopWidth: 4,
    borderTopColor: theme.colors.primary,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  descText: {
    backgroundColor: theme.colors.surfaceSubtle,
    padding: 12,
    borderRadius: 10,
  },
  modulesSection: {
    gap: 12,
    marginTop: 6,
  },
  moduleCard: {
    gap: 14,
  },
  moduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  moduleIcon: {
    fontSize: 28,
  },
});
