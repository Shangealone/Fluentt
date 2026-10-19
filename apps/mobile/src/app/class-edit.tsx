import { useCallback, useEffect, useState, useRef } from "react";
import { BackHandler, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen, s } from "../components/ui";
import { AppHeader, LoadState } from "../components/navigation";
import { ClassForm } from "../features/classes/ClassForm";
import { useSession } from "../session/provider";
import { usePagedList } from "../features/dashboard/usePagedList";

export default function ClassEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { classes } = useSession();
  const classId = id || "demo-class-1";
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const fetchClass = useCallback(async () => {
    return [await classes.get(classId)];
  }, [classes, classId]);
  const { state, reload } = usePagedList(fetchClass);

  const row = state.phase === "ready" ? state.rows[0] : null;
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => lock.current);
    return () => subscription.remove();
  }, []);
  return <Screen backDisabled={saving}>
    <AppHeader title="Edit your class" back disabled={saving} />
    <Text style={s.body}>Renaming keeps the invitation code. Grade and language can change only before a subject, membership or learning activity is attached.</Text>
    <LoadState phase={state.phase} error={state.error} retry={reload} />
    {row && <ClassForm key={row.id + row.updated_at} initial={row} label="Save Changes" onSubmit={async (draft) => {
      lock.current = true; setSaving(true);
      try {
        await classes.update(row.id, draft);
        router.replace({ pathname: "/class-details", params: { id: row.id } });
      } finally { lock.current = false; setSaving(false); }
    }} />}
  </Screen>;
}
