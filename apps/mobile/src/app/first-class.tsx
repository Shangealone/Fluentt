import { useState, useEffect } from "react";
import { BackHandler, Text } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { Screen, Button, ErrorMessage, s } from "../components/ui";
import { ClassForm } from "../features/classes/ClassForm";
import { ClassSubmission } from "../features/classes/state";
import { useSession } from "../session/provider";
export default function FirstClass() {
  const session = useSession();
  const [submission] = useState(() => new ClassSubmission());
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    const sub = BackHandler.addEventListener(
      "hardwareBackPress",
      () => submission.busy,
    );
    return () => sub.remove();
  }, [submission]);
  return (
    <Screen>
      {session.profile?.profile_status === "active" && (
        <Button
          secondary
          label="← My Classes"
          disabled={saving}
          onPress={() => router.replace("/instructor")}
        />
      )}
      <Text style={s.brand}>FLUENTT</Text>
      <Text style={s.eyebrow}>
        INSTRUCTOR ·{" "}
        {session.profile?.profile_status === "active"
          ? "NEW CLASS"
          : "FIRST CLASS"}
      </Text>
      <Text style={s.title}>A place to learn together.</Text>
      <Text style={s.body}>
        Name your class and choose its learning level. FLUENTT will generate a
        six-digit invitation code when your class is saved.
      </Text>
      <ClassForm
        locked={locked}
        label={locked ? "Retry saving this class" : "Create Class"}
        onSubmit={async (draft) => {
          setSaving(true);
          try {
            const row = await submission.submit(
              draft,
              session.classes.create,
              randomUUID,
            );
            router.replace({
              pathname: "/class-details",
              params: { id: row.id, created: "1" },
            });
          } finally {
            setLocked(submission.pending !== null);
            setSaving(false);
          }
        }}
      />
      {locked && (
        <Text style={s.body}>
          Saving was interrupted. Retry the same details safely, or check My
          Classes to see whether the save completed. Your request ID is reused.
        </Text>
      )}
      {!!error && <ErrorMessage message={error} />}
      <Button
        secondary
        label={checking ? "Checking saved classes…" : "Check saved classes"}
        disabled={checking || saving}
        onPress={async () => {
          setChecking(true);
          setError("");
          try {
            const profile = await session.refreshProfile();
            if (profile?.profile_status === "active")
              router.replace("/instructor");
            else
              setError(
                "No saved class yet. Complete the form or retry saving.",
              );
          } catch (error) {
            setError(error instanceof Error ? error.message : "Please retry.");
          } finally {
            setChecking(false);
          }
        }}
      />
    </Screen>
  );
}
