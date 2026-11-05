import { router } from "expo-router";
import { WelcomeScreen } from "../features/welcome/WelcomeScreen";

export default function Welcome() {
  return <WelcomeScreen
    onClassroom={() => router.push("/auth?mode=create&role=school_student")}
    onTeacher={() => router.push("/auth?mode=create&role=instructor")}
    onSignIn={() => router.push("/auth?mode=signin")}
  />;
}
