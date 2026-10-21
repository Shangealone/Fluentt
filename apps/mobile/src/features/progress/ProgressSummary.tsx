import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Button, EmptyState, s } from "../../components/ui";
import { LoadState } from "../../components/navigation";
import type { ProgressAccess, ProgressSummary as Summary } from "../../services/api/progress";
import { p } from "../../theme/personal";

export function ProgressTotals({ row, classroomDesign = false }: { row: Summary; classroomDesign?: boolean }) {
  return <View style={[s.card, classroomDesign && p.card]}>
    <Text accessibilityRole="header" style={[s.heading, classroomDesign && p.heading]}>Your assignment summary</Text>
    {row.availability === "unavailable" ? <Text style={s.body}>Personal activity tracking is not yet available. No personal completion or mastery is inferred from preferences or browsing.</Text> : <>
      <Text style={s.body}>{row.class_name ? `Class: ${row.class_name}` : `Across ${row.class_count} currently eligible classes`}</Text>
      {!row.counts?.available ? <EmptyState title="No available assignments" description="Published assignments in your currently eligible classes will appear here." /> : <>
        <Text accessibilityLiveRegion="polite" style={s.heading}>{row.counts.submitted} submitted / {row.counts.available} available</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {[{ label: "Not started", value: row.counts.not_started }, { label: "In progress", value: row.counts.in_progress }, { label: "Pending", value: row.counts.pending }].map(item => <View key={item.label} style={{ flex: 1, minWidth: 110, backgroundColor: "#F4F6FB", borderRadius: 12, padding: 16, gap: 4 }}>
            <Text style={s.heading}>{item.value}</Text><Text style={s.body}>{item.label}</Text>
          </View>)}
        </View>
      </>}
      <Text style={s.body}>Submitted work can still have unanswered questions or unreleased results. These counts show submissions, not mastery. Available totals change when assignments or class memberships change.</Text>
    </>}
    <Text style={s.body}>Checked {new Date(row.as_of).toLocaleString()}</Text>
  </View>;
}

function ProgressRead({ api, classId, refresh, classroomDesign }: { api: ProgressAccess; classId?: string; refresh: () => void; classroomDesign: boolean }) {
  const [state, setState] = useState<{ phase: "loading" | "ready" | "error"; row: Summary | null; error: string | null }>({ phase: "loading", row: null, error: null });
  useFocusEffect(useCallback(() => {
    let active = true;
    setState({ phase: "loading", row: null, error: null });
    void api.summary(classId).then(row => { if (active) setState({ phase: "ready", row, error: null }); })
      .catch(cause => { if (active) setState({ phase: "error", row: null, error: cause instanceof Error ? cause.message : "Unable to verify progress." }); });
    return () => { active = false; setState({ phase: "loading", row: null, error: null }); };
  }, [api, classId]));
  return <View style={{ gap: 12 }}>
    <LoadState phase={state.phase} error={state.error} retry={refresh} />
    {state.phase === "ready" && state.row && <ProgressTotals row={state.row} classroomDesign={classroomDesign} />}
    <Button secondary label="Refresh submission progress" disabled={state.phase === "loading"} onPress={refresh} />
  </View>;
}

export function ProgressOverview({ api, classId, historyLink = false, classroomDesign = false }: { api: ProgressAccess; classId?: string; historyLink?: boolean; classroomDesign?: boolean }) {
  const [reload, setReload] = useState(0);
  return <View style={{ gap: 12 }}><ProgressRead key={`${classId ?? "all"}:${reload}`} api={api} classId={classId} refresh={() => setReload(value => value + 1)} classroomDesign={classroomDesign} />
    {historyLink && <Button label="Progress and learning history" onPress={() => router.push({ pathname: "/learning-history", params: classId ? { classId } : {} })} />}
  </View>;
}
