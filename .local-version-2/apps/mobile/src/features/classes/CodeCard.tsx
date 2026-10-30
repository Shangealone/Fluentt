import { useEffect, useState, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";

import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";
import { copyInvitation, shareInvitation } from "./invitationActions";

export function CodeCard({ code, name }: { code: string | null; name: string }) {
  const { width, fontScale } = useWindowDimensions();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [operation, setOperation] = useState<"copy" | "share" | null>(null);
  const lock = useRef(false);
  const active = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function act(kind: "copy" | "share", action: () => Promise<string>) {
    if (lock.current || !active.current) return;
    lock.current = true;
    setOperation(kind); setError(""); setMessage("");
    try {
      const result = await action();
      if (active.current) setMessage(result);
    } catch (failure) {
      if (active.current) setError(failure instanceof Error ? failure.message : "This action is unavailable on your device.");
    } finally {
      lock.current = false;
      if (active.current) setOperation(null);
    }
  }
  const busy = operation !== null;
  return <View style={[s.card, width < 360 && s.compact]}>
    <View style={s.headingRow}><View style={s.key}><PersonalIcon name="key" size={16} color="#A57632" /></View><Text accessibilityRole="header" style={s.heading}>Class code</Text></View>
    {code ? <>
      <Text style={s.hint}>Students use this code to join your class.</Text>
      <Text selectable accessibilityLabel={"Class code " + code.split("").join(" ")} style={[s.digits, fontScale > 1.2 && s.largeDigits]}>{code.slice(0, 3) + " " + code.slice(3)}</Text>
      <View style={[s.actions, fontScale > 1.2 && s.stacked]}>
        <Pressable accessibilityRole="button" accessibilityLabel={operation === "copy" ? "Copying code…" : "Copy code"} accessibilityState={{ disabled: busy, busy: operation === "copy" }} disabled={busy}
          onPress={() => void act("copy", () => copyInvitation(code))} style={({ pressed }) => [s.action, s.copy, busy && s.disabled, pressed && s.pressed]}>
          {operation === "copy" ? <ActivityIndicator size="small" color="#FFFFFF" /> : <PersonalIcon name="copy" size={15} color="#FFFFFF" />}<Text style={[s.actionText, s.copyText]}>{operation === "copy" ? "Copying…" : "Copy code"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={operation === "share" ? "Sharing code…" : "Share code"} accessibilityState={{ disabled: busy, busy: operation === "share" }} disabled={busy}
          onPress={() => void act("share", () => shareInvitation(code, name))}
          style={({ pressed }) => [s.action, busy && s.disabled, pressed && s.pressed]}>
          {operation === "share" ? <ActivityIndicator size="small" color={c.teal} /> : <PersonalIcon name="share" size={15} color={c.teal} />}<Text style={s.actionText}>{operation === "share" ? "Sharing…" : "Share code"}</Text>
        </Pressable>
      </View>
    </> : <Text style={s.unavailable}>No active code</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={s.message}>{message}</Text>}
    {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
  </View>;
}
const s = StyleSheet.create({
  card: { padding: 20, borderWidth: 1, borderColor: c.line, borderRadius: 22, backgroundColor: "#FFFFFF" }, compact: { padding: 16 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 9 }, key: { width: 31, height: 31, borderRadius: 11, backgroundColor: "#FDF0DF", alignItems: "center", justifyContent: "center" },
  heading: { fontSize: 17, lineHeight: 26, fontWeight: "700", letterSpacing: -0.3, color: c.ink },
  hint: { marginTop: 9, marginBottom: 17, color: c.muted, fontSize: 12, lineHeight: 20 },
  digits: { minHeight: 83, paddingVertical: 15, paddingHorizontal: 8, borderRadius: 15, backgroundColor: "#F2F6EC", color: c.ink, fontSize: 33, lineHeight: 47, fontWeight: "700", letterSpacing: 4, fontVariant: ["tabular-nums"], textAlign: "center", overflow: "hidden" },
  largeDigits: { letterSpacing: 2 }, actions: { flexDirection: "row", gap: 9, marginTop: 15 }, stacked: { flexDirection: "column" },
  action: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 47, paddingVertical: 11, paddingHorizontal: 8, borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: "#FFFFFF" },
  actionText: { color: c.teal, fontSize: 12, lineHeight: 18, fontWeight: "700", flexShrink: 1 },
  copy: { borderColor: c.coral, borderBottomWidth: 3, borderBottomColor: "#AC3E23", backgroundColor: c.coral }, copyText: { color: "#FFFFFF" },
  unavailable: { paddingVertical: 24, paddingHorizontal: 10, marginTop: 15, borderRadius: 15, backgroundColor: "#F2F4EE", color: c.ink, textAlign: "center", fontSize: 16, lineHeight: 24, fontWeight: "600" },
  message: { marginTop: 12, color: c.teal, fontSize: 12, lineHeight: 20 }, error: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#FFF0E9", color: "#973921", fontSize: 12, lineHeight: 20 },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.7 },
});
