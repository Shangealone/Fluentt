import { useState, useRef } from "react";
import { Text } from "react-native";
import { Input, Button, ErrorMessage, s } from "../../components/ui";
import { Choices, grades, languages } from "../../components/onboarding";
import type { ClassDraft } from "../../services/api/classes";
import type { Language } from "../../services/api/identity";
import { classFormError } from "./state";
export function ClassForm({
  initial,
  onSubmit,
  label,
  locked = false,
}: {
  initial?: ClassDraft;
  onSubmit: (draft: ClassDraft) => Promise<void>;
  label: string;
  locked?: boolean;
}) {
  const [name, setName] = useState(initial?.class_name ?? "");
  const [grade, setGrade] = useState<number | null>(
    initial?.grade_level ?? null,
  );
  const [language, setLanguage] = useState<Language | null>(
    initial?.language ?? null,
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function submit() {
    if (lock.current) return;
    const invalid = classFormError(name, grade, language, description);
    if (invalid) {
      setError(invalid);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        class_name: name.trim(),
        grade_level: grade!,
        language: language!,
        description: description.trim() || null,
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save. Please retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Text style={s.heading}>Class name</Text>
      <Input
        accessibilityLabel="Class name"
        placeholder="e.g. Grade 5 English A"
        maxLength={150}
        editable={!busy && !locked}
        value={name}
        onChangeText={setName}
      />
      <Text style={s.heading}>Grade level</Text>
      <Choices
        values={grades}
        value={grade}
        onChange={(value) => {
          if (!busy && !locked) setGrade(value);
        }}
        disabled={busy || locked}
        label={(n) => `Grade ${n}`}
      />
      <Text style={s.heading}>Learning language</Text>
      <Choices
        values={languages}
        value={language}
        onChange={(value) => {
          if (!busy && !locked) setLanguage(value);
        }}
        disabled={busy || locked}
        label={(value) => (value === "english" ? "English" : "Tagalog")}
      />
      <Text style={s.heading}>Description (optional)</Text>
      <Input
        accessibilityLabel="Class description"
        placeholder="What will your class practice?"
        multiline
        maxLength={500}
        editable={!busy && !locked}
        value={description}
        onChangeText={setDescription}
      />
      {!!error && <ErrorMessage message={error} />}
      <Button
        label={busy ? "Saving class…" : label}
        disabled={busy}
        onPress={() => void submit()}
      />
    </>
  );
}
