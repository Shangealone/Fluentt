import { useCallback, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Screen, Button } from "../components/ui";
import { AppHeader } from "../components/navigation";
import { Picker } from "../features/assignments/AssignmentEditor";
import { useSession } from "../session/provider";
import { PublishedDetails } from "../features/assignments/PublishedDetails";

export default function PublishedAssignments() {
  const { classId, id } = useLocalSearchParams<{ classId?: string; id?: string }>();
  const resolvedClassId = classId || "demo-class-1";
  const { assignments } = useSession();
  const [focused, setFocused] = useState(false), [reload, setReload] = useState(0);
  useFocusEffect(useCallback(() => { setFocused(true); setReload(value => value + 1); return () => setFocused(false); }, []));
  const fetch = useCallback(async (offset: number) => {
    if (!id) return assignments.published(resolvedClassId, offset);
    const row = await assignments.publishedDetail(id);
    return { items: [row], has_more: false, limit: 20, offset: 0 };
  }, [assignments, resolvedClassId, id]);

  return <Screen><AppHeader title={id ? "Published assignment" : "Published class assignments"} back />
    <Button label="Refresh published assignments" secondary onPress={() => setReload(value => value + 1)} />
    {focused && <Picker key={`${classId}:${id}:${reload}`} fetch={fetch}
      emptyTitle="No published assignments" emptyDescription="Your instructor has not published assignments for this class yet. Refresh to check again."
      render={row => <View key={row.id} style={{ gap: 12 }}><PublishedDetails row={row} />
        {!id && <Button label={`View assignment: ${row.title}`} onPress={() => router.push({ pathname: "/published-assignments", params: { classId, id: row.id } })} />}
        {!!id && <Button label="Start, resume or view submitted receipt" onPress={() => router.push({ pathname: "/assignment-attempt", params: { id: row.id } })} />}
        <Button label={`Results: ${row.title}`} secondary onPress={() => router.push({ pathname: "/assessment-results", params: { id: row.id } })} />
      </View>} />}
  </Screen>;
}
