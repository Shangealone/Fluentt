import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Text } from "../../accessibility/Primitives";

import { useFocusEffect } from "expo-router";
import { PersonalIcon } from "../../components/PersonalIcon";
import type { HistoryArea, PersonalHistoryAccess, PersonalHistoryPage } from "../../services/api/personalHistory";
import { homeColors as c } from "../../theme/personal";
import { hs as s } from "./historyStyles";
import { PracticeLogArt } from "./PracticeLogArt";
import { PracticeButton, PracticeNotice } from "../pronunciation/PracticeUI";

export function PersonalHistory({ api, owner }: { api?: PersonalHistoryAccess; owner: string; demo?: boolean }) {
  const [area, setArea] = useState<HistoryArea>("all"), [offset, setOffset] = useState(0), [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ scope: string; page: PersonalHistoryPage } | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const scope = `${owner}:${area}:${offset}:${refresh}`;
  const page = result?.scope === scope ? result.page : null;
  useFocusEffect(useCallback(() => {
    let active = true;
    setResult(null); setLoading(true); setError(""); setExpanded(null);
    if (!api) { setLoading(false); setError("History is unavailable. Please sign in again or check your connection."); return; }
    void api.list(area, offset).then(value => { if (active) setResult({ scope, page: value }); })
      .catch(() => { if (active) setError("History could not load. Check your connection and try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; setResult(null); setError(""); setExpanded(null); };
  }, [api, scope, area, offset]));
  return <View style={s.section}>
    <View style={s.row}><Text accessibilityRole="header" style={s.heading}>Your practice</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh practice history" accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={() => setRefresh(value => value + 1)} style={[s.refresh, loading && s.disabled]}><PersonalIcon name="refresh" size={18} /></Pressable></View>
    <View accessibilityRole="tablist" accessibilityLabel="Filter your practice" style={s.tabs}>
      {([ ["all", "All"], ["learn", "Learn"], ["voice", "Speak"], ["tutor", "Chat"] ] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: area === value }} onPress={() => { setArea(value); setOffset(0); }} style={[s.tab, area === value && s.selectedTab]}><Text style={s.label}>{label}</Text></Pressable>)}
    </View>
    {loading ? <View style={[s.card, s.state]} accessibilityLiveRegion="polite"><ActivityIndicator color={c.teal} /><Text style={s.itemTitle}>Loading your practice…</Text><Text style={[s.small, s.centered]}>Your saved activities will appear here.</Text></View> : error ? <View style={[s.card, s.state]}><Text accessibilityRole="header" style={[s.itemTitle, s.centered]}>We couldn’t load your practice</Text><PracticeNotice error message={error} /><PracticeButton label="Try again" onPress={() => setRefresh(value => value + 1)} /></View> : !page?.items.length ? <View style={[s.card, s.state]}><PracticeLogArt /><Text accessibilityRole="header" style={[s.itemTitle, s.centered]}>Your practice starts here</Text><Text style={[s.small, s.centered]}>Your saved activities will appear here.</Text></View> : page.items.map(row => {
      const section = row.kind.startsWith("learn_") ? "learn" : row.kind === "voice_phrase" ? "voice" : "tutor";
      const labels = { learn_question: "Question answered", learn_lesson: "Lesson set finished", voice_phrase: "Phrase practiced", tutor_reply: "Conversation reply sent", tutor_session: "Conversation finished" };
      const illustration = section === "learn" ? require("../../../assets/illustrations/activity-learn.png") : section === "voice" ? require("../../../assets/illustrations/activity-speak.png") : require("../../../assets/illustrations/activity-chat.png");
      return <View key={row.id} style={s.card}>
        <View style={s.record}><View style={[s.tile, section === "voice" && { backgroundColor: "#E5F1F6" }, section === "tutor" && { backgroundColor: "#EEE8FA" }]}><Image accessible={false} source={illustration} resizeMode="contain" style={s.artImage} /></View><View style={s.recordCopy}><Text style={s.label}>{labels[row.kind]}</Text><Text accessibilityRole="header" style={s.itemTitle}>{row.title}</Text><View style={s.meta}><Text style={s.small}>{section === "learn" ? "Learn" : section === "voice" ? "Speak" : "Chat"}</Text><Text accessible={false} style={s.small}>·</Text><View style={s.badge}><Text style={s.badgeText}>{row.language === "english" ? "English" : "Tagalog"}</Text></View></View></View></View>
        {!!row.prompt && <View style={s.question}><Text style={s.questionText} numberOfLines={expanded === row.id || row.prompt.length <= 160 ? undefined : 3}>{row.prompt}</Text>{row.prompt.length > 160 && <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === row.id }} onPress={() => setExpanded(value => value === row.id ? null : row.id)} style={s.quiet}><Text style={s.quietText}>{expanded === row.id ? "Show less" : "Show full question"}</Text></Pressable>}</View>}
        <Text style={s.small}>{new Date(row.recorded_at).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</Text>
      </View>;
    })}
    <View style={s.row}>{offset > 0 && <PracticeButton secondary label="Newer activity" disabled={loading} onPress={() => setOffset(value => Math.max(0, value - 20))} />}{page?.has_more && !error && <PracticeButton secondary label="Older activity" disabled={loading} onPress={() => setOffset(value => value + 20)} />}</View>
  </View>;
}
