import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useSession } from "../../session/provider";
import type { Language } from "../../services/api/identity";
import { experienceForLevel, languageBackTarget, levelFromExperience, type SetupChoiceValue, type StartingLevel } from "./preferences";
import { PersonalSetupView } from "./PersonalSetupView";

export function PersonalSetup({ step }: { step: 1 | 2 }) {
  const { profile } = useSession();
  if (profile?.role !== "personal_student") return null;
  return <PersonalSetupEditor key={`${profile.id}-${step}`} step={step} />;
}

function PersonalSetupEditor({ step }: { step: 1 | 2 }) {
  const session = useSession();
  const savedLanguage = session.profile?.language ?? null;
  const savedExperience = session.profile?.experience ?? null;
  const [language, setLanguage] = useState<Language | null>(savedLanguage);
  const [level, setLevel] = useState<StartingLevel | null>(() => levelFromExperience(savedExperience));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showExit, setShowExit] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  const focused = useRef(false);
  const generation = useRef(0);
  const backHandler = useRef<() => void>(() => {});
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (step === 1) setLanguage(savedLanguage);
    else setLevel(levelFromExperience(savedExperience));
  }, [step, savedLanguage, savedExperience]);
  const goBack = useCallback(() => {
    if (saving.current) return;
    if (showExit) { setShowExit(false); return; }
    if (step === 2) { router.replace("/language"); return; }
    const target = languageBackTarget(savedLanguage, savedExperience);
    if (target) router.replace(target);
    else setShowExit(true);
  }, [step, showExit, savedLanguage, savedExperience]);
  useEffect(() => { backHandler.current = goBack; }, [goBack]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    const back = BackHandler.addEventListener("hardwareBackPress", () => { backHandler.current(); return true; });
    return () => { focused.current = false; generation.current++; back.remove(); };
  }, []));
  function choose(value: SetupChoiceValue) {
    if (saving.current || showExit) return;
    if (step === 1 && (value === "english" || value === "tagalog")) setLanguage(value);
    if (step === 2 && (value === "easy" || value === "medium" || value === "hard")) setLevel(value);
    setError("");
  }
  async function save() {
    if (saving.current || !focused.current || showExit || (step === 1 ? !language : !level || !savedLanguage)) return;
    saving.current = true;
    const current = generation.current;
    setBusy(true); setError("");
    try {
      if (step === 1) await session.save({ language: language! });
      else await session.save({ language: savedLanguage!, experience: experienceForLevel(level!, savedExperience) });
      if (mounted.current && focused.current && current === generation.current) router.replace(step === 1 ? "/experience" : "/student");
    } catch (failure) {
      if (mounted.current && focused.current && current === generation.current) {
        const status = (failure as { status?: number } | null)?.status;
        setError(status === 429 ? "You’ve tried a few times. Wait a moment and try again."
          : status === 401 ? "Please sign in again to continue."
          : "We couldn’t save your choice. Check your connection and try again.");
      }
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  if (step === 2 && !savedLanguage) return <Redirect href="/language" />;
  return <PersonalSetupView step={step} language={step === 1 ? language : savedLanguage} value={step === 1 ? language : level}
    busy={busy} error={error} showExit={showExit} onSelect={choose} onSave={() => void save()} onBack={goBack}
    onAccount={() => { if (!saving.current && !showExit) router.push("/account"); }}
    onStay={() => setShowExit(false)} onSignOut={() => { if (showExit && !saving.current) session.logout(); }} />;
}
