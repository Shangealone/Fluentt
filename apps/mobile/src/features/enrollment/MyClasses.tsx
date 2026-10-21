import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, EmptyState } from "../../components/ui";
import { PersonalIcon } from "../../components/PersonalIcon";
import { LoadState } from "../../components/navigation";
import { useSession } from "../../session/provider";
import { usePagedList } from "../dashboard/usePagedList";
import { selectedClass } from "../dashboard/paging";
import { pc, p } from "../../theme/personal";

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

  return <View style={p.section}>
    <View style={p.row}>
      <View style={{ gap: 4 }}><Text accessibilityRole="header" style={p.heading}>Your classes</Text><Text style={p.body}>Your next lesson starts here.</Text></View>
      <View style={styles.actions}>
        <Button label="Join another class" size="sm" secondary onPress={() => router.push("/class-code")} />
        <Button label="Refresh" size="sm" variant="ghost" textStyle={{ color: pc.muted }} disabled={state.phase === "loading"} onPress={reload} />
      </View>
    </View>
    <LoadState phase={state.phase} error={state.error} retry={reload} />
    {state.phase === "ready" && state.rows.length === 0 && <View style={p.card}>
      <EmptyState title="No classes joined yet" description="Enter an invitation code from your instructor to join a classroom."
        action={<Button label="Enter Class Invitation Code →" onPress={() => router.push("/class-code")} />} />
    </View>}
    {state.phase === "ready" && selected && <>
      {state.rows.length > 1 && <View style={{ gap: 10 }}>
        <Text style={p.eyebrow}>Choose a class</Text>
        <View style={p.grid}>{state.rows.map(row => <Pressable key={row.id} accessibilityRole="button"
          accessibilityLabel={`${row.class_name} · Grade ${row.grade_level} · ${row.language === "english" ? "English" : "Tagalog"}`}
          accessibilityState={{ selected: selected.id === row.id }} onPress={() => setSelection(row.id)}
          style={({ pressed }) => [styles.choice, selected.id === row.id && styles.selectedChoice, { opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.choiceText, selected.id === row.id && { color: pc.surface }]}>{row.class_name}</Text>
          <Text style={[p.caption, selected.id === row.id && { color: "#DDE4F1" }]}>{row.language === "english" ? "English" : "Tagalog"} · Grade {row.grade_level}</Text>
        </Pressable>)}</View>
      </View>}
      <View style={[p.card, { gap: 18 }]}>
        <View style={p.row}>
          <View style={styles.classIcon}><PersonalIcon name="learn" color={pc.teal} size={26} /></View>
          <View style={[p.chip, { backgroundColor: pc.aqua }]}><Text style={[p.chipText, { color: pc.teal }]}>Enrollment: active</Text></View>
        </View>
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={p.heading}>{selected.class_name}</Text>
          <View style={styles.actions}><View style={p.chip}><Text style={p.chipText}>{selected.language === "english" ? "English" : "Tagalog"}</Text></View><View style={p.chip}><Text style={p.chipText}>Grade {selected.grade_level}</Text></View></View>
        </View>
        <View style={styles.instructor}>
          <View style={styles.avatar}><Text style={{ color: pc.rose, fontWeight: "700" }}>{(selected.instructor_display_name || "Instructor").charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1, gap: 3 }}><Text style={p.caption}>YOUR INSTRUCTOR</Text><Text style={styles.choiceText}>{selected.instructor_display_name || "Instructor"}</Text></View>
        </View>
        <Button label="View assignments" icon="→" onPress={() => router.push({ pathname: "/published-assignments", params: { classId: selected.class_id } })} />
        <View style={p.grid}>
          <Button label="Class messages" secondary style={styles.secondary} onPress={() => router.push({ pathname: "/communication", params: { classId: selected.class_id } })} />
        </View>
        <Text style={p.caption}>Joined {new Date(selected.joined_at).toLocaleDateString()}</Text>
      </View>
      {state.hasMore && <Button label="Load more classes" secondary onPress={more} />}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  choice: { backgroundColor: pc.surface, borderColor: pc.line, borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 64, gap: 5, flexGrow: 1, flexBasis: 180 },
  selectedChoice: { backgroundColor: pc.navy, borderColor: pc.navy },
  choiceText: { fontSize: 14, fontWeight: "600", color: pc.ink },
  classIcon: { width: 50, height: 50, borderRadius: 15, backgroundColor: pc.aqua, alignItems: "center", justifyContent: "center" },
  instructor: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: pc.soft, padding: 12, borderRadius: 12 },
  avatar: { width: 38, height: 38, borderRadius: 20, backgroundColor: pc.pink, alignItems: "center", justifyContent: "center" },
  secondary: { flexGrow: 1, flexBasis: 180 },
});
