import { AdministratorLessons } from "../features/teacher-lessons/AdministratorLessons";
import { classProficiencyLabel } from "../services/api/classProficiency";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "../accessibility/Primitives";
import { PersonalIcon } from "../components/PersonalIcon";
import { useSession } from "../session/provider";
import { LessonArt, LessonButton, LessonFrame, LessonHero, LessonLoading, LessonNote, LessonStatus, l } from "../features/teacher-lessons/LessonUI";
import { useLessonPage } from "../features/teacher-lessons/useLessonData";

export default function InstructorLessons() {
  const { profile } = useSession();
  const params = useLocalSearchParams<{ classId?: string }>();
  const classId = typeof params.classId === "string" ? params.classId : "";
  if (profile?.role !== "instructor") return null;
  return <Library key={`${profile.id}-${classId}`} classId={classId} />;
}
function Library({ classId }: { classId: string }) {
  const { teacherLessons: api } = useSession();
  const [administrator, setAdministrator] = useState(false);
  const fetch = useCallback((offset: number) => api.list(classId, offset), [api, classId]);
  const page = useLessonPage(fetch);
  const open = (id: string, versionId: string) => router.push({ pathname: "/instructor-lesson", params: { id, versionId, ...(classId ? { classId } : {}) } });
  return <LessonFrame onBack={() => administrator ? setAdministrator(false) : router.replace(classId ? { pathname: "/class-details", params: { id: classId } } : "/instructor")} onAccount={() => router.push("/account")}>
    {administrator && classId ? <AdministratorLessons classId={classId} onClose={() => setAdministrator(false)} /> : <>
    <LessonHero title={classId ? "Class lessons" : "My lessons"} description={classId ? "A place for the lessons you share." : "Your ideas. More ways to learn."} />
    <LessonButton label="Create a lesson" primary onPress={() => router.push({ pathname: "/instructor-lesson", params: classId ? { classId } : {} })} />
    {classId && <LessonButton label="Browse Lessons" onPress={() => setAdministrator(true)} />}
    {classId && <LessonButton label="Share from my lessons" onPress={() => router.push("/instructor-lessons")} />}
    <View style={[l.row, l.between]}><Text accessibilityRole="header" style={l.heading}>{classId ? "Shared with this class" : "Your lesson library"}</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh lessons" disabled={page.phase === "loading"} onPress={page.reload} style={l.circle}><PersonalIcon name="refresh" size={18} /></Pressable></View>
    {page.phase === "loading" && <LessonLoading />}
    {page.phase === "error" && <><LessonNote error>We couldn’t load your lessons. {page.error}</LessonNote><LessonButton label="Try again" onPress={page.reload} /></>}
    {page.phase === "ready" && <>{!page.rows.length && <View style={l.card}><LessonArt /><Text accessibilityRole="header" style={l.heading}>{classId ? "A place for your lessons" : "Your first lesson starts here"}</Text><Text style={l.body}>{classId ? "Create a lesson or publish one from your library and share it with this class." : "Turn an idea into a lesson, then share it with your classes."}</Text></View>}{page.rows.map(row => <View key={`${row.id}-${row.version_id}`} style={l.card}><LessonStatus status={row.status} /><Text accessibilityRole="header" style={l.heading}>{row.title}</Text><Text style={l.small}>{classProficiencyLabel(row.proficiency_level ?? null)} · {row.language === "english" ? "English" : "Tagalog"} · {row.subject_name} · Version {row.version}</Text>{!!row.introduction && <Text style={l.body}>{row.introduction}</Text>}<LessonButton label={row.status === "draft" ? "Continue editing" : "Open lesson"} primary onPress={() => open(row.id, row.version_id)} />{classId && row.status === "published" && <LessonButton label="Create assignment" onPress={() => router.push({ pathname: "/assignment-builder", params: { classId, lessonId: row.lesson_id } })} />}</View>)}{page.more && <LessonButton label="Load more lessons" onPress={page.loadMore} />}</>}
    <LessonNote>Your lesson library belongs to you. Publishing freezes a version; students see it only after you explicitly share it with a class. Quiz work uses class assignments.</LessonNote>
    </>}
  </LessonFrame>;
}
