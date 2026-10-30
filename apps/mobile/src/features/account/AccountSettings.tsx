import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Image, Pressable, Switch, Text as SampleText, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Constants from "expo-constants";
import { Text, TextInput } from "../../accessibility/Primitives";
import { defaultReadingPreferences, readingScale, useReadingPreferences, type ReadingPreferences } from "../../accessibility/provider";
import { useSession } from "../../session/provider";
import { destination } from "../../session/routing";
import { validLearningFocus, type Language } from "../../services/api/identity";
import { parseFocus } from "../preferences/LearningFocusFields";
import { experienceForLevel, levelFromExperience, type StartingLevel } from "../setup/preferences";
import { AccountHero, AccountLayout, SettingsAction, SettingsGroup, SettingsRow, s } from "./AccountUI";

type Panel = "home" | "accessibility" | "learning" | "guide" | "about" | "signout";
const levelNames = { easy: "Easy", medium: "Medium", hard: "Challenging" };

function ToggleRow({ title, description, value, onChange, disabled }: { title: string; description: string; value: boolean; onChange: (value: boolean) => void; disabled: boolean }) {
  return <View style={s.toggleRow}><View style={s.toggleCopy}><Text style={s.rowTitle}>{title}</Text><Text style={s.rowSubtitle}>{description}</Text></View><Switch accessibilityLabel={title} accessibilityHint={description} accessibilityState={{ disabled }} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: "#DEE7DE", true: "#176556" }} thumbColor="#FFFFFF" /></View>;
}
function RadioOption({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }} aria-checked={selected} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.option, selected && s.selected, disabled && s.disabled, pressed && s.pressed]}><Text style={s.optionText}>{label}</Text><View accessible={false} style={[s.radio, selected && s.selectedRadio]}>{selected && <View style={s.radioDot} />}</View></Pressable>;
}

