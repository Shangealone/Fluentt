import { useCallback } from "react";
import { router } from "expo-router";
import { useSession } from "../../session/provider";
import { usePagedList } from "../dashboard/usePagedList";
import { MyClassesView } from "./MyClassesView";

export function MyClasses() {
  const { enrollment, refreshProfile } = useSession();
  const fetchPage = useCallback(
    async (offset: number) => {
      const rows = await enrollment.mine(offset);
      if (offset === 0 && rows.length === 0) await refreshProfile();
      return rows;
    },
    [enrollment, refreshProfile]
  );
  const { state, reload, more } = usePagedList(fetchPage);
  return <MyClassesView state={state} onRefresh={reload} onMore={more}
    onJoin={() => router.push("/class-code")} onBack={() => router.replace("/student")} onAccount={() => router.push("/account")}
    onAssignments={row => router.push({ pathname: "/published-assignments", params: { classId: row.class_id } })}
    onMessages={row => router.push({ pathname: "/communication", params: { classId: row.class_id } })} />;
}
