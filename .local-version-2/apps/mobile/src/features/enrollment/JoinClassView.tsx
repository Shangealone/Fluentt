import { classProficiencyLabel } from "../../services/api/classProficiency";
import { useEffect, useRef, type ComponentRef } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../../accessibility/Primitives";

import { SafeAreaView } from "react-native-safe-area-context";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { a } from "../auth/styles";
import { homeColors as c } from "../../theme/personal";
import type { ClassPreview, Membership } from "../../services/api/enrollment";

export type JoinClassOperation = "check" | "join" | "classes" | null;
export type JoinClassViewProps = {
  code: string;
  preview: ClassPreview | null;
  confirmed: Membership | null;
  pending: boolean;
  operation: JoinClassOperation;
  error: string;
  showExit: boolean;
  onBack: () => void;
  onAccount: () => void;
  onCodeChange: (value: string) => void;
  onCheck: () => void;
  onJoin: () => void;
  onChangeCode: () => void;
  onCheckClasses: () => void;
  onOpenClasses: () => void;
  onStay: () => void;
  onSignOut: () => void;
};

function Action({ label, onPress, disabled = false, loading = false, secondary = false }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: loading }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [secondary ? j.secondary : a.submit, disabled && a.dim, pressed && !disabled && j.pressed]}>
    <View style={j.actionContent}>
      {loading && <ActivityIndicator size="small" color={secondary ? c.teal : "#FFFFFF"} />}
      <Text style={secondary ? j.secondaryText : a.submitText}>{label}</Text>
    </View>
  </Pressable>;
}

export function JoinClassView(props: JoinClassViewProps) {
  const busy = props.operation !== null;
  const stayRef = useRef<ComponentRef<typeof Pressable>>(null);
  const backRef = useRef<ComponentRef<typeof Pressable>>(null);
  const previousExit = useRef(false);
  useEffect(() => {
    if (props.showExit) stayRef.current?.focus();
    else if (previousExit.current) backRef.current?.focus();
    previousExit.current = props.showExit;
  }, [props.showExit]);
  const details = props.confirmed ?? props.preview;
  const title = props.showExit ? "Leave class setup?" : props.confirmed ? "You’re in!" : props.preview ? "Is this your class?" : "Join your class";
  return <SafeAreaView style={a.safe}>
    <KeyboardAvoidingView style={a.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={a.content} showsVerticalScrollIndicator={false}>
        <View style={[a.top, j.header]}>
          <Pressable ref={backRef} accessibilityRole="button" accessibilityLabel="Go back" accessibilityState={{ disabled: busy }}
            disabled={busy} onPress={props.onBack} style={[a.back, busy && a.dim]}><Text accessible={false} style={a.backText}>‹</Text></Pressable>
          <FluenttLogo size={32} />
          <Pressable accessibilityRole="button" accessibilityLabel="My account" accessibilityState={{ disabled: busy || props.showExit }}
            disabled={busy || props.showExit} onPress={props.onAccount} style={[j.account, (busy || props.showExit) && a.dim]}>
            <PersonalIcon name="account" size={20} />
          </Pressable>
        </View>
        <View style={a.intro}>
          <View style={[a.art, j.art]}><Image accessible={false} source={require("../../../assets/illustrations/activity-class.png")} style={a.heroImage} /></View>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={a.title}>{title}</Text>
          <Text style={a.description}>{props.showExit ? "You can come back whenever you’re ready." : props.confirmed ? "Your class is ready. Let’s keep learning." : props.preview ? "Check the details below before you join." : "Enter the six-digit code from your teacher."}</Text>
        </View>
        {props.showExit ? <View style={a.card}>
          <Text style={a.description}>You’ll sign out on this device and return to the start screen. Your account and learning will stay saved.</Text>
          <Pressable ref={stayRef} accessibilityRole="button" onPress={props.onStay} style={a.submit}><Text style={a.submitText}>Stay here</Text></Pressable>
          <Action label="Sign out" onPress={props.onSignOut} secondary />
        </View> : <View style={a.card}>
          {details ? <View style={[a.classPreview, props.confirmed && j.success]}>
            <Text style={j.className}>{details.class_name}</Text>
            {details.instructor_display_name && <Text style={a.description}>Teacher: {details.instructor_display_name}</Text>}
            <View style={j.chips}>
              <View style={j.chip}><Text style={j.chipText}>{classProficiencyLabel(details.proficiency_level)}</Text></View>
              <View style={j.chip}><Text style={j.chipText}>{details.language === "english" ? "English" : "Tagalog"}</Text></View>
            </View>
          </View> : <View style={a.field}>
            <Text nativeID="class-code-label" style={a.label}>Class code</Text>
            <TextInput accessibilityLabel="Six-digit class code" accessibilityLabelledBy="class-code-label" style={[a.input, j.codeInput]}
              value={props.code} editable={!busy} onChangeText={value => props.onCodeChange(value.replace(/[^0-9]/g, "").slice(0, 6))}
              keyboardType="number-pad" inputMode="numeric" autoComplete="off" autoCorrect={false} maxLength={6} placeholder="000000"
              placeholderTextColor="#89978D" returnKeyType="go" onSubmitEditing={() => { if (!busy && /^[0-9]{6}$/.test(props.code)) props.onCheck(); }} />
            <Text style={a.hint}>Your teacher will share this code with you.</Text>
          </View>}
          {!!props.error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={a.error}>{props.error}</Text>}
          {props.pending && <View style={j.notice}><Text accessibilityLiveRegion="polite" style={a.description}>Your connection was interrupted. Check my classes to see whether you joined, or try joining again.</Text></View>}
          {props.confirmed ? <Action label="Open my classes" onPress={props.onOpenClasses} /> : props.preview ? <>
            <Action label={props.operation === "join" ? "Joining…" : props.pending ? "Try joining again" : "Join class"} loading={props.operation === "join"} disabled={busy} onPress={props.onJoin} />
            {!props.pending && <Action label="Use another code" secondary disabled={busy} onPress={props.onChangeCode} />}
          </> : <Action label={props.operation === "check" ? "Checking…" : "Check code"} loading={props.operation === "check"}
            disabled={busy || !/^[0-9]{6}$/.test(props.code)} onPress={props.onCheck} />}
          {!props.confirmed && <Action label={props.operation === "classes" ? "Checking my classes…" : "Check my classes"} loading={props.operation === "classes"} secondary disabled={busy} onPress={props.onCheckClasses} />}
        </View>}
        <Text style={a.footer}>Small steps. More confidence.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const j = StyleSheet.create({
  header: { justifyContent: "space-between", gap: 8 },
  account: { width: 44, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  art: { backgroundColor: "#E2F2F8" },
  codeInput: { textAlign: "center", fontSize: 26, fontWeight: "600", letterSpacing: 7, minHeight: 64 },
  className: { fontSize: 21, lineHeight: 29, fontWeight: "700", color: c.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, backgroundColor: "#FFFFFF" },
  chipText: { fontSize: 12, lineHeight: 19, fontWeight: "600", color: c.teal },
  success: { backgroundColor: c.selected },
  secondary: { minHeight: 50, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: c.line, backgroundColor: "#FAFCF7", justifyContent: "center" },
  secondaryText: { fontSize: 14, lineHeight: 21, fontWeight: "600", color: c.teal, textAlign: "center", flexShrink: 1 },
  actionContent: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.8 },
  notice: { backgroundColor: "#FFF5E2", borderRadius: 14, padding: 14 },
});