export function AccountSettings() {
  const session = useSession(), reading = useReadingPreferences();
  const profile = session.profile;
  const [panel, setPanel] = useState<Panel>("home"), [operation, setOperation] = useState<"refresh" | "reading" | "learning" | null>(null);
  const [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [draft, setDraft] = useState<ReadingPreferences>(reading.preferences);
  const [language, setLanguage] = useState<Language | null>(null), [level, setLevel] = useState<StartingLevel | null>(null);
  const [topics, setTopics] = useState(""), [lessons, setLessons] = useState("");
  const scope = useRef({ active: false, generation: 0 }), lock = useRef(false), backRef = useRef<() => void>(() => {});
  const ownerId = profile?.id;
  useFocusEffect(useCallback(() => {
    const generation = ++scope.current.generation;
    scope.current.active = !!ownerId;
    return () => {
      if (scope.current.generation !== generation) return;
      scope.current.active = false; ++scope.current.generation; lock.current = false;
      setPanel("home"); setOperation(null); setError(""); setSuccess(""); setTopics(""); setLessons("");
    };
  }, [ownerId]));
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { if (lock.current) return true; backRef.current(); return true; });
    return () => subscription.remove();
  }, []);
  function back() {
    if (lock.current) return;
    setError(""); setSuccess("");
    if (panel !== "home") setPanel("home");
    else if (profile) router.replace(destination(profile));
  }
  backRef.current = back;
  function open(next: Panel) {
    if (lock.current || !scope.current.active || !profile) return;
    setError(""); setSuccess("");
    if (next === "accessibility") {
      if (reading.loading) return;
      setDraft({ ...reading.preferences });
    }
    if (next === "learning") {
      if (profile.role !== "personal_student") return;
      setLanguage(profile.language); setLevel(levelFromExperience(profile.experience));
      setTopics(profile.learning_focus?.topics.join("\n") ?? ""); setLessons(profile.learning_focus?.lessons.join("\n") ?? "");
    }
    setPanel(next);
  }
  async function perform(kind: "refresh" | "reading" | "learning", action: () => Promise<unknown>, message: string) {
    if (lock.current || !scope.current.active) return;
    const generation = scope.current.generation;
    const current = () => scope.current.active && scope.current.generation === generation;
    lock.current = true; setOperation(kind); setError(""); setSuccess("");
    try {
      await action();
      if (current()) { if (kind !== "refresh") setPanel("home"); setSuccess(message); }
    } catch (failure) {
      if (current()) setError((failure instanceof Error ? failure.message : "We couldn’t save your changes. Please try again.") + (kind === "refresh" ? " Your displayed details may be out of date." : ""));
    } finally { if (current()) { lock.current = false; setOperation(null); } }
  }
  function saveLearning() {
    if (lock.current || profile?.role !== "personal_student") return;
    if (!language || !level) { setError("Choose a language and a starting level."); return; }
    const focus = parseFocus(topics, lessons);
    const includeFocus = focus.topics.length + focus.lessons.length > 0 || profile.learning_focus != null;
    if (includeFocus && !validLearningFocus(focus)) { setError("Add at least one topic or lesson. Use up to 10 different entries in each list, with no more than 120 characters per entry."); return; }
    const settings = { language, experience: experienceForLevel(level, language === profile.language ? profile.experience : undefined), ...(includeFocus ? { learning_focus: focus } : {}) };
    void perform("learning", () => session.save(settings), "Your learning preferences have been saved.");
  }
  if (!profile) return null;
  const busy = operation !== null;
  const role = profile.role === "instructor" ? "Teacher" : profile.role === "school_student" ? "Student" : "Personal learner";
  const savedLevel = levelFromExperience(profile.experience);
  const contrastBorder = reading.highContrast ? s.contrastBorder : null;
  const initial = profile.username.slice(0, 1).toUpperCase();
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const settingsDisabled = busy || reading.loading;
  const guide = profile.role === "instructor" ? [
    ["Create your class", "Create a class and share its code with your students."],
    ["Prepare class activities", "Choose your class, then open Assignments."],
    ["Stay connected", "Use Messages for class announcements and student conversations."],
    ["See class activity", "Open Overview to view submissions and available shared results."],
  ] : profile.role === "personal_student" ? [
    ["Choose your starting point", "Pick English or Tagalog and a starting level that feels right."],
    ["Try a little practice", "Open Learn to explore available lessons and activities."],
    ["Listen and speak", "Use the available listening and speaking activities to practice."],
    ["Make it comfortable", "Adjust your reading preferences in Accessibility."],
  ] : [
    ["Join your class", "Use the class code your teacher gives you."],
    ["Find your activities", "Open your class to see available assignments."],
    ["Ask for help", "Open Messages to contact your teacher."],
    ["Check your results", "Look for results your teacher has shared with you."],
  ];

  return <AccountLayout busy={busy} checking={operation === "refresh"} onBack={back} onRefresh={() => void perform("refresh", session.refreshProfile, "Your account details are up to date.")}>
    {panel !== "home" && panel !== "accessibility" && panel !== "learning" && <>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {!!success && <Text accessibilityLiveRegion="polite" style={s.success}>{success}</Text>}
    </>}
    {panel === "home" ? <>
      <AccountHero title={"Account &\nsettings"} subtitle="Make Fluentt feel right for you." />
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!success && <Text accessibilityLiveRegion="polite" style={s.success}>{success}</Text>}
      <View style={[s.profile, contrastBorder]}><View style={s.avatar}><Text accessible={false} style={s.avatarText}>{initial}</Text></View><View style={s.profileCopy}><Text style={s.username}>{profile.username}</Text><View style={s.role}><Text style={s.roleText}>{role}</Text></View></View></View>
      {profile.profile_status !== "active" && <View style={[s.card, contrastBorder, { marginTop: 14 }]}><Text accessibilityRole="header" style={s.cardTitle}>Finish setting up</Text><Text style={[s.body, { marginTop: 7, marginBottom: 12 }]}>A few more choices will get your account ready.</Text><SettingsAction label="Continue setup" secondary disabled={busy} onPress={() => router.push(destination(profile))} /></View>}
      {profile.role === "personal_student" && <>
        <Text accessibilityRole="header" style={s.heading}>Your learning</Text><SettingsGroup>
          <SettingsRow title="Learning language" subtitle={profile.language === "english" ? "English" : profile.language === "tagalog" ? "Tagalog" : "Not selected"} icon="learn" disabled={busy} onPress={() => open("learning")} />
          <View style={s.divider}><SettingsRow title="Starting level" subtitle={savedLevel ? levelNames[savedLevel] : "Not selected"} icon="overview" tone="lavender" disabled={busy} onPress={() => open("learning")} /></View>
          <View style={s.divider}><SettingsRow title="Learning focus" subtitle="Topics and lessons you’d like to practice" icon="assignments" tone="aqua" disabled={busy} onPress={() => open("learning")} /></View>
        </SettingsGroup>
      </>}
      <Text accessibilityRole="header" style={s.heading}>Preferences</Text><SettingsGroup>
        <SettingsRow title="Accessibility" subtitle={reading.loading ? "Loading your preferences…" : "Text size, contrast & motion"} icon="settings" tone="aqua" disabled={busy || reading.loading} onPress={() => open("accessibility")} />
        <View style={s.divider}><SettingsRow title="Notifications" subtitle="View your updates" icon="notifications" tone="peach" disabled={busy} onPress={() => router.push("/notifications")} /></View>
      </SettingsGroup>
      <Text accessibilityRole="header" style={s.heading}>Help & information</Text><SettingsGroup>
        <SettingsRow title="Quick guide" subtitle="Find your way around Fluentt" icon="tutor" tone="lavender" disabled={busy} onPress={() => open("guide")} />
        <View style={s.divider}><SettingsRow title="About Fluentt" subtitle={`Version ${version}`} icon="brand" disabled={busy} onPress={() => open("about")} /></View>
      </SettingsGroup>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => open("signout")} style={({ pressed }) => [s.signout, busy && s.disabled, pressed && s.pressed]}><Text style={s.signoutText}>Sign out</Text></Pressable>
      <Text style={[s.caption, s.footer]}>Small steps. More confidence.</Text>
    </> : panel === "accessibility" ? <>
      <AccountHero title="Accessibility" subtitle="Find what feels comfortable." />
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {!!reading.restoreError && <Text accessibilityRole="alert" style={s.notice}>{reading.restoreError}</Text>}
      {reading.loading && <Text accessibilityLiveRegion="polite" style={s.caption}>Loading your reading preferences…</Text>}
      <View style={[s.card, contrastBorder]}><ToggleRow title="Use device settings" description="Follow your device’s text, contrast and motion preferences." value={draft.useDeviceSettings} disabled={settingsDisabled} onChange={value => { setDraft(current => ({ ...current, useDeviceSettings: value })); setError(""); }} /></View>
      <Text accessibilityRole="header" style={s.heading}>Text size</Text><View style={[s.card, contrastBorder]}>
        <Text style={s.caption}>Choose a comfortable reading size.</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Text size" style={s.options}>{(["standard", "larger", "extra"] as const).map(size => <RadioOption key={size} label={size === "extra" ? "Extra large" : size === "larger" ? "Larger" : "Standard"} selected={draft.textSize === size} disabled={settingsDisabled || draft.useDeviceSettings} onPress={() => setDraft(current => ({ ...current, textSize: size }))} />)}</View>
        <View style={s.sample}><Text style={s.caption}>Reading sample</Text><SampleText allowFontScaling={draft.useDeviceSettings} style={{ color: !draft.useDeviceSettings && draft.highContrast ? "#0D2926" : "#173E3B", fontSize: 16 * (draft.useDeviceSettings ? 1 : readingScale(draft.textSize)), lineHeight: 27 * (draft.useDeviceSettings ? 1 : readingScale(draft.textSize)), fontWeight: "600", marginTop: 8 }}>Small steps.{"\n"}More confidence.</SampleText></View>
      </View>
      <Text accessibilityRole="header" style={s.heading}>Display & movement</Text><SettingsGroup>
        <ToggleRow title="Higher contrast" description="Make text easier to read." value={draft.highContrast} disabled={settingsDisabled || draft.useDeviceSettings} onChange={value => setDraft(current => ({ ...current, highContrast: value }))} />
        <View style={s.divider}><ToggleRow title="Reduce motion" description="Limit movement and animated effects." value={draft.reduceMotion} disabled={settingsDisabled || draft.useDeviceSettings} onChange={value => setDraft(current => ({ ...current, reduceMotion: value }))} /></View>
      </SettingsGroup>
      <Text style={[s.caption, { marginTop: 14, marginBottom: 18 }]}>These preferences apply on this device.</Text>
      <SettingsAction label={operation === "reading" ? "Saving preferences…" : "Save preferences"} busy={operation === "reading"} disabled={settingsDisabled} onPress={() => void perform("reading", () => reading.save(draft), "Your reading preferences have been saved.")} />
      <SettingsAction label="Use device defaults" quiet disabled={settingsDisabled} onPress={() => { setDraft({ ...defaultReadingPreferences }); setError(""); }} />
    </> : panel === "learning" && profile.role === "personal_student" ? <>
      <AccountHero title="Your learning" subtitle="Choose how you’d like to practice." icon="learn" />
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Text accessibilityRole="header" style={s.heading}>Learning language</Text><View accessibilityRole="radiogroup" accessibilityLabel="Learning language" style={[s.card, contrastBorder, { gap: 8 }]}>{(["english", "tagalog"] as const).map(value => <RadioOption key={value} label={value === "english" ? "English" : "Tagalog"} selected={language === value} disabled={busy} onPress={() => { setLanguage(value); setError(""); }} />)}</View>
      <Text accessibilityRole="header" style={s.heading}>Starting level</Text><View accessibilityRole="radiogroup" accessibilityLabel="Starting level" style={[s.card, contrastBorder, { gap: 8 }]}>{(["easy", "medium", "hard"] as const).map(value => <RadioOption key={value} label={levelNames[value]} selected={level === value} disabled={busy} onPress={() => { setLevel(value); setError(""); }} />)}</View>
      <Text accessibilityRole="header" style={s.heading}>Learning focus</Text><View style={[s.card, contrastBorder]}>
        <Text style={s.rowTitle}>Topics to practice</Text><TextInput accessibilityLabel="Topics to practice" multiline editable={!busy} value={topics} onChangeText={setTopics} placeholder="One topic per line" placeholderTextColor="#88958D" style={s.input} />
        <Text style={[s.rowTitle, { marginTop: 17 }]}>Lessons to practice</Text><TextInput accessibilityLabel="Lessons to practice" multiline editable={!busy} value={lessons} onChangeText={setLessons} placeholder="One lesson per line" placeholderTextColor="#88958D" style={s.input} />
        <Text style={[s.caption, { marginTop: 10 }]}>Up to 10 topics and 10 lessons, one per line. Your requests help describe what you’d like to practice; available lessons may differ.</Text>
      </View><SettingsAction label={operation === "learning" ? "Saving preferences…" : "Save preferences"} busy={operation === "learning"} disabled={busy || !language || !level} onPress={saveLearning} />
    </> : panel === "signout" ? <>
      <AccountHero title="Your account" subtitle="Take a break whenever you need." />
      <View style={[s.card, s.confirmation, contrastBorder]}><Text accessibilityRole="header" style={s.confirmationTitle}>Sign out?</Text><Text style={s.confirmationBody}>You’ll sign out on this device. Your account and saved learning will be here when you return.</Text><SettingsAction label="Sign out" disabled={busy} onPress={() => { if (!lock.current) session.logout(); }} /><SettingsAction label="Stay here" secondary disabled={busy} onPress={() => open("home")} /></View>
    </> : panel === "guide" ? <>
      <AccountHero title="Quick guide" subtitle="A little help to get you started." icon="tutor" />
      <SettingsGroup>{guide.map(([title, description], index) => <View key={title} style={index > 0 ? s.divider : undefined}><View style={s.infoStep}><View style={s.number}><Text style={s.numberText}>{index + 1}</Text></View><View style={s.infoCopy}><Text accessibilityRole="header" style={s.cardTitle}>{title}</Text><Text style={[s.caption, { marginTop: 6 }]}>{description}</Text></View></View></View>)}</SettingsGroup>
    </> : panel === "about" ? <>
      <AccountHero title="About Fluentt" subtitle="Your learning space." icon="brand" />
      <View style={[s.card, s.confirmation, contrastBorder]}><Image accessible={false} source={require("../../../assets/brand/fluentt-mark.png")} resizeMode="contain" style={s.aboutLogo} /><Text accessibilityRole="header" style={s.confirmationTitle}>fluentt</Text><Text style={s.confirmationBody}>A learning space for English and Tagalog practice.</Text><View style={[s.role, { alignSelf: "center" }]}><Text style={s.roleText}>Version {version}</Text></View></View><Text style={[s.caption, s.footer]}>Small steps. More confidence.</Text>
    </> : null}
  </AccountLayout>;
}
