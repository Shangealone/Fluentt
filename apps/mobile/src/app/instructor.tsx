import { Platform, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen, Button, Badge, EmptyState, s } from "../components/ui";
import { AppHeader, LoadState } from "../components/navigation";
import { useSession } from "../session/provider";
import { usePagedList } from "../features/dashboard/usePagedList";
import { theme } from "../theme/tokens";
import { LearningBanner } from "../components/LearningBanner";

export default function Instructor() {
  const { profile, classes } = useSession();
  const { state, reload, more } = usePagedList(classes.mine);

  return (
    <Screen>
      <AppHeader
        navigation
        title={`Hello, ${profile?.username ?? "Instructor"}`}
        subtitle="My teaching space"
      />

      <LearningBanner compact title="A clear space for your classes." description="Open a class to prepare assignments and review submissions. Use its invitation code to welcome students." />

      {/* Quick Action Command Grid */}
      <View style={instStyles.commandGrid}>
        <Button
          label="Create a class"
          variant="primary"
          onPress={() => router.push("/first-class")}
        />
        <Button
          label="Class monitoring"
          variant="secondary"
          onPress={() => router.push("/instructor-monitoring")}
        />
        <Button
          label="Messages"
          variant="secondary"
          onPress={() => router.push("/communication")}
        />
        <Button
          label="Refresh classes"
          variant="ghost"
          disabled={state.phase === "loading"}
          onPress={reload}
        />
      </View>

      <LoadState phase={state.phase} error={state.error} retry={reload} />

      {state.phase === "ready" && state.rows.length === 0 && (
        <EmptyState
          icon="🏫"
          title="No classes are saved yet"
          description="Create a class, invite your students, then prepare your first assignment."
          action={
            <Button
              label="Create a class"
              variant="primary"
              onPress={() => router.push("/first-class")}
            />
          }
        />
      )}

      {/* Classrooms List */}
      {state.phase === "ready" && state.rows.length > 0 && (
        <View style={{ gap: 16 }}>
          <View style={instStyles.sectionHeader}>
            <Text accessibilityRole="header" style={s.heading}>
              Your classes
            </Text>
            <Badge
              label={`${state.rows.length}${state.hasMore ? "+" : ""} shown`}
              variant="info"
            />
          </View>

          {state.rows.map((row) => (
            <View key={row.id} style={[s.card, instStyles.classCard]}>
              {/* Badges Row */}
              <View style={instStyles.badgeRow}>
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

              <Text accessibilityRole="header" style={s.heading}>
                {row.class_name}
              </Text>

              {/* Invitation Code Showcase Box */}
              <View style={instStyles.codeBox}>
                <View>
                  <Text style={instStyles.codeLabel}>Student invitation code</Text>
                  <Text selectable style={instStyles.codeValue}>
                    {row.join_code ?? "NO ACTIVE CODE"}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={instStyles.btnRow}>
                <Button
                  label="Open class"
                  variant="primary"
                  style={{ flex: 1 }}
                  onPress={() =>
                    router.push({
                      pathname: "/class-details",
                      params: { id: row.id },
                    })
                  }
                />
                {row.status === "active" && (
                  <Button
                    label="Monitor"
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: "/instructor-monitoring",
                        params: { classId: row.id },
                      })
                    }
                  />
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {state.phase === "ready" && state.hasMore && (
        <Button label="Load more classes" variant="secondary" onPress={more} />
      )}

      <Text style={[s.body, { fontSize: 13, color: theme.colors.subtle }]}>
        Students join through your 6-digit invitation code. Objective scores appear in
        monitoring only after you confirm release.
      </Text>
    </Screen>
  );
}

const instStyles = StyleSheet.create({
  commandGrid: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  classCard: {
    gap: 14,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: theme.colors.muted,
  },
  codeValue: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 4,
    color: theme.colors.ink,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  btnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
});
