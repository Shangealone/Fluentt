import { useState, useRef } from "react";
import { Text, View, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Button, ErrorMessage, s } from "../../components/ui";
import { copyClassCode, shareClassCode } from "./state";
export function CodeCard({
  code,
  name,
}: {
  code: string | null;
  name: string;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function act(action: () => Promise<string>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setMessage(await action());
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "This action is unavailable on your device.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>CLASS INVITATION CODE</Text>
      {code ? (
        <>
          <Text
            selectable
            accessibilityLabel={`Class code ${code.split("").join(" ")}`}
            style={[s.title, { letterSpacing: 7 }]}
          >
            {code}
          </Text>
          <Text style={s.body}>
            Share this six-digit code with your students. They enter it after
            creating their FLUENTT username. Share only with intended students.
          </Text>
          <Button
            label="Copy Code"
            disabled={busy}
            onPress={() =>
              void act(() => copyClassCode(code, Clipboard.setStringAsync))
            }
          />
          <Button
            secondary
            label="Share Code"
            disabled={busy}
            onPress={() =>
              void act(() =>
                shareClassCode(
                  code,
                  name,
                  async (message) =>
                    (await Share.share({ message })).action ===
                    Share.sharedAction,
                ),
              )
            }
          />
        </>
      ) : (
        <Text style={s.body}>
          No active invitation code is available for this class.
        </Text>
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={s.body}>
          {message}
        </Text>
      )}
      {!!error && <ErrorMessage message={error} />}
    </View>
  );
}
