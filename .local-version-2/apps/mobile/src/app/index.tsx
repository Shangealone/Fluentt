import { router } from "expo-router";
import { WelcomeScreen } from "../features/welcome/WelcomeScreen";
import { useRegistrationOptions } from "../features/auth/useRegistrationOptions";

export default function Welcome() {
  const { personalLearnerEnabled } = useRegistrationOptions();
  return <WelcomeScreen
    onPersonal={personalLearnerEnabled ? () => router.push("/auth?mode=create&role=personal_student") : undefined}
    onClassroom={() => router.push("/auth?mode=create&role=school_student")}
    onTeacher={() => router.push("/auth?mode=create&role=instructor")}
    onSignIn={() => router.push("/auth?mode=signin")}
  />;
}
