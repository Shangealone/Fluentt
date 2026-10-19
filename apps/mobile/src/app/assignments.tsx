import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Screen, Button, s } from "../components/ui";
import { AppHeader } from "../components/navigation";
import { useSession } from "../session/provider";
import { Picker } from "../features/assignments/AssignmentEditor";

export default function AssignmentList() {
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  const resolvedClassId = classId || "demo-class-1";
  const { assignments } = useSession();
  const [reload, setReload] = useState(0);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); setReload(value => value + 1); return () => setFocused(false); }, []));
  const fetch = useCallback(async (offset: number) => {
    return assignments.list(resolvedClassId, offset);
  }, [assignments, resolvedClassId]);
  return <Screen><AppHeader title="Class assignments" back />
    <Text style={s.body}>Your owned-class drafts, archived drafts and published assignments. Only published details are available to eligible class members.</Text>
    <Button label="Reload drafts" onPress={() => setReload(value => value + 1)} />
    <Button label="Create assignment draft" onPress={() => router.push({ pathname: "/assignment-builder", params: { classId: resolvedClassId } })} />
    {focused && <Picker key={`${resolvedClassId}:${reload}`} fetch={fetch} render={row => <View key={row.id} style={s.card}>

      <Text style={s.heading}>{row.title}</Text><Text style={s.body}>{row.status} · {row.question_count} questions · {row.context.lesson_name}. Open to check current eligibility.</Text>
      <Button label={`View ${row.title}`} secondary onPress={() => router.push({ pathname: "/assignment-builder", params: { classId: row.class_id, id: row.id } })} />
      {row.status === "published" && <Button label={`Results and release: ${row.title}`} onPress={() => router.push({ pathname: "/assignment-results", params: { id: row.id } })} />}
    </View>} />}
  </Screen>;
}
