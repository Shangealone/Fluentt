import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSession } from "../session/provider";
import { EnrollmentFlow } from "../features/enrollment/state";
import { JoinClassView, type JoinClassOperation } from "../features/enrollment/JoinClassView";

const friendlyErrors: Record<number, string> = {
  0: "We couldn’t connect. Check your internet and try again.",
  401: "Please sign in again to continue.",
  403: "You can’t join this class right now. Ask your teacher for help.",
  404: "That code doesn’t work. Check it with your teacher and try again.",
  409: "The class details changed. Check the code again.",
  429: "You’ve tried a few times. Wait a moment, then try again.",
  503: "We can’t reach your class right now. Please try again soon.",
};

export default function ClassCode() {
  const session = useSession();
  const [flow] = useState(() => new EnrollmentFlow());
  const [code, setCode] = useState("");
  const [operation, setOperation] = useState<JoinClassOperation>(null);
  const [showExit, setShowExit] = useState(false);
  const [error, setError] = useState("");
  const [, render] = useState(0);
  const mounted = useRef(true);
  const working = useRef(false);
  const busy = operation !== null;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const goBack = useCallback(() => {
    if (flow.busy || working.current) return;
    if (showExit) { setShowExit(false); return; }
    if (flow.preview && !flow.pending) {
      flow.cancel(); setError(""); render(value => value + 1); return;
    }
    if (flow.confirmed || session.profile?.profile_status === "active") {
      router.replace("/student"); return;
    }
    setShowExit(true);
  }, [flow, session.profile?.profile_status, showExit]);
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { goBack(); return true; });
    return () => sub.remove();
  }, [goBack]));
  async function run(kind: JoinClassOperation, action: () => Promise<unknown>) {
    if (flow.busy || working.current || showExit) return;
    working.current = true;
    setOperation(kind); setError("");
    try { await action(); }
    catch (failure) {
      if (mounted.current) {
        const status = (failure as { status?: number } | null)?.status;
        setError(status !== undefined && friendlyErrors[status] ? friendlyErrors[status]
          : "Something went wrong. Please try again.");
      }
    } finally {
      working.current = false;
      if (mounted.current) { setOperation(null); render(value => value + 1); }
    }
  }
  return <JoinClassView code={code} preview={flow.preview} confirmed={flow.confirmed} pending={flow.pending !== null}
    operation={operation} error={error} showExit={showExit}
    onBack={goBack} onAccount={() => { if (!busy && !showExit) router.push("/account"); }}
    onCodeChange={value => { setCode(value); setError(""); }}
    onCheck={() => void run("check", () => flow.verify(code, session.enrollment.preview))}
    onJoin={() => void run("join", () => flow.join(session.enrollment.confirm))}
    onChangeCode={() => { if (!busy && !flow.pending) { flow.cancel(); setError(""); render(value => value + 1); } }}
    onCheckClasses={() => void run("classes", async () => {
      const profile = await session.refreshProfile();
      if (profile?.profile_status === "active") router.replace("/student");
      else if (mounted.current) setError("No saved classes yet. Enter a code from your teacher to join.");
    })}
    onOpenClasses={() => router.replace("/student")}
    onStay={() => setShowExit(false)}
    onSignOut={() => { setShowExit(false); session.logout(); }} />;
}
