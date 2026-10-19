import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Badge, EmptyState, s } from "../../components/ui";
import { LoadState } from "../../components/navigation";
import { Choices } from "../../components/onboarding";
import { useSession } from "../../session/provider";
import { usePagedList } from "../dashboard/usePagedList";
import { selectedClass } from "../dashboard/paging";
import { theme } from "../../theme/tokens";

export function MyClasses() {
  const { enrollment, refreshProfile } = useSession();
  const [selection, setSelection] = useState<string | null>(null);
  const fetchPage = useCallback(
    async (offset: number) => {
      const rows = await enrollment.mine(offset);
      if (offset === 0 && rows.length === 0) await refreshProfile();
      return rows;
    },
    [enrollment, refreshProfile]
  );
  const { state, reload, more } = usePagedList(fetchPage);
  const selected = selectedClass(state, selection);

  return (
    <View style={myClassStyles.container}>
      {/* Header and Quick Actions Row */}
      <View style={myClassStyles.headerRow}>
        <View style={{ gap: 2 }}>
          <Text accessibilityRole="header" style={s.heading}>
            Your classes
          </Text>
          <Text style={s.body}>Choose a class, then open its assignments.</Text>
        </View>
        <View style={myClassStyles.actionRow}>
          <Button
            label="Join another class"
            size="sm"
            variant="primary"
            onPress={() => router.push("/class-code")}
          />
          <Button
            label="Refresh"
            size="sm"
            variant="secondary"
            disabled={state.phase === "loading"}
            onPress={reload}
          />
        </View>
      </View>

      <LoadState phase={state.phase} error={state.error} retry={reload} />

      {state.phase === "ready" && state.rows.length === 0 && (
        <EmptyState
          icon="🎒"
          title="No classes joined yet"
          description="Enter an invitation code from your instructor to join a classroom."
          action={
            <Button
              label="Enter Class Invitation Code →"
              variant="primary"
              onPress={() => router.push("/class-code")}
            />
          }
        />
      )}

      {state.phase === "ready" && selected && (
        <>
          {state.rows.length > 1 && (
            <View style={{ gap: 8 }}>
              <Text style={[s.eyebrow, { color: theme.colors.muted }]}>
                Choose a class
              </Text>
              <Choices
                values={state.rows.map((row) => row.id)}
                value={selected.id}
                onChange={setSelection}
                label={(id) => {
                  const row = state.rows.find((r) => r.id === id);
                  return row
                    ? `${row.class_name} · Grade ${row.grade_level} · ${
                        row.language === "english" ? "English" : "Tagalog"
                      }`
                    : "Class";
                }}
              />
            </View>
          )}

          {/* Active Class Card */}
          <View style={[s.card, myClassStyles.classCard]}>
            {/* Badges Row */}
            <View style={myClassStyles.badgeRow}>
              <Badge
                label={`GRADE ${selected.grade_level}`}
                variant="info"
              />
              <Badge
                label={selected.language === "english" ? "ENGLISH" : "TAGALOG"}
                variant="purple"
              />
              <Badge label="Enrollment: active" variant="success" icon="✓" />
            </View>

            <Text accessibilityRole="header" style={s.heading}>
              {selected.class_name}
            </Text>

            {/* Instructor Details Bar */}
            <View style={myClassStyles.instructorBox}>
              <Text style={myClassStyles.instructorIcon}>👨‍🏫</Text>
              <View>
                <Text style={myClassStyles.instructorLabel}>Instructor</Text>
                <Text style={myClassStyles.instructorName}>
                  {selected.instructor_display_name || "Instructor"}
                </Text>
              </View>
            </View>

            <Text style={[s.body, { fontSize: 13, color: theme.colors.subtle }]}>
              Joined on {new Date(selected.joined_at).toLocaleDateString()} • Verified School Member
            </Text>

            {/* Primary Action */}
            <Button
              label="View assignments"
              variant="primary"
              onPress={() =>
                router.push({
                  pathname: "/published-assignments",
                  params: { classId: selected.class_id },
                })
              }
            />

            {/* Secondary Actions Row */}
            <View style={myClassStyles.cardBtnGrid}>
              <Button
                label="Class messages"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() =>
                  router.push({
                    pathname: "/communication",
                    params: { classId: selected.class_id },
                  })
                }
              />
              <Button
                label="Learning history"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() =>
                  router.push({
                    pathname: "/learning-history",
                    params: { classId: selected.class_id },
                  })
                }
              />
            </View>
          </View>

          {state.hasMore && (
            <Button
              label="Load more classes"
              variant="secondary"
              onPress={more}
            />
          )}
        </>
      )}
    </View>
  );
}

const myClassStyles = StyleSheet.create({
  container: {
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  classCard: {
    gap: 14,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  instructorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.surfaceSubtle,
    padding: 12,
    borderRadius: 12,
  },
  instructorIcon: {
    fontSize: 24,
  },
  instructorLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.subtle,
    textTransform: "uppercase",
  },
  instructorName: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  cardBtnGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
});
