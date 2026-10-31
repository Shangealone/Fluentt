import { useCallback, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SetPasswordView, type PasswordErrors } from "../features/auth/SetPasswordView";
import { useSession } from "../session/provider";
import { destination } from "../session/routing";

export default function SetPassword() {
  const { profile } = useSession();
  if (!profile || profile.has_password) return null;
  return <PasswordEditor key={profile.id} />;
}

function PasswordEditor() {
  const session = useSession();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>({ password: "", confirmation: "" });
  const lock = useRef(false), active = useRef(false), generation = useRef(0);
  useFocusEffect(useCallback(() => {
    active.current = true;
    setBusy(lock.current);
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => lock.current);
    return () => { active.current = false; generation.current += 1; subscription.remove(); };
  }, []));

  async function submit() {
    if (lock.current || !active.current) return;
    setError("");
    const validation = {
      password: Array.from(password).length < 6 || Array.from(password).length > 128 ? "Choose a password with 6–128 characters." : "",
      confirmation: password !== confirmation ? "Your passwords don’t match. Enter the same password again." : "",
    };
    setErrors(validation);
    if (validation.password || validation.confirmation) return;
    lock.current = true; setBusy(true);
    const request = generation.current;
    try {
      const profile = await session.setPassword(password);
      if (active.current && request === generation.current) {
        setPassword(""); setConfirmation("");
        router.replace(destination(profile));
      }
    } catch (cause) {
      if (active.current && request === generation.current) setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }

  return <SetPasswordView password={password} confirmation={confirmation} busy={busy} error={error} errors={errors}
    onPassword={value => { if (!lock.current) { setPassword(value); setError(""); setErrors({ password: "", confirmation: "" }); } }}
    onConfirmation={value => { if (!lock.current) { setConfirmation(value); setError(""); setErrors(current => ({ ...current, confirmation: "" })); } }}
    onSave={() => { void submit(); }} />;
}
