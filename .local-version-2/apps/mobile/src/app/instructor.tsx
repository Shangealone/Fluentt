import { useSession } from "../session/provider";
import { usePagedList } from "../features/dashboard/usePagedList";
import { InstructorHome } from "../features/dashboard/InstructorHome";

export default function Instructor() {
  const { profile, classes } = useSession();
  const { state, reload, more } = usePagedList(classes.mine);
  if (profile?.role !== "instructor") return null;
  return <InstructorHome username={profile.username} state={state} onRefresh={reload} onMore={more} />;
}
