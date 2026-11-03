import { proficiencyLevels, classProficiencyLabel, type ClassProficiency } from "../../services/api/classProficiency";
import { useState, useRef } from "react";
import { Text } from "../../accessibility/Primitives";

import { Input, Button, ErrorMessage, s } from "../../components/ui";
import { Choices, languages } from "../../components/onboarding";
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
  const [proficiency, setProficiency] = useState<ClassProficiency | null>(
    initial?.proficiency_level ?? null,
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
    const invalid = classFormError(name, proficiency, language, description);
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
        proficiency_level: proficiency,
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
  function autofillDemoClass() {
    setName("Baitang 7 - Mabini");
    setProficiency(null);
    setLanguage("tagalog");
    setDescription("Seksyon Mabini para sa Filipino 7 — Panitikan ng Pilipinas at Gramatika");
    setError("");
  }

  return (
    <>
      <Button
        label="⚡ Autofill Demo Class (Baitang 7 - Mabini)"
        variant="secondary"
        disabled={busy || locked}
        onPress={autofillDemoClass}
      />
      <Text style={s.heading}>Class name</Text>
      <Input
        accessibilityLabel="Class name"
        placeholder="e.g. Mabini English A"
        maxLength={150}
        editable={!busy && !locked}
        value={name}
        onChangeText={setName}
      />
      <Text style={s.heading}>Class proficiency level (optional)</Text>
      <Text style={s.body}>Select the level assigned through your school’s assessment.</Text>
      <Choices
        values={proficiencyLevels}
        value={proficiency}
        onChange={(value) => {
          if (!busy && !locked) setProficiency(value);
        }}
        disabled={busy || locked}
        label={classProficiencyLabel}
      />
      <Button label="Clear selection" variant="secondary" disabled={busy || locked} onPress={() => setProficiency(null)} />
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
