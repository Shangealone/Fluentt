import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { CreateClassView, type CreateClassFields } from "../features/classes/CreateClassView";
import { classFormError } from "../features/classes/state";
import type { ClassDetails } from "../services/api/classes";
import { useSession } from "../session/provider";
import { usePagedList } from "../features/dashboard/usePagedList";

const emptyFields: CreateClassFields = { class_name: "", proficiency_level: null, language: null, description: "" };

function EditClassForm({ row }: { row: ClassDetails }) {
  const { classes, profile } = useSession();
  const [fields, setFields] = useState<CreateClassFields>(() => ({
    class_name: row.class_name, proficiency_level: row.proficiency_level,
    language: row.language, description: row.description ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const scope = useRef({ active: false, generation: 0 });
  const ownerId = profile?.id;
  const role = profile?.role;
  useFocusEffect(useCallback(() => {
    const generation = ++scope.current.generation;
    scope.current.active = !!ownerId && role === "instructor";
    return () => {
      if (scope.current.generation !== generation) return;
      scope.current.active = false;
      ++scope.current.generation;
    };
  }, [ownerId, role]));
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => lock.current);
    return () => subscription.remove();
  }, []);
  function back() {
    if (!lock.current) router.replace({ pathname: "/class-details", params: { id: row.id } });
  }
  async function submit() {
    if (lock.current || !scope.current.active || role !== "instructor") return;
    const invalid = classFormError(fields.class_name, fields.proficiency_level, fields.language, fields.description);
    if (invalid) { setError(invalid); return; }
    const generation = scope.current.generation;
    const current = () => scope.current.active && scope.current.generation === generation;
    lock.current = true; setSaving(true); setError("");
    try {
      const saved = await classes.update(row.id, {
        class_name: fields.class_name.trim(), proficiency_level: fields.proficiency_level,
        language: fields.language!, description: fields.description.trim() || null,
      });
      if (current()) router.replace({ pathname: "/class-details", params: { id: saved.id } });
    } catch (failure) {
      if (current()) setError(failure instanceof Error ? failure.message : "We couldn’t save your changes. Please try again.");
    } finally {
      if (current()) { lock.current = false; setSaving(false); }
    }
  }
  return <CreateClassView mode="edit" fields={fields} operation={saving ? "save" : null} locked={false} error={error}
    onChange={value => { if (!lock.current && scope.current.active) { setFields(value); setError(""); } }}
    onSubmit={() => void submit()} onCheckClasses={back} onBack={back}
    onAccount={() => { if (!lock.current) router.push("/account"); }} />;
}

export default function ClassEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { classes, profile } = useSession();
  const classId = typeof id === "string" ? id : "";
  const fetchClass = useCallback(async () => {
    if (!classId) throw new Error("Choose a class to continue.");
    return [await classes.get(classId)];
  }, [classes, classId]);
  const { state, reload } = usePagedList(fetchClass);
  const row = state.phase === "ready" ? state.rows[0] : null;
  if (profile?.role !== "instructor") return null;
  if (row) return <EditClassForm key={`${profile.id}:${row.id}:${row.updated_at}`} row={row} />;
  return <CreateClassView mode="edit" phase={state.phase === "loading" ? "loading" : "error"}
    fields={emptyFields} operation={null} locked={false} error={state.error ?? "Choose a class and try again."}
    onChange={() => {}} onSubmit={() => {}} onCheckClasses={() => {}} onRetry={reload}
    onBack={() => classId ? router.replace({ pathname: "/class-details", params: { id: classId } }) : router.replace("/instructor")}
    onAccount={() => router.push("/account")} />;
}
