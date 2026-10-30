import React, { useState, useCallback } from "react";
import { ActivityIndicator, View, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Text } from "../accessibility/Primitives";
import { FluenttLogo } from "../components/FluenttLogo";
import { PersonalIcon } from "../components/PersonalIcon";
import { homeColors as c } from "../theme/personal";
import { PracticeHero, PracticeButton, PracticeNotice } from "../features/pronunciation/PracticeUI";
import { practiceStyles as s } from "../features/pronunciation/practiceStyles";
import { useSession } from "../session/provider";
import type { PronunciationActivityView } from "../services/api/pronunciation";
import { LivePronunciationPractice } from "../features/pronunciation/LivePronunciationPractice";

export default function PronunciationScreen() {
  const { profile, pronunciation, activityHistory } = useSession();
  const [activities, setActivities] = useState<PronunciationActivityView[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<PronunciationActivityView | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string>(profile?.role === "personal_student" ? profile.language ?? "all" : "all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const profileId = profile?.id;
  const [practiceBusy, setPracticeBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setActivities([]); setSelectedActivity(null);
    if (!profileId) return () => { active = false; };
    const loadActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await pronunciation.activities(profile?.role === "personal_student" ? profile.language ?? undefined : languageFilter === "all" ? undefined : languageFilter);
      if (active) setActivities(res.activities.filter(row => profile?.role !== "personal_student" || row.language === profile.language));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load pronunciation activities.";
      if (active) setError(msg);
    } finally {
      if (active) setLoading(false);
    }
    };
    void loadActivities();
    return () => { active = false; setActivities([]); setSelectedActivity(null); setError(null); };
  // The reload counter deliberately restarts a focused request after Retry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageFilter, pronunciation, profileId, profile?.role, profile?.language, reload]));

  if (!profile) return null;
  const personal = profile.role === "personal_student";
  const language = personal ? profile.language : languageFilter;
  const back = () => {
    if (selectedActivity) { setSelectedActivity(null); return; }
    if (router.canGoBack()) router.back();
    else router.replace(personal ? "/student" : "/my-classes");
  };
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={s.screen}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={selectedActivity ? "Back to phrases" : "Go back"} accessibilityState={{ disabled: practiceBusy }} disabled={practiceBusy} onPress={back} style={[s.circle, s.back, practiceBusy && s.disabled]}><PersonalIcon name="chevron" size={18} /></Pressable>
      <FluenttLogo size={32} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account" accessibilityState={{ disabled: practiceBusy }} disabled={practiceBusy} onPress={() => router.push("/account")} style={[s.circle, practiceBusy && s.disabled]}><PersonalIcon name="account" size={18} /></Pressable>
    </View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <PracticeHero selected={!!selectedActivity} />
      {selectedActivity ? <LivePronunciationPractice key={selectedActivity.id} activity={selectedActivity} api={pronunciation}
        history={personal ? activityHistory : undefined} owner={personal ? profile.id : undefined}
        guidedSubmissionMode={!personal} onBusyChange={setPracticeBusy} onDone={() => setSelectedActivity(null)} /> : <>
        {!personal && <View accessibilityRole="tablist" accessibilityLabel="Practice language" style={s.tabs}>
          {([ ["all", "All phrases"], ["english", "English"], ["tagalog", "Tagalog"] ] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: languageFilter === value }} onPress={() => setLanguageFilter(value)} style={[s.tab, languageFilter === value && s.selectedTab]}><Text style={s.tabText}>{label}</Text></Pressable>)}
        </View>}
        <View style={s.row}><Text accessibilityRole="header" style={s.heading}>Your phrases</Text>{language && language !== "all" && <View style={s.badge}><Text style={s.badgeText}>{language === "english" ? "English" : "Tagalog"}</Text></View>}</View>
        {loading ? <View accessibilityLiveRegion="polite" style={s.state}><ActivityIndicator color={c.teal} /><Text style={s.body}>Loading your phrases…</Text></View>
          : error ? <View style={[s.card, s.state]}><Text accessibilityRole="header" style={[s.heading, s.centered]}>We couldn’t load your phrases</Text><PracticeNotice error message={error} /><PracticeButton label="Try again" onPress={() => setReload(value => value + 1)} /></View>
          : activities.length === 0 ? <View style={[s.card, s.state]}><View style={s.art}><PersonalIcon name="voice" size={30} /></View><Text accessibilityRole="header" style={[s.heading, s.centered]}>More practice is on the way</Text><Text style={[s.body, s.centered]}>No phrases are available for this language yet. Check back soon.</Text></View>
          : <View style={s.list}>{activities.map(activity => <Pressable key={activity.id} accessibilityRole="button" accessibilityLabel={`Practice ${activity.language === "english" ? "English" : "Tagalog"}: ${activity.target_text}`} onPress={() => setSelectedActivity(activity)} style={({ pressed }) => [s.phrase, pressed && s.pressed]}>
            <View style={s.tile}><PersonalIcon name="tutor" size={20} /></View><View style={s.phraseCopy}><Text style={s.phraseTitle}>{activity.target_text}</Text><Text style={s.small}>{activity.language === "english" ? "English" : "Tagalog"}</Text>{!!activity.instructions && <Text style={s.small}>{activity.instructions}</Text>}</View><PersonalIcon name="arrow" size={17} />
          </Pressable>)}</View>}
      </>}
      <Text style={s.footer}>Small steps. More confidence.</Text>
    </ScrollView>
  </SafeAreaView>;
}
