import { Redirect } from "expo-router";

// Keep old links usable without asking personal learners for a school grade.
export default function LegacyGradeSetup() {
  return <Redirect href="/learning-focus" />;
}
