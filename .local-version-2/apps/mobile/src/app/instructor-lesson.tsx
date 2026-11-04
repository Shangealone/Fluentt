import { useCallback } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useSession } from "../session/provider";
import { LessonEditor } from "../features/teacher-lessons/LessonEditor";
import { LessonButton, LessonFrame, LessonHero, LessonLoading, LessonNote } from "../features/teacher-lessons/LessonUI";
import { useLessonData } from "../features/teacher-lessons/useLessonData";

export default function InstructorLesson() {
  const { profile } = useSession();
  const params = useLocalSearchParams<{ id?: string; versionId?: string; classId?: string; step?: string; section?: string }>();
  const id = typeof params.id === "string" ? params.id : "", versionId = typeof params.versionId === "string" ? params.versionId : "", classId = typeof params.classId === "string" ? params.classId : "";
  if (profile?.role !== "instructor") return null;
  return <EditorResource key={`${profile.id}-${id}-${versionId}-${classId}`} id={id} versionId={versionId} classId={classId} initialStep={params.step === "Content" ? "Content" : params.step === "Review" ? "Review" : "Details"} section={typeof params.section === "string" && /^(-1|[0-9]|[1-4][0-9])$/.test(params.section) ? Number(params.section) : 0} />;
}
function EditorResource({ id, versionId, classId, initialStep, section }: { id: string; versionId: string; classId: string; initialStep: "Content" | "Review" | "Details"; section: number }) {
  const { teacherLessons: api, classes, profile } = useSession();
  const fetch = useCallback(async () => {
    const [row, subjects, classroom] = await Promise.all([id ? api.get(id, versionId || undefined) : Promise.resolve(null), api.subjects(), classId ? classes.get(classId) : Promise.resolve(null)]);
    return { row, subjects, classroom };
  }, [api, classes, id, versionId, classId]);
  const data = useLessonData(fetch);
  if (data.phase === "ready" && data.value) return <LessonEditor initial={data.value.row} subjects={data.value.subjects} api={api} classId={classId} classroom={data.value.classroom} initialStep={initialStep} initialSection={section} active={profile?.role === "instructor"} />;
  return <LessonFrame onBack={() => router.replace(classId ? { pathname: "/instructor-lessons", params: { classId } } : "/instructor-lessons")} onAccount={() => router.push("/account")}><LessonHero title="A little preparation" description="Make a lesson your learners can call their own." />{data.phase === "error" ? <><LessonNote error>We couldn’t open this lesson. {data.error}</LessonNote><LessonButton label="Try again" onPress={data.reload} /></> : <LessonLoading label="Loading your lesson and subjects…" />}</LessonFrame>;
}
