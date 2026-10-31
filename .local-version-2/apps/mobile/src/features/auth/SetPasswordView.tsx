import { useEffect, useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TextInput, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";

export type PasswordErrors = { password: string; confirmation: string };
type Props = {
  password: string; confirmation: string; busy: boolean; error: string; errors: PasswordErrors;
  onPassword: (value: string) => void; onConfirmation: (value: string) => void; onSave: () => void;
};

function AccountKeyArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.art}>
    <View style={s.accountCard}><View style={s.avatarHead} /><View style={s.avatarBody} /><View style={s.cardLine} /><View style={[s.cardLine, s.secondLine]} /></View>
    <View style={s.key}><View style={s.keyShaft}><View style={s.tooth} /><View style={[s.tooth, s.secondTooth]} /></View><View style={s.keyRing}><View style={s.keyHole} /></View></View>
  </View>;
}

function Eye({ hidden }: { hidden: boolean }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.eye}><View style={s.pupil} />{hidden && <View style={s.eyeSlash} />}</View>;
}

export function SetPasswordView(p: Props) {
  const { width, fontScale } = useWindowDimensions();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmationRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  useEffect(() => {
    if (p.errors.password) passwordRef.current?.focus();
    else if (p.errors.confirmation) confirmationRef.current?.focus();
  }, [p.errors.password, p.errors.confirmation]);
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={s.screen}>
    <View style={s.header}><FluenttLogo size={32} /></View>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, width < 360 && s.compact]}>
        <View style={[s.hero, (width < 360 || fontScale > 1.2) && s.stacked]}><View style={s.heroCopy}><Text accessibilityRole="header" style={s.title}>Set your password</Text><Text style={s.subtitle}>Use this password to sign in next time.</Text></View><AccountKeyArt /></View>
        <View style={s.form}>
          <View style={s.field}>
            <Text style={s.label}>New password</Text>
            <View style={[s.inputRow, !!p.errors.password && s.invalid]}>
              <TextInput ref={passwordRef} accessibilityLabel="New password" accessibilityHint={p.errors.password || "Use 6–128 characters."} value={p.password} onChangeText={p.onPassword}
                editable={!p.busy} secureTextEntry={!passwordVisible} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword"
                placeholder="Choose a password" placeholderTextColor="#7B8982" style={s.input} returnKeyType="next" onSubmitEditing={() => confirmationRef.current?.focus()} />
              <Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? "Hide new password" : "Show new password"} accessibilityState={{ checked: passwordVisible, disabled: p.busy }} disabled={p.busy} onPress={() => setPasswordVisible(value => !value)} style={[s.show, p.busy && s.dim]}><Eye hidden={passwordVisible} /></Pressable>
            </View>
            <Text style={s.hint}>Use 6–128 characters.</Text>
            {!!p.errors.password && <Text accessibilityRole="alert" style={s.error}>{p.errors.password}</Text>}
          </View>
          <View style={s.field}>
            <Text style={s.label}>Confirm password</Text>
            <View style={[s.inputRow, !!p.errors.confirmation && s.invalid]}>
              <TextInput ref={confirmationRef} accessibilityLabel="Confirm password" accessibilityHint={p.errors.confirmation || "Enter the same password again."} value={p.confirmation} onChangeText={p.onConfirmation}
                editable={!p.busy} secureTextEntry={!confirmationVisible} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword"
                placeholder="Enter it again" placeholderTextColor="#7B8982" style={s.input} returnKeyType="go" onSubmitEditing={p.onSave} />
              <Pressable accessibilityRole="button" accessibilityLabel={confirmationVisible ? "Hide confirmation password" : "Show confirmation password"} accessibilityState={{ checked: confirmationVisible, disabled: p.busy }} disabled={p.busy} onPress={() => setConfirmationVisible(value => !value)} style={[s.show, p.busy && s.dim]}><Eye hidden={confirmationVisible} /></Pressable>
            </View>
            {!!p.errors.confirmation && <Text accessibilityRole="alert" style={s.error}>{p.errors.confirmation}</Text>}
          </View>
          {!!p.error && <View style={s.errorCard}><Text accessibilityRole="alert" style={s.error}>We couldn’t save your password. {p.error}</Text></View>}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: p.busy, busy: p.busy }} disabled={p.busy} onPress={p.onSave} style={[s.submit, p.busy && s.dim]}><Text accessibilityLiveRegion="polite" style={s.submitText}>{p.busy ? "Saving password…" : "Save password and continue"}</Text>{!p.busy && <PersonalIcon name="arrow" size={18} color="#FFFFFF" />}</Pressable>
        </View>
        <Text style={s.note}>Choose a password you don’t use elsewhere. Keep it private.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, flex: { flex: 1 },
  header: { alignItems: "center", paddingTop: 24, paddingBottom: 12, paddingHorizontal: 22 },
  content: { width: "100%", maxWidth: 430, alignSelf: "center", paddingTop: 25, paddingHorizontal: 22, paddingBottom: 32, gap: 22 }, compact: { paddingHorizontal: 16 },
  hero: { flexDirection: "row", alignItems: "center", gap: 14 }, stacked: { flexDirection: "column-reverse", alignItems: "flex-start" }, heroCopy: { flex: 1, minWidth: 0, gap: 12 },
  title: { fontSize: 29, lineHeight: 37, letterSpacing: -1, fontWeight: "700", color: c.ink }, subtitle: { fontSize: 14, lineHeight: 24, color: c.muted },
  form: { padding: 20, borderWidth: 1, borderColor: c.line, borderRadius: 24, backgroundColor: "#FFFFFF", gap: 23 }, field: { gap: 9 },
  label: { fontSize: 15, lineHeight: 24, fontWeight: "700", color: c.ink }, inputRow: { flexDirection: "row", alignItems: "stretch", minHeight: 56, borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 14, backgroundColor: "#FAFBF8" },
  input: { flex: 1, minWidth: 0, paddingVertical: 14, paddingHorizontal: 12, fontSize: 16, color: c.ink }, show: { width: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  invalid: { borderColor: "#BF513D", backgroundColor: "#FFFAF8" }, hint: { fontSize: 12, lineHeight: 21, color: c.muted }, error: { fontSize: 13, lineHeight: 23, color: "#A83827" }, errorCard: { borderRadius: 14, backgroundColor: "#FFF0E9", padding: 14 },
  submit: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 13, paddingVertical: 15, borderRadius: 16, backgroundColor: c.coral }, submitText: { flexShrink: 1, textAlign: "center", fontSize: 14, lineHeight: 24, fontWeight: "700", color: "#FFFFFF" }, dim: { opacity: 0.55 }, note: { paddingHorizontal: 5, fontSize: 12, lineHeight: 22, color: c.muted },
  eye: { width: 19, height: 13, borderWidth: 1.5, borderColor: c.teal, borderRadius: 10, alignItems: "center", justifyContent: "center" }, pupil: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.teal }, eyeSlash: { position: "absolute", width: 23, height: 1.5, backgroundColor: c.teal, transform: [{ rotate: "45deg" }] },
  art: { width: 96, height: 100, borderRadius: 30, backgroundColor: "#E9F0DA" }, accountCard: { position: "absolute", left: 13, top: 23, width: 66, height: 47, borderWidth: 2, borderColor: "#538266", borderRadius: 7, backgroundColor: "#FFFDF3", transform: [{ rotate: "-8deg" }] },
  avatarHead: { position: "absolute", top: 8, left: 9, width: 11, height: 11, borderRadius: 6, backgroundColor: "#CBDCAA", borderWidth: 1.5, borderColor: "#6A976E" }, avatarBody: { position: "absolute", top: 22, left: 5, width: 19, height: 10, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: "#DFEBC4", borderWidth: 1.5, borderColor: "#6A976E" },
  cardLine: { position: "absolute", left: 31, top: 13, width: 23, height: 3, borderRadius: 2, backgroundColor: "#91AE80" }, secondLine: { top: 21, backgroundColor: "#B1C79E" },
  key: { position: "absolute", left: 40, top: 47, width: 49, height: 28, transform: [{ rotate: "-36deg" }] }, keyShaft: { position: "absolute", left: 17, top: 10, width: 31, height: 9, borderWidth: 2, borderColor: "#8C7146", backgroundColor: "#F7C78E", borderRadius: 2 }, tooth: { position: "absolute", right: 0, top: 4, width: 7, height: 10, backgroundColor: "#F7C78E", borderWidth: 2, borderTopWidth: 0, borderColor: "#8C7146" }, secondTooth: { right: 11 },
  keyRing: { width: 29, height: 29, borderRadius: 15, borderWidth: 2, borderColor: "#8C7146", backgroundColor: "#F3B993", alignItems: "center", justifyContent: "center" }, keyHole: { width: 11, height: 11, borderWidth: 2, borderColor: "#8C7146", borderRadius: 6, backgroundColor: "#F9F5E8" },
});
