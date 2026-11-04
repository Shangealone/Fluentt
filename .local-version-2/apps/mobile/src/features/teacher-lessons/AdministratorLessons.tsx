import { useCallback } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Text, TextInput, useWindowDimensions } from "../../accessibility/Primitives";
import { useSession } from "../../session/provider";
import { classProficiencyLabel } from "../../services/api/classProficiency";
import { DirectoryAction, DirectoryBadge, DirectoryHeading, DirectoryState, LessonDirectoryTile, cl } from "./ClassLessonsUI";
import { useLessonPage } from "./useLessonData";

type Props = { classId: string; search: string; applied: string; onSearchChange: (text: string) => void; onApply: (text: string) => void };

export function AdministratorLessons({ classId, search, applied, onSearchChange, onApply }: Props) {
  const { assignments } = useSession();
  const { fontScale } = useWindowDimensions();
  const fetch = useCallback((offset: number) => assignments.lessons(classId, applied, offset, "curriculum"), [assignments, classId, applied]);
  const page = useLessonPage(fetch);
  const apply = () => { if (page.phase === "loading") return; if (search.trim() === applied) page.reload(); else onApply(search.trim()); };
  const clear = () => { onSearchChange(""); onApply(""); };
  return <View style={cl.stack}>
    <Text style={cl.body}>Find a lesson for your next class assignment.</Text>
    <View style={cl.field}>
      <Text style={cl.searchLabel}>Search lessons</Text>
      <View style={[cl.searchRow, fontScale > 1.2 && cl.searchStack]}>
        <TextInput accessibilityLabel="Search lessons by name" placeholder="Lesson name" placeholderTextColor="#8B9A92" value={search} onChangeText={onSearchChange} maxLength={200} returnKeyType="search" onSubmitEditing={apply} style={cl.searchField} />
        <View style={cl.searchButton}><DirectoryAction label="Search" primary disabled={page.phase === "loading"} onPress={apply} /></View>
      </View>
      {!!applied && <DirectoryAction label="Clear search" quiet onPress={clear} />}
    </View>
    <DirectoryHeading title="Published lessons" loading={page.phase === "loading"} onRefresh={page.reload} />
    {page.phase === "loading" && <DirectoryState kind="loading" title="Loading your lessons…" description="Getting the latest lesson library." />}
    {page.phase === "error" && <DirectoryState kind="error" title="We couldn’t load your lessons" description={page.error} onRetry={page.reload} />}
    {page.phase === "ready" && <>
      {!!applied && <Text accessibilityLiveRegion="polite" style={cl.small}>Results for “{applied}”</Text>}
      {!page.rows.length && <DirectoryState kind="empty" title={applied ? "No matching lessons" : "No lessons available"} description={applied ? "Try another lesson name or clear your search." : "Published lessons available for this class will appear here."} actionLabel={applied ? "Clear search" : undefined} onAction={applied ? clear : undefined} />}
      {page.rows.map((lesson, index) => <View key={lesson.lesson_id} style={cl.card}>
        <View style={cl.cardTop}><LessonDirectoryTile alternate={index % 2 !== 0} /><DirectoryBadge status="published" catalog /></View>
        <Text accessibilityRole="header" style={cl.cardTitle}>{lesson.lesson_name}</Text>
        <View style={cl.meta}>
          {!!lesson.proficiency_level && <View style={cl.level}><Text style={cl.levelText}>{classProficiencyLabel(lesson.proficiency_level)}</Text></View>}
          <Text style={cl.small}>{lesson.subject_name}</Text>
        </View>
        {!!lesson.curriculum_name && <Text style={cl.body}>{lesson.curriculum_name}</Text>}
        <DirectoryAction label="Create assignment" primary icon="arrow" onPress={() => router.push({ pathname: "/assignment-builder", params: { classId, lessonId: lesson.lesson_id } })} />
      </View>)}
      {page.more && <DirectoryAction label="Load more lessons" icon="chevron" onPress={page.loadMore} />}
    </>}
  </View>;
}
