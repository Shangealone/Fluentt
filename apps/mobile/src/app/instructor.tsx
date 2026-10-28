import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, EmptyState } from "../components/ui";
import { InstructorScreen } from "../components/InstructorScreen";
import { LoadState } from "../components/navigation";
import { PersonalIcon, type PersonalIconName } from "../components/PersonalIcon";
import { useSession } from "../session/provider";
import { usePagedList } from "../features/dashboard/usePagedList";
import { pc, p } from "../theme/personal";

export default function Instructor() {
  const { profile, classes } = useSession();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const classesOnly = view === "classes";
  const { state, reload, more } = usePagedList(classes.mine);
  return <InstructorScreen>
    <View style={{ gap: 10 }}>
      <View style={p.row}><View style={p.chip}><Text style={p.chipText}>Teach with your class</Text></View><View style={[p.chip, { backgroundColor: pc.pink }]}><Text style={[p.chipText, { color: pc.rose }]}>Instructor space</Text></View></View>
      <Text accessibilityRole="header" style={p.title}>{classesOnly ? "Your classes, all in one place." : `Welcome back, ${profile?.username ?? "Instructor"}`}</Text>
      <Text style={p.body}>{classesOnly ? "Choose a class to prepare questions, invite students, and review their work." : "Your classes, your next activity, your place to guide. Take it one lesson at a time."}</Text>
    </View>
    {!classesOnly && <View style={styles.hero}>
      <Text style={[p.eyebrow, { color: "#F2D6DF" }]}>A little further, together</Text>
      <Text accessibilityRole="header" style={styles.heroTitle}>Make room for their next breakthrough.</Text>
      <Text style={styles.heroBody}>Open a class to choose questions and publish an activity. Follow your students’ work from Progress below.</Text>
      <View style={styles.methods}>{[
        { icon: "learn", label: "Class activities" }, { icon: "tutor", label: "Stay connected" }, { icon: "stats", label: "Student progress" },
      ].map(item => <View key={item.icon} style={styles.method}><PersonalIcon name={item.icon as PersonalIconName} color="#F2CBD6" /><Text style={styles.methodLabel}>{item.label}</Text></View>)}</View>
    </View>}
    <View style={p.section}>
      <View style={p.row}><Text accessibilityRole="header" style={p.heading}>Your classes</Text><Text style={p.caption}>{state.phase === "ready" ? `${state.rows.length}${state.hasMore ? "+" : ""} shown` : ""}</Text></View>
      <View style={p.grid}><Button label="Create a class" onPress={() => router.push("/first-class")} /><Button label="Refresh classes" secondary disabled={state.phase === "loading"} onPress={reload} /></View>
      <LoadState phase={state.phase} error={state.error} retry={reload} />
      {state.phase === "ready" && !state.rows.length && <EmptyState title="No classes are saved yet" description="Create a class, invite your students, then prepare your first assignment." />}
      {state.phase === "ready" && state.rows.map(row => <View key={row.id} style={p.card}>
        <View style={p.row}><View style={p.chip}><Text style={p.chipText}>Grade {row.grade_level} · {row.language === "english" ? "English" : "Tagalog"}</Text></View><View style={[p.chip, { backgroundColor: row.status === "active" ? pc.aqua : pc.soft }]}><Text style={[p.chipText, { color: row.status === "active" ? pc.teal : pc.muted }]}>{row.status === "active" ? "● Active" : row.status}</Text></View></View>
        <Text accessibilityRole="header" style={p.heading}>{row.class_name}</Text>
        <View style={p.note}><Text style={p.eyebrow}>Student invitation code</Text><Text selectable accessibilityLabel={`Invitation code ${row.join_code ?? "unavailable"}`} style={styles.code}>{row.join_code ?? "No active code"}</Text><Text style={p.caption}>Share only with students joining this class.</Text></View>
        <Button label={`Open class: ${row.class_name}`} onPress={() => router.push({ pathname: "/class-details", params: { id: row.id } })} />
      </View>)}
      {state.phase === "ready" && state.hasMore && <Button label="Load more classes" secondary onPress={more} />}
    </View>
    <View style={[p.note, { backgroundColor: pc.aqua }]}><Text style={[p.eyebrow, { color: pc.teal }]}>Guide with care</Text><Text style={p.body}>Students join through your 6-digit invitation code. Objective scores appear in monitoring only after you confirm release.</Text></View>
  </InstructorScreen>;
}
const styles = StyleSheet.create({
  hero: { backgroundColor: pc.navy, borderRadius: 18, padding: 24, gap: 19 },
  heroTitle: { color: "white", fontSize: 25, fontWeight: "600", lineHeight: 34, letterSpacing: -0.6, maxWidth: 520 },
  heroBody: { color: "#BBC4D8", fontSize: 14, lineHeight: 23, maxWidth: 560 },
  methods: { backgroundColor: "#2B3552", borderRadius: 12, padding: 15, flexDirection: "row", gap: 8 },
  method: { alignItems: "center", gap: 7, flex: 1, minWidth: 0 },
  methodLabel: { color: "white", fontSize: 11, textAlign: "center", lineHeight: 17 },
  code: { fontSize: 24, letterSpacing: 4, fontWeight: "700", color: pc.navy },
});
