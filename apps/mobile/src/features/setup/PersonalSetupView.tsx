import { useEffect, useRef, type ComponentRef } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../../accessibility/Primitives";
import { languageChoices, levelChoices, type SetupChoiceValue } from "./preferences";
import type { Language } from "../../services/api/identity";
import { SetupButton, SetupFrame, u } from "./SetupUI";

export type PersonalSetupViewProps = {
  step: 1 | 2; language: Language | null; value: SetupChoiceValue | null;
  busy: boolean; error: string; showExit: boolean;
  onSelect: (value: SetupChoiceValue) => void; onSave: () => void; onBack: () => void;
  onAccount: () => void; onStay: () => void; onSignOut: () => void;
};

export function PersonalSetupView(p: PersonalSetupViewProps) {
  const stayRef = useRef<ComponentRef<typeof Pressable>>(null);
  const backRef = useRef<ComponentRef<typeof Pressable>>(null);
  const wasExiting = useRef(false);
  useEffect(() => {
    if (p.showExit) stayRef.current?.focus();
    else if (wasExiting.current) backRef.current?.focus();
    wasExiting.current = p.showExit;
  }, [p.showExit]);
  const first = p.step === 1;
  const language = p.language === "tagalog" ? "Tagalog" : "English";
  const choices = first ? languageChoices : levelChoices;
  return <SetupFrame title={p.showExit ? "Leave setup?" : first ? "What would you like to practice?" : "How would you like to start?"}
    description={p.showExit ? "You can come back whenever you’re ready." : first ? "Choose a language for your practice." : `Choose a starting level for your ${language} practice.`}
    art={first ? "language" : "level"} step={p.step} busy={p.busy} exiting={p.showExit}
    scrollKey={`${p.step}-${p.showExit}`} backRef={backRef} onBack={p.onBack} onAccount={p.onAccount}>
    {p.showExit ? <View style={u.card}>
      <Text style={u.body}>You’ll sign out on this device and return to the start screen. Your account and learning will stay saved.</Text>
      <Pressable ref={stayRef} accessibilityRole="button" onPress={p.onStay} style={[u.button, u.primary]}><Text style={[u.buttonText, u.primaryText]}>Stay here</Text></Pressable>
      <SetupButton label="Sign out" onPress={p.onSignOut} />
    </View> : <>
      <View accessibilityRole="radiogroup" accessibilityLabel={first ? "Practice language" : "Starting practice level"} style={u.choices}>
        {choices.map(choice => <Pressable key={choice.value} accessibilityRole="radio" accessibilityLabel={`${choice.label}. ${choice.detail}`}
          accessibilityState={{ checked: p.value === choice.value, disabled: p.busy }} aria-checked={p.value === choice.value}
          disabled={p.busy} onPress={() => p.onSelect(choice.value)} style={[u.choice, p.value === choice.value && u.selectedChoice, p.busy && u.disabled]}>
          <View style={u.choiceCopy}><Text style={u.choiceTitle}>{choice.label}</Text><Text style={[u.choiceDetail, first && u.greeting]}>{choice.detail}</Text></View>
          <View accessible={false} style={[u.radio, p.value === choice.value && u.radioSelected]}>{p.value === choice.value && <View style={u.radioDot} />}</View>
        </Pressable>)}
      </View>
      {!first && <Text style={u.body}>You can change this later.</Text>}
      {!!p.error && <View style={u.notice}><Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={u.error}>{p.error}</Text></View>}
      <SetupButton primary label={p.busy ? "Saving…" : first ? "Continue" : "Start learning"} disabled={p.busy || p.value === null} onPress={p.onSave} />
    </>}
  </SetupFrame>;
}
