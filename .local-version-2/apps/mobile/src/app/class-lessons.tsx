import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "../accessibility/Primitives";
import { PersonalIcon } from "../components/PersonalIcon";
import { useSession } from "../session/provider";
import { LessonArt, LessonButton, LessonFrame, LessonHero, LessonLoading, LessonNote, l } from "../features/teacher-lessons/LessonUI";
import { useLessonData, useLessonPage } from "../features/teacher-lessons/useLessonData";

export default function ClassLessons() {
  const { profile } = useSession();
  const params = useLocalSearchParams<{ classId?: string; lessonId?: string }>();
  const classId = typeof params.classId === "string" ? params.classId : "", lessonId = typeof params.lessonId === "string" ? params.lessonId : "";
  if (profile?.role !== "school_student") return null;
  if (!classId) return <LessonFrame onBack={() => router.replace("/my-classes")} onAccount={() => router.push("/account")}><LessonHero title="Choose a class first" description="Open lessons from one of your joined classes." /><LessonButton label="My classes" primary onPress={() => router.replace("/my-classes")} /></LessonFrame>;
  return lessonId ? <Reader key={`${profile.id}-${classId}-${lessonId}`} classId={classId} lessonId={lessonId} /> : <Directory key={`${profile.id}-${classId}`} classId={classId} />;
}
function Directory({ classId }: { classId: string }) {
  const { teacherLessons: api } = useSession();
  const fetch = useCallback((offset: number) => api.shared(classId, offset), [api, classId]);
  const page = useLessonPage(fetch);
  return <LessonFrame onBack={() => { if (router.canGoBack()) router.back(); else router.replace("/my-classes"); }} onAccount={() => router.push("/account")}><LessonHero title="Class lessons" description="Something new to explore together." /><View style={[l.row, l.between]}><Text accessibilityRole="header" style={l.heading}>Your lessons</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh class lessons" disabled={page.phase === "loading"} onPress={page.reload} style={l.circle}><PersonalIcon name="refresh" size={18} /></Pressable></View>{page.phase === "loading" && <LessonLoading />}{page.phase === "error" && <><LessonNote error>We couldn’t load your class lessons. {page.error}</LessonNote><LessonButton label="Try again" onPress={page.reload} /></>}{page.phase === "ready" && <>{!page.rows.length && <View style={l.card}><LessonArt /><Text style={l.heading}>No lessons shared yet</Text><Text style={l.body}>Your teacher’s lessons will appear here.</Text></View>}{page.rows.map(row => <View key={row.lesson_id} style={l.card}><Text accessibilityRole="header" style={l.heading}>{row.title}</Text><Text style={l.small}>Shared by {row.instructor}</Text>{!!row.introduction && <Text style={l.body}>{row.introduction}</Text>}<Text style={l.small}>Grade {row.context.grade} · {row.context.subject_name} · {row.context.lesson_version ? `Version ${row.context.lesson_version}` : "Teacher lesson"}</Text><LessonButton label="Read lesson" primary onPress={() => router.push({ pathname: "/class-lessons", params: { classId, lessonId: row.lesson_id } })} /></View>)}{page.more && <LessonButton label="Load more lessons" onPress={page.loadMore} />}</>}<LessonNote>Your teacher shares lessons here. Quiz work is in class assignments. Reading a lesson does not start an attempt.</LessonNote><LessonButton label="View class assignments" onPress={() => router.push({ pathname: "/published-assignments", params: { classId } })} /></LessonFrame>;
}
function Reader({ classId, lessonId }: { classId: string; lessonId: string }) {
  const { teacherLessons: api } = useSession();
  const fetch = useCallback(() => api.read(classId, lessonId), [api, classId, lessonId]);
  const data = useLessonData(fetch), row = data.phase === "ready" ? data.value : null;
  const back = () => router.replace({ pathname: "/class-lessons", params: { classId } });
  return <LessonFrame scrollKey={lessonId} onBack={back} onAccount={() => router.push("/account")}>
    {data.phase === "loading" && <LessonLoading label="Loading your lesson…" />}{data.phase === "error" && <><LessonHero title="This lesson is unavailable" description="Your class access or the lesson’s sharing may have changed." /><LessonNote error>{data.error}</LessonNote><LessonButton label="Try again" onPress={data.reload} /><LessonButton label="Back to class lessons" onPress={back} /></>}
    {row && <><Text style={l.small}>CLASS LESSON</Text><Text accessibilityRole="header" style={l.title}>{row.title}</Text><Text style={l.small}>Shared by {row.instructor} · Version {row.version}</Text>{!!row.introduction && <Text style={l.body}>{row.introduction}</Text>}{row.sections?.map((s, i) => <View key={i} style={l.card}><Text accessibilityRole="header" style={l.heading}>{s.heading}</Text><Text style={l.reading}>{s.body}</Text></View>)}{!row.sections?.length && <LessonNote>This lesson has no reading sections. Your teacher’s quiz work is available through class assignments.</LessonNote>}<View style={l.card}><Text style={l.heading}>Ready for a little practice?</Text><Text style={l.body}>Open your class assignments to find your teacher’s quiz work.</Text><LessonButton label="Class assignments" primary onPress={() => router.push({ pathname: "/published-assignments", params: { classId } })} /></View><LessonButton label="Back to class lessons" quiet onPress={back} /><LessonNote>Reading this lesson doesn’t start a quiz or mark the lesson as completed.</LessonNote></>}
  </LessonFrame>;
}
