import type { ComponentProps } from "react";
import { useSession } from "../session/provider";
import { ClassroomScreen } from "./ClassroomScreen";
import { Screen } from "./ui";

/** Presentation only. Shared student/personal routes keep their existing shell. */
export function InstructorScreen(props: ComponentProps<typeof Screen>) {
  const { profile } = useSession();
  if (profile?.role !== "instructor") return <Screen {...props} />;
  return <ClassroomScreen instructor backDisabled={props.backDisabled}>{props.children}</ClassroomScreen>;
}
