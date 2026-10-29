import { ClassroomScreen } from "../components/ClassroomScreen";
import { MyClasses } from "../features/enrollment/MyClasses";

export default function StudentClasses() {
  return <ClassroomScreen title="A place for every lesson." description="Choose your classroom to open assignments, messages, and saved work.">
    <MyClasses />
  </ClassroomScreen>;
}
