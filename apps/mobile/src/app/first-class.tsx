import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import { ClassSubmission, classFormError } from "../features/classes/state";
import { CreateClassView, type CreateClassFields } from "../features/classes/CreateClassView";
import { useSession } from "../session/provider";

const emptyFields = (): CreateClassFields => ({ class_name: "", grade_level: null, language: null, description: "" });
export default function FirstClass() {
  const session = useSession();
  const [fields, setFields] = useState(emptyFields);
  const [operation, setOperation] = useState<"save" | "check" | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const submission = useRef(new ClassSubmission());
  const busy = useRef<"save" | "check" | null>(null);
  const scope = useRef({ active: false, generation: 0 });
  const ownerId = session.profile?.id;
  const role = session.profile?.role;
  useFocusEffect(useCallback(() => {
    const generation = ++scope.current.generation;
    scope.current.active = !!ownerId && role === "instructor";
    return () => {
      if (scope.current.generation !== generation) return;
      scope.current.active = false;
      ++scope.current.generation;
      submission.current = new ClassSubmission();
      busy.current = null;
      setFields(emptyFields()); setOperation(null); setLocked(false); setError("");
    };
  }, [ownerId, role]));
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => busy.current !== null);
    return () => listener.remove();
  }, []);
  async function submit() {
    if (!scope.current.active || busy.current || session.profile?.role !== "instructor") return;
    const invalid = classFormError(fields.class_name, fields.grade_level, fields.language, fields.description);
    if (invalid) { setError(invalid); return; }
    const generation = scope.current.generation;
    const current = () => scope.current.active && scope.current.generation === generation;
    const request = submission.current;
    busy.current = "save"; setOperation("save"); setError("");
    try {
      const row = await request.submit({
        class_name: fields.class_name.trim(), grade_level: fields.grade_level!,
        language: fields.language!, description: fields.description.trim() || null,
      }, session.classes.create, randomUUID);
      if (current()) router.replace({ pathname: "/class-details", params: { id: row.id, created: "1" } });
    } catch (failure) {
      if (current()) setError(failure instanceof Error ? failure.message : "We couldn’t save your class. Please try again.");
    } finally {
      if (current()) { setLocked(request.pending !== null); busy.current = null; setOperation(null); }
    }
  }
  async function checkClasses() {
    if (!scope.current.active || busy.current || session.profile?.role !== "instructor") return;
    const generation = scope.current.generation;
    const current = () => scope.current.active && scope.current.generation === generation;
    busy.current = "check"; setOperation("check"); setError("");
    try {
      const profile = await session.refreshProfile();
      if (!current()) return;
      if (profile?.role === "instructor" && profile.profile_status === "active") router.replace("/instructor");
      else setError("No saved class yet. Complete the details or try saving again.");
    } catch (failure) {
      if (current()) setError(failure instanceof Error ? failure.message : "We couldn’t check your classes. Please try again.");
    } finally {
      if (current()) { busy.current = null; setOperation(null); }
    }
  }
  if (session.profile?.role !== "instructor") return null;
  return <CreateClassView fields={fields} operation={operation} locked={locked} error={error}
    onChange={value => { if (!busy.current && !locked && scope.current.active) { setFields(value); setError(""); } }}
    onSubmit={submit} onCheckClasses={checkClasses}
    onBack={() => { if (!busy.current) router.replace("/instructor"); }}
    onAccount={() => { if (!busy.current) router.push("/account"); }} />;
}
