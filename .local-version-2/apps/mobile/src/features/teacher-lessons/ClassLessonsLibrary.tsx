import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { useSession } from "../../session/provider";
import { classProficiencyLabel } from "../../services/api/classProficiency";
import type { TeacherLessonSummary } from "../../services/api/teacherLessons";
import { useLessonPage } from "./useLessonData";
import { AdministratorLessons } from "./AdministratorLessons";
import { ClassLessonsFrame, ClassLessonsHero, DirectoryAction, DirectoryBadge, DirectoryDisclosure, DirectoryHeading, DirectoryState, DirectoryTabIcon, LessonDirectoryTile, cl } from "./ClassLessonsUI";

export function ClassLessonsLibrary({ classId }: { classId: string }) {
  const [tab, setTab] = useState<"class" | "browse">("class");
  const [search, setSearch] = useState(""), [applied, setApplied] = useState("");
  const { fontScale } = useWindowDimensions();
  const create = () => router.push({ pathname: "/instructor-lesson", params: classId ? { classId } : {} });
  return <ClassLessonsFrame classScoped={!!classId}
    onBack={() => router.replace(classId ? { pathname: "/class-details", params: { id: classId } } : "/instructor")}
    onAccount={() => router.push("/account")}>
    <ClassLessonsHero classScoped={!!classId} />
    <View style={cl.topActions}>
      <DirectoryAction label="Create a lesson" primary icon="plus" onPress={create} />
      {!!classId && <DirectoryAction label="Share from my lessons" quiet icon="share" onPress={() => router.push("/instructor-lessons")} />}
    </View>
    {!!classId && <View accessibilityRole="tablist" accessibilityLabel="Lesson library" style={cl.tabs}>
      {(["class", "browse"] as const).map(option => <Pressable key={option} accessibilityRole="tab" accessibilityLabel={option === "class" ? "Class lessons" : "Browse lessons"} accessibilityState={{ selected: tab === option }} onPress={() => setTab(option)} style={[cl.tab, tab === option && cl.selectedTab, fontScale > 1.2 && cl.tabStack]}>
        <DirectoryTabIcon catalog={option === "browse"} selected={tab === option} /><Text style={[cl.tabLabel, tab === option && cl.selectedTabLabel]}>{option === "class" ? "Class lessons" : "Browse lessons"}</Text>
      </Pressable>)}
    </View>}
    {tab === "browse" && classId
      ? <AdministratorLessons classId={classId} search={search} applied={applied} onSearchChange={setSearch} onApply={setApplied} />
      : <SharedClassLessons classId={classId} onCreate={create} />}
    <DirectoryDisclosure label={classId ? "About class lessons" : "About your lessons"} about>
      <Text style={cl.small}>Lessons you create stay in your library. Publish a version, then share it with a class when you’re ready. A published version can’t be edited.</Text>
      {!!classId && <Text style={cl.small}>Browse lessons offers published content you can use to prepare assignments. It doesn’t make an editable copy or publish an assignment automatically.</Text>}
    </DirectoryDisclosure>
  </ClassLessonsFrame>;
}

function SharedClassLessons({ classId, onCreate }: { classId: string; onCreate: () => void }) {
  const { teacherLessons } = useSession();
  const fetch = useCallback((offset: number) => teacherLessons.list(classId, offset), [teacherLessons, classId]);
  const page = useLessonPage(fetch);
  return <View style={cl.stack}>
    <DirectoryHeading title={classId ? "Shared with this class" : "Your lesson library"} loading={page.phase === "loading"} onRefresh={page.reload} />
    {page.phase === "loading" && <DirectoryState kind="loading" title="Loading your lessons…" description="Getting the latest lesson library." />}
    {page.phase === "error" && <DirectoryState kind="error" title="We couldn’t load your lessons" description={page.error} onRetry={page.reload} />}
    {page.phase === "ready" && <>
      {!page.rows.length && <DirectoryState kind="empty" title={classId ? "A place for your lessons" : "Your first lesson starts here"} description={classId ? "Create a lesson, or share a published lesson from your library with this class." : "Turn an idea into a lesson, then share it with your classes."} actionLabel="Create a lesson" onAction={onCreate} />}
      {page.rows.map((row, index) => <SharedLessonCard key={`${row.id}-${row.version_id}`} row={row} classId={classId} alternate={index % 2 !== 0} />)}
      {page.more && <DirectoryAction label="Load more lessons" icon="chevron" onPress={page.loadMore} />}
    </>}
  </View>;
}

function SharedLessonCard({ row, classId, alternate }: { row: TeacherLessonSummary; classId: string; alternate: boolean }) {
  const language = row.language === "english" ? "English" : "Tagalog";
  return <View style={cl.card}>
    <View style={cl.cardTop}><LessonDirectoryTile alternate={alternate} /><DirectoryBadge status={row.status} /></View>
    <Text accessibilityRole="header" style={cl.cardTitle}>{row.title}</Text>
    <View style={cl.meta}>
      {!!row.proficiency_level && <View style={cl.level}><Text style={cl.levelText}>{classProficiencyLabel(row.proficiency_level)}</Text></View>}
      <Text style={cl.small}>{language}{row.subject_name !== language ? ` · ${row.subject_name}` : ""}</Text>
    </View>
    <DirectoryDisclosure label="Lesson details">
      <Text style={cl.small}>Version {row.version} · Subject: {row.subject_name}</Text>
      {!!row.introduction && <Text style={cl.small}>{row.introduction}</Text>}
    </DirectoryDisclosure>
    <View style={cl.cardActions}>
      <DirectoryAction label={row.status === "draft" ? "Continue editing" : "Open lesson"} primary={row.status === "draft"} icon="arrow" onPress={() => router.push({ pathname: "/instructor-lesson", params: { id: row.id, versionId: row.version_id, ...(classId ? { classId } : {}) } })} />
      {!!classId && row.status === "published" && <DirectoryAction label="Create assignment" primary icon="arrow" onPress={() => router.push({ pathname: "/assignment-builder", params: { classId, lessonId: row.lesson_id } })} />}
    </View>
  </View>;
}
