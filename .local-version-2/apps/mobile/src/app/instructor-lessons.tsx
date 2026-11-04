import { useLocalSearchParams } from "expo-router";
import { useSession } from "../session/provider";
import { ClassLessonsLibrary } from "../features/teacher-lessons/ClassLessonsLibrary";

export default function InstructorLessons() {
  const { profile } = useSession();
  const params = useLocalSearchParams<{ classId?: string }>();
  const classId = typeof params.classId === "string" ? params.classId : "";
  if (profile?.role !== "instructor") return null;
  return <ClassLessonsLibrary key={`${profile.id}-${classId}`} classId={classId} />;
}
