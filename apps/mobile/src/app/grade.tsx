import { useState, useRef } from "react";
import { Text } from "react-native";
import { Screen, Button, ErrorMessage, s } from "../components/ui";
import { Choices, grades } from "../components/onboarding";
import { useSession } from "../session/provider";
export default function Preference() {
  const session = useSession();
  const [value, setValue] = useState<number | null>(
    session.profile?.grade ?? null,
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
      await session.save({ grade: value });
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
      <Text style={s.eyebrow}>PERSONAL SETUP · 1 OF 2</Text>
      <Text style={s.title}>Choose Your Learning Level</Text>
      <Text style={s.body}>
        Choose the grade that matches your learning level.
      </Text>
      <Choices
        values={grades}
        value={value}
        onChange={setValue}
        label={(item) => `Grade ${item}`}
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
