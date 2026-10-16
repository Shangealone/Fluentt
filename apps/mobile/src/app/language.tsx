import { useState, useRef } from "react";
import { Text } from "react-native";
import { Screen, Button, ErrorMessage, s } from "../components/ui";
import { Choices, languages } from "../components/onboarding";
import { useSession } from "../session/provider";
import type { Language } from "../services/api/identity";
export default function Preference() {
  const session = useSession();
  const [value, setValue] = useState<Language | null>(
    session.profile?.language ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function save() {
    if (lock.current || value === null) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await session.save({ language: value });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please retry.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Text style={s.brand}>FLUENTT</Text>
      <Text style={s.eyebrow}>PERSONAL SETUP · 2 OF 2</Text>
      <Text style={s.title}>Choose Your Learning Language</Text>
      <Text style={s.body}>Which language would you like to practice?</Text>
      <Choices
        values={languages}
        value={value}
        onChange={setValue}
        label={(item) => (item === "english" ? "English" : "Tagalog")}
      />
      {error && <ErrorMessage message={error} />}
      <Button
        label={busy ? "Saving…" : "Save and continue"}
        disabled={busy || value === null}
        onPress={() => void save()}
      />
    </Screen>
  );
}
