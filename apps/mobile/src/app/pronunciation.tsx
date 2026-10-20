import React, { useState, useCallback } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen, Button, Loading, ErrorMessage } from "../components/ui";
import { AppHeader } from "../components/navigation";
import { theme as baseTheme } from "../theme/tokens";
import { pc, p } from "../theme/personal";
import { PersonalScreen } from "../components/PersonalScreen";
import { useSession } from "../session/provider";
import { PronunciationActivityView } from "../services/api/pronunciation";
import { PronunciationPractice } from "../features/pronunciation/PronunciationPractice";
import { LivePronunciationPractice } from "../features/pronunciation/LivePronunciationPractice";
const theme = { colors: { ...baseTheme.colors, primary: pc.navy, ink: pc.ink, muted: pc.muted, border: pc.line } };

export default function PronunciationScreen() {
  const { profile, pronunciation } = useSession();
  const [activities, setActivities] = useState<PronunciationActivityView[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<PronunciationActivityView | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string>(profile?.role === "personal_student" ? profile.language ?? "all" : "all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const profileId = profile?.id;

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
  const Page = personal ? PersonalScreen : Screen;

  return (
    <Page>
      {personal ? selectedActivity ? <View style={p.row}><Text style={p.eyebrow}>Voice studio · Guided practice</Text><Button secondary size="sm" label="Change phrase" onPress={() => setSelectedActivity(null)} /></View> : <View style={{ gap: 8 }}><Text style={p.eyebrow}>Voice studio · Pronunciation</Text><Text accessibilityRole="header" style={p.title}>Find your natural voice.</Text><Text style={p.body}>Slow down. Listen to yourself. Make every word a little clearer.</Text></View> : <AppHeader
        navigation
        title="Learn pronunciation"
        subtitle="Choose a phrase, speak, and listen"
      />}
      <View style={[p.note, { backgroundColor: pc.aqua }]}><Text style={[p.caption, { color: pc.teal }]}>{personal ? "Read aloud · Watch each word turn green as you speak. Finish the whole phrase to complete the practice." : "Guided recording · Read the phrase, record, and listen back. Automated feedback is currently simulated."}</Text></View>

      {/* Language Filter Tabs */}
      {!personal && <View style={styles.tabRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter all languages"
          style={[styles.tabButton, languageFilter === "all" && styles.tabButtonActive]}
          onPress={() => {
            setLanguageFilter("all");
            setSelectedActivity(null);
          }}
        >
          <Text style={[styles.tabText, languageFilter === "all" && styles.tabTextActive]}>
            All Prompts
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter Tagalog prompts"
          style={[styles.tabButton, languageFilter === "tagalog" && styles.tabButtonActive]}
          onPress={() => {
            setLanguageFilter("tagalog");
            setSelectedActivity(null);
          }}
        >
          <Text style={[styles.tabText, languageFilter === "tagalog" && styles.tabTextActive]}>
            🇵🇭 Filipino / Tagalog
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter English prompts"
          style={[styles.tabButton, languageFilter === "english" && styles.tabButtonActive]}
          onPress={() => {
            setLanguageFilter("english");
            setSelectedActivity(null);
          }}
        >
          <Text style={[styles.tabText, languageFilter === "english" && styles.tabTextActive]}>
            🇺🇸 English
          </Text>
        </Pressable>
      </View>}

      {loading ? (
        <View style={styles.centerBox}>
          <Loading />
          <Text style={styles.loadingText}>Loading pronunciation prompts…</Text>
        </View>
      ) : error ? (
        <View style={{ gap: 12 }}>
          <ErrorMessage message={error} />
          <Button label="Retry Loading" variant="secondary" onPress={() => setReload(value => value + 1)} />
        </View>
      ) : selectedActivity ? (
        <View style={{ gap: 16 }}>
          {personal ? <LivePronunciationPractice key={selectedActivity.id} activity={selectedActivity} onDone={() => setSelectedActivity(null)} /> : <PronunciationPractice key={selectedActivity.id}
            activity={selectedActivity}
            api={pronunciation}
            onDone={() => setSelectedActivity(null)}
          />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          <Text style={styles.listHeader}>Select a Phrase to Practice</Text>
          {activities.length === 0 ? (
            <Text style={styles.emptyText}>No activities available for this language.</Text>
          ) : (
            activities.map(act => {
              const isTl = act.language === "tagalog";
              return (
                <Pressable
                  key={act.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Practise pronunciation: ${act.target_text}`}
                  style={styles.card}
                  onPress={() => setSelectedActivity(act)}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.langBadge, isTl ? styles.tagalogBadge : styles.englishBadge]}>
                      <Text style={[styles.langBadgeText, isTl ? styles.tagalogBadgeText : styles.englishBadgeText]}>
                        {isTl ? "Tagalog" : "English"}
                      </Text>
                    </View>
                    <Text style={styles.arrowIcon}>→</Text>
                  </View>
                  <Text style={styles.cardTitle}>{act.target_text}</Text>
                  {act.instructions && (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {act.instructions}
                    </Text>
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  centerBox: {
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.muted,
  },
  listContainer: {
    gap: 12,
    paddingBottom: 32,
  },
  listHeader: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.ink,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.subtle,
    fontStyle: "italic",
    padding: 16,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  langBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagalogBadge: {
    backgroundColor: "#E6F4EA",
  },
  tagalogBadgeText: {
    color: "#137333",
    fontSize: 11,
    fontWeight: "700",
  },
  englishBadge: {
    backgroundColor: "#E8F0FE",
  },
  englishBadgeText: {
    color: "#1A73E8",
    fontSize: 11,
    fontWeight: "700",
  },
  langBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  arrowIcon: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.ink,
    lineHeight: 22,
  },
  cardDesc: {
    fontSize: 13,
    color: theme.colors.muted,
  },
});
