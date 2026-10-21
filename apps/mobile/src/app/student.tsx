import { useSession } from "../session/provider";
import { PersonalHome } from "../features/dashboard/PersonalHome";
import { PersonalScreen } from "../components/PersonalScreen";
import { ClassroomHome } from "../features/dashboard/ClassroomHome";
import { ClassroomScreen } from "../components/ClassroomScreen";

export default function Dashboard() {
  const { profile } = useSession();
  if (!profile) return null;
  const isSchool = profile.role === "school_student";
  if (!isSchool) return <PersonalScreen><PersonalHome /></PersonalScreen>;
  return <ClassroomScreen><ClassroomHome /></ClassroomScreen>;
}
