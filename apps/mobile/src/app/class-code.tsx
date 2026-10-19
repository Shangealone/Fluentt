import { useEffect, useRef, useState } from "react";
import { BackHandler, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen, Input, Button, ErrorMessage, Loading, s } from "../components/ui";
import { useSession } from "../session/provider";
import { EnrollmentFlow } from "../features/enrollment/state";
import { AppHeader } from "../components/navigation";

export default function ClassCode() {
  const session = useSession();
  const [flow] = useState(() => new EnrollmentFlow());
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, render] = useState(0);
  const mounted = useRef(true);
  const checking = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (flow.busy || checking.current) return true;
      if (flow.preview) {
        flow.cancel(); setError(""); render((value) => value + 1); return true;
      }
      if (session.profile?.profile_status === "active") { router.replace("/student"); return true; }
      return false;
    });
    return () => { mounted.current = false; sub.remove(); };
  }, [flow, session.profile?.profile_status]);
  async function run(action: () => Promise<unknown>) {
    if (flow.busy || checking.current) return;
    setBusy(true); setError("");
    try { await action(); }
    catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : "Please retry.");
    } finally {
      if (mounted.current) { setBusy(false); render((value) => value + 1); }
    }
  }
  return (
    <Screen backDisabled={busy}>
      <AppHeader title={flow.confirmed ? "Enrollment saved" : flow.preview ? "Is this your class?" : "Join a class"} disabled={busy} />
      <Text style={s.eyebrow}>SCHOOL STUDENT · JOIN A CLASS</Text>
      {flow.confirmed ? <>
        <Text style={s.title}>You joined {flow.confirmed.class_name}.</Text>
        <Text accessibilityLiveRegion="polite" style={s.body}>Your enrollment is saved.</Text>
        <Button label="Open My Classes" onPress={() => router.replace("/student")} />
      </> : <>
        {flow.preview ? <>
          <View style={s.card}>
            <Text style={s.heading}>{flow.preview.class_name}</Text>
            {flow.preview.instructor_display_name ? <Text style={s.body}>Instructor: {flow.preview.instructor_display_name}</Text> : null}
            <Text style={s.body}>Grade {flow.preview.grade_level} · {flow.preview.language === "english" ? "English" : "Tagalog"}</Text>
          </View>
          <Text style={s.body}>Review these details, then confirm to join. Joining a class does not enroll you in research.</Text>
          <Button label={flow.pending ? "Retry Join Class" : "Join Class"} disabled={busy}
            onPress={() => void run(() => flow.join(session.enrollment.confirm))} />
          <Button label={flow.pending ? "Back to code entry" : "Cancel / Change code"} secondary disabled={busy} onPress={() => {
            flow.cancel(); setError(""); render((value) => value + 1);
          }} />
        </> : <>
          {/* Demo Class Code Autofill Presets */}
          <View style={{ backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 16, padding: 16, gap: 10, marginVertical: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>⚡ DEMO CLASS CODES</Text>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#0D9488", backgroundColor: "#ECFDF5", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>1-TAP AUTOFILL</Text>
            </View>
            <Text style={{ fontSize: 13, color: "#64748B" }}>Tap a demo classroom code to fill and verify instantly:</Text>
            <View style={{ gap: 8 }}>
              <Button
                label="⚡ [ 782041 ] Baitang 7 - Mabini (Filipino)"
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  setCode("782041");
                  setError("");
                  void run(() => flow.verify("782041", session.enrollment.preview));
                }}
              />
              <Button
                label="⚡ [ 519302 ] Grade 8 - Rizal (English)"
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  setCode("519302");
                  setError("");
                  void run(() => flow.verify("519302", session.enrollment.preview));
                }}
              />
            </View>
          </View>

          <Text style={s.body}>Enter the six-digit code provided by your instructor. Verification does not enroll you.</Text>
          <Input accessibilityLabel="Six-digit class code" keyboardType="number-pad" inputMode="numeric"
            value={code} editable={!busy} maxLength={6} autoCorrect={false}
            onChangeText={(value) => { setCode(value); setError(""); }} placeholder="000000" />
          <Button label="Verify class code" disabled={busy || !/^[0-9]{6}$/.test(code)}
            onPress={() => void run(() => flow.verify(code, session.enrollment.preview))} />
          {!!code && !/^[0-9]{6}$/.test(code) && <Text style={s.body}>Enter exactly six digits (0–9).</Text>}
        </>}
        {flow.pending && <Text style={s.body}>The response was interrupted. Retry the same confirmation safely, or check saved classes to see whether it completed. Going back does not undo a saved enrollment.</Text>}
        {busy && <Loading />}
        {!!error && <ErrorMessage message={error} />}
        <Button label="Check saved classes" secondary disabled={busy} onPress={() => void run(async () => {
          checking.current = true;
          try {
            const profile = await session.refreshProfile();
            if (profile?.profile_status === "active") router.replace("/student");
            else if (mounted.current) setError("No eligible enrollment is saved yet. Verify a code to join.");
          } finally { checking.current = false; }
        })} />
        {session.profile?.profile_status === "active" && <Button label="Back to My Classes" secondary disabled={busy}
          onPress={() => router.replace("/student")} />}
      </>}
    </Screen>
  );
}
