import { useCallback } from "react";
import { useSession } from "../../session/provider";
import type { VocabularyAccess } from "../../services/api/vocabulary";
import { useLessonData } from "../teacher-lessons/useLessonData";
import { LessonNote, LessonButton } from "../teacher-lessons/LessonUI";

export function ParallelPreparationNotice() {
  const { profile, vocabulary } = useSession();
  if (!profile || !["school_student", "instructor"].includes(profile.role)) return null;
  return <Status key={profile.id} api={vocabulary} />;
}

function Status({ api }: { api: VocabularyAccess }) {
  const fetch = useCallback(() => api.parallelStatus(), [api]);
  const state = useLessonData(fetch);
  if (state.phase === "loading") return <LessonNote>Checking study availability…</LessonNote>;
  if (state.phase === "error") return <><LessonNote error>Study availability could not be checked. Ordinary class activities are separate.</LessonNote><LessonButton label="Check study availability again" onPress={state.reload} /></>;
  return <LessonNote>Parallel-group research activities are not open. Joining a class does not enroll anyone in research. Your ordinary class activities continue separately.</LessonNote>;
}
