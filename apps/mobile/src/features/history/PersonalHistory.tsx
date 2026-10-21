import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, ErrorMessage, Loading } from "../../components/ui";
import { PersonalIcon } from "../../components/PersonalIcon";
import type { HistoryArea, PersonalHistoryAccess, PersonalHistoryPage } from "../../services/api/personalHistory";
import { p, pc } from "../../theme/personal";

export function PersonalHistory({ api, owner, demo }: { api?: PersonalHistoryAccess; owner: string; demo: boolean }) {
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
  return <View style={{ gap: 18 }}>
    <View style={p.note}><Text style={p.eyebrow}>{demo ? "Demo history · This preview only" : "Your personal activity"}</Text>
      <Text style={p.body}>{demo ? "Only actions you take in this sample account appear here. Demo history resets when the preview reloads." : "Your answered questions, finished lesson sets, pronunciation practice and Tutor activity appear here from now on."}</Text>
      <Text style={p.caption}>Earlier unsaved practice cannot be recovered. This is an activity log, not a grade or mastery report. Audio, typed answers and private chats are not saved here.</Text></View>
    <View accessibilityRole="tablist" accessibilityLabel="Filter personal history" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {(["all", "learn", "voice", "tutor"] as const).map(value => <Button key={value} label={value === "all" ? "All activity" : value[0].toUpperCase() + value.slice(1)} secondary={area !== value}
        onPress={() => { setArea(value); setOffset(0); }} />)}
    </View>
    <Button secondary label="Refresh history" onPress={() => setRefresh(value => value + 1)} />
    {loading ? <Loading /> : error ? <ErrorMessage message={error} /> : !page?.items.length ? <View style={p.card}>
      <Text accessibilityRole="header" style={p.heading}>No activity here yet</Text><Text style={p.body}>Answer a question in Learn, finish a Voice phrase, or send a reply in Tutor. Then return here to see it.</Text>
    </View> : page.items.map(row => {
      const section = row.kind.startsWith("learn_") ? "learn" : row.kind === "voice_phrase" ? "voice" : "tutor";
      const labels = { learn_question: "Question answered", learn_lesson: "Lesson set finished", voice_phrase: "Phrase practised", tutor_reply: "Conversation reply sent", tutor_session: "Conversation ended" };
      return <View key={row.id} style={p.card}>
        <View style={p.row}><View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><PersonalIcon name={section} color={pc.rose} /><Text style={p.eyebrow}>{section} · {row.language === "english" ? "English" : "Tagalog"}</Text></View><View style={p.chip}><Text style={p.chipText}>{labels[row.kind]}</Text></View></View>
        <Text accessibilityRole="header" style={p.heading}>{row.title}</Text>
        {!!row.prompt && <><Text style={p.body} numberOfLines={expanded === row.id ? undefined : 3}>{row.prompt}</Text>
          {row.prompt.length > 160 && <Button secondary size="sm" label={expanded === row.id ? "Show less" : "Show full question"} onPress={() => setExpanded(value => value === row.id ? null : row.id)} />}</>}
        <Text style={p.caption}>{new Date(row.recorded_at).toLocaleString()}</Text>
        {section === "voice" && <Text style={p.caption}>Practice recorded · Word recognition is not a pronunciation score.</Text>}
        {section === "tutor" && <Text style={p.caption}>Scenario activity only · Private messages are not copied to History.</Text>}
      </View>;
    })}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{offset > 0 && <Button secondary label="Newer activity" onPress={() => setOffset(value => Math.max(0, value - 20))} />}
      {page?.has_more && !error && <Button label="Older activity" onPress={() => setOffset(value => value + 20)} />}</View>
  </View>;
}
