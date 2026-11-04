import { useCallback, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Text } from "../../accessibility/Primitives";
import { useSession } from "../../session/provider";
import { lessonLevelLabel } from "../../services/api/lessonLevel";
import { LessonArt, LessonButton, LessonField, LessonLoading, LessonNote, l } from "./LessonUI";
import { useLessonPage } from "./useLessonData";

export function AdministratorLessons({ classId, onClose }: { classId: string; onClose: () => void }) {
  const { assignments } = useSession();
  const [search, setSearch] = useState(""), [applied, setApplied] = useState("");
  const fetch = useCallback((offset: number) => assignments.lessons(classId, applied, offset, "curriculum"), [assignments, classId, applied]);
  const page = useLessonPage(fetch);
  return <View style={l.stack}>
    <LessonButton label="Back to class lessons" quiet onPress={onClose} />
    <Text accessibilityRole="header" style={l.heading}>Browse lessons</Text>
    <Text style={l.body}>Choose a published lesson to prepare an assignment for this class. You can select its questions in the assignment builder.</Text>
    <LessonField label="Search lessons" value={search} onChange={setSearch} maxLength={200} />
    <LessonButton label="Search lessons" disabled={page.phase === "loading"} onPress={() => { if (search.trim() === applied) page.reload(); else setApplied(search.trim()); }} />
    {!!applied && <LessonButton label="Clear search" quiet onPress={() => { setSearch(""); setApplied(""); }} />}
    <LessonButton label="Refresh lessons" quiet disabled={page.phase === "loading"} onPress={page.reload} />
    {page.phase === "loading" && <LessonLoading label="Loading lessons…" />}
    {page.phase === "error" && <><LessonNote error>We couldn’t load lessons. {page.error}</LessonNote><LessonButton label="Try again" onPress={page.reload} /></>}
    {page.phase === "ready" && <>
      {!page.rows.length && <View style={l.card}><LessonArt /><Text accessibilityRole="header" style={l.heading}>{applied ? "No matching lessons" : "No lessons available"}</Text><Text style={l.body}>{applied ? "Try another lesson name or clear your search." : "Published lessons available for this class will appear here. Check with your content coordinator if you expected a lesson."}</Text></View>}
      {page.rows.map(lesson => <View key={lesson.lesson_id} style={l.card}>
        <Text style={l.small}>PUBLISHED LESSON</Text>
        <Text accessibilityRole="header" style={l.heading}>{lesson.lesson_name}</Text>
        <Text style={l.small}>{lessonLevelLabel(lesson)} · {lesson.subject_name}</Text>
        {!!lesson.curriculum_name && <Text style={l.body}>{lesson.curriculum_name}</Text>}
        <LessonButton label="Create assignment" primary onPress={() => router.push({ pathname: "/assignment-builder", params: { classId, lessonId: lesson.lesson_id } })} />
      </View>)}
      {page.more && <LessonButton label="Load more lessons" onPress={page.loadMore} />}
    </>}
    <LessonNote>These published lessons are available for your class. Creating an assignment uses the original lesson; it doesn’t create an editable copy or publish an assignment automatically.</LessonNote>
  </View>;
}
