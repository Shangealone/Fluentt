import { useCallback, useState } from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen, Button, EmptyState, s } from "../components/ui";
import { AppHeader, LoadState } from "../components/navigation";
import { useSession } from "../session/provider";
import { theme } from "../theme/tokens";
import type { MaterialPage, MaterialView } from "../services/api/materials";

export default function MaterialsScreen() {
  const params = useLocalSearchParams<{ lessonId?: string }>();
  const lessonId = params.lessonId ?? "demo-lesson-kuwentong-bayan";
  const { materials } = useSession();

  const [state, setState] = useState<{
    phase: "loading" | "ready" | "error";
    page: MaterialPage | null;
    error: string | null;
  }>({
    phase: "loading",
    page: null,
    error: null,
  });

  const load = useCallback(() => {
    setState({ phase: "loading", page: null, error: null });
    materials
      .getLessonMaterials(lessonId)
      .then((page) => setState({ phase: "ready", page, error: null }))
      .catch((err) =>
        setState({
          phase: "error",
          page: null,
          error: err instanceof Error ? err.message : "Unable to load learning materials.",
        })
      );
  }, [materials, lessonId]);

  useState(() => {
    load();
  });

  return (
    <Screen>
      <AppHeader
        navigation
        title="Learning Materials"
        subtitle={state.page?.lesson_name ? `Lesson: ${state.page.lesson_name}` : "Curriculum resources"}
      />

      <LoadState phase={state.phase} error={state.error} retry={load} />

      {state.phase === "ready" && state.page && (
        <>
          {state.page.items.length === 0 ? (
            <EmptyState
              icon="📖"
              title="No materials available"
              description="Materials for this lesson are being compiled or verified."
            />
          ) : (
            <View style={{ gap: 14 }}>
              {state.page.items.map((mat) => (
                <MaterialCard key={mat.id} material={mat} />
              ))}
            </View>
          )}
        </>
      )}

      <Button label="Refresh materials" secondary onPress={load} />
    </Screen>
  );
}

function MaterialCard({ material }: { material: MaterialView }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={s.card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Text accessibilityRole="header" style={[s.heading, { flex: 1 }]}>
          {material.title}
        </Text>
        <Text style={styles.badge}>
          {material.resource_type.replace("_", " ").toUpperCase()}
        </Text>
      </View>

      {material.description && <Text style={s.body}>{material.description}</Text>}

      {material.content_text && (
        <View style={styles.contentBox}>
          <Text
            style={[styles.contentText, !expanded && styles.collapsedText]}
            numberOfLines={expanded ? undefined : 4}
          >
            {material.content_text}
          </Text>
          {material.content_text.length > 150 && (
            <Button
              size="sm"
              variant="ghost"
              label={expanded ? "Show less" : "Read full text"}
              onPress={() => setExpanded(!expanded)}
            />
          )}
        </View>
      )}

      {material.is_required && (
        <Text style={styles.requiredLabel}>★ Required reading for curriculum progression</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  contentBox: {
    backgroundColor: "#F4F6FB",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  contentText: {
    fontSize: 13,
    color: theme.colors.ink,
    lineHeight: 20,
  },
  collapsedText: {
    opacity: 0.9,
  },
  requiredLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#B42318",
  },
});
