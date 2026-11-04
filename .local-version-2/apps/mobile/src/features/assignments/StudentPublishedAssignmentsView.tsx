import { lessonLevelLabel } from "../../services/api/lessonLevel";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { FluenttLogo } from "../../components/FluenttLogo";
import { PersonalIcon } from "../../components/PersonalIcon";
import { ApiError } from "../../services/api/client";
import type { AssignmentMethod, AssignmentPage, PublishedAssignment } from "../../services/api/assignments";
import { homeColors as c, PersonalDesign } from "../../theme/personal";
import { a, ActivitySheetsArt, publishedDate, StudentAssignmentButton, StudentAssignmentDisclosure } from "./StudentPublishedUI";

type Props = {
  detail: boolean; canLoad: boolean;
  fetch: (offset: number) => Promise<AssignmentPage<PublishedAssignment>>;
  onRefresh: () => void; onBack: (classId?: string) => void; onAccount: () => void;
  onView: (row: PublishedAssignment) => void; onOpen: (row: PublishedAssignment) => void; onResults: (row: PublishedAssignment) => void;
};
const methodLabels: Record<AssignmentMethod, string> = {
  multiple_choice: "Multiple choice", true_false: "True or false", identification: "Identification",
  fill_in_the_blank: "Fill in the blank", multiple_select: "Multiple select", flashcards: "Flashcards",
  error_identification: "Error identification", word_arrangement: "Word arrangement", sentence_arrangement: "Sentence arrangement", matching_type: "Matching",
};

export function StudentPublishedAssignmentsView({ detail, canLoad, fetch, onRefresh, onBack, onAccount, onView, onOpen, onResults }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<{
    fetch: Props["fetch"]; offset: number; retry: number; page?: AssignmentPage<PublishedAssignment>; error?: Error;
  } | null>(null);
  useEffect(() => {
    if (!canLoad) return;
    let active = true;
    void fetch(offset).then(page => {
      if (active) setLoaded({ fetch, offset, retry, page });
    }).catch(cause => {
      if (active) setLoaded({ fetch, offset, retry, error: cause instanceof Error ? cause : new Error("Check your connection and try again.") });
    });
    return () => { active = false; };
  }, [fetch, offset, retry, canLoad]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [offset]);

  // A previous request is never rendered while its replacement is pending.
  const current = loaded?.fetch === fetch && loaded.offset === offset && loaded.retry === retry ? loaded : null;
  const page = current?.page;
  const error = current?.error;
  const loading = canLoad && !page && !error;
  const unavailable = error instanceof ApiError && (error.status === 403 || error.status === 404);
  const row = detail ? page?.items[0] : undefined;
  const back = () => onBack(row?.class_id);
  const narrow = width < 360;
  const enlarged = fontScale > 1.2;

  return <PersonalDesign.Provider value={true}><SafeAreaView edges={["top", "left", "right"]} style={a.screen}>
    <View style={[a.header, narrow && a.narrowHeader]}>
      <Pressable accessibilityRole="button" accessibilityLabel={detail ? "Back to assignments" : "Back to classes"} onPress={back} style={({ pressed }) => [a.circle, a.back, pressed && a.dimmed]}>
        <View style={a.backIcon}><PersonalIcon name="arrow" size={20} color={c.teal} /></View>
      </Pressable>
      <FluenttLogo size={33} />
      <Pressable accessibilityRole="button" accessibilityLabel="My account" onPress={onAccount} style={({ pressed }) => [a.circle, pressed && a.dimmed]}><PersonalIcon name="account" size={20} color={c.ink} /></Pressable>
    </View>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[a.content, narrow && a.narrow]}>
      {!detail && <View style={[a.hero, enlarged && a.stackedHero]}>
        <View style={[a.heroCopy, enlarged && a.stackedCopy]}><Text accessibilityRole="header" style={a.title}>Class assignments</Text><Text style={a.body}>A little practice, one assignment at a time.</Text></View>
        <ActivitySheetsArt compact={narrow} />
      </View>}
      {!row && <View style={a.row}>
        <Text accessibilityRole="header" style={detail ? a.eyebrow : a.heading}>{detail ? "Assignment details" : "Your assignments"}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={detail ? "Refresh assignment" : "Refresh assignments"} disabled={loading || !canLoad}
          accessibilityState={{ disabled: loading || !canLoad }} onPress={onRefresh} style={({ pressed }) => [a.circle, a.refresh, (pressed || loading || !canLoad) && a.dimmed]}>
          <PersonalIcon name="refresh" size={20} color={c.teal} />
        </Pressable>
      </View>}
      {!canLoad && <View style={[a.card, a.state]}>
        <ActivitySheetsArt /><Text accessibilityRole="header" style={[a.heading, a.center]}>{detail ? "Choose an assignment first" : "Choose a class first"}</Text>
        <Text style={[a.body, a.center]}>Open one of your classes to see its assignments.</Text>
        <View style={a.full}><StudentAssignmentButton label="Back to classes" primary onPress={() => onBack()} /></View>
      </View>}
      {loading && <View style={[a.card, a.state]} accessibilityState={{ busy: true }}>
        <View style={a.stateSymbol}><ActivityIndicator color={c.teal} accessibilityLabel="Loading assignments" /></View>
        <Text accessibilityLiveRegion="polite" style={[a.heading, a.center]}>{detail ? "Loading your assignment…" : "Loading your assignments…"}</Text>
        <Text style={[a.body, a.center]}>Getting the latest class activities.</Text>
      </View>}
      {!!error && <View style={[a.card, a.state]}>
        <ActivitySheetsArt />
        <Text accessibilityRole="alert" style={[a.heading, a.center]}>{unavailable ? (detail ? "Assignment unavailable" : "Assignments unavailable") : (detail ? "We couldn’t load this assignment" : "We couldn’t load your assignments")}</Text>
        <Text style={[a.body, a.center]}>{error.message}</Text>
        <View style={a.full}><StudentAssignmentButton label="Try again" primary onPress={() => setRetry(value => value + 1)} /></View>
        {unavailable && <StudentAssignmentButton label={detail ? "Back to assignments" : "Back to classes"} onPress={back} />}
      </View>}
      {page && !page.items.length && <View style={[a.card, a.state]}>
        <ActivitySheetsArt /><Text accessibilityRole="header" style={[a.heading, a.center]}>{detail ? "Assignment unavailable" : "No assignments yet"}</Text>
        <Text style={[a.body, a.center]}>{detail ? "Return to your class assignments to check what’s available." : "Your teacher’s published assignments will appear here. Check back when they’ve shared an activity."}</Text>
        <StudentAssignmentButton label={detail ? "Back to assignments" : "Refresh assignments"} icon={detail ? undefined : "refresh"} onPress={detail ? back : onRefresh} />
      </View>}
      {!detail && page && <>
        <View style={a.list}>{page.items.map(item => <View key={item.id} style={a.card}>
          <View style={a.cardTop}><ActivitySheetsArt small /><Text style={[a.date, enlarged && a.dateLeft]}>{publishedDate(item.published_at)}</Text></View>
          <Text accessibilityRole="header" style={a.cardTitle}>{item.title}</Text>
          <View style={a.lessonRow}><PersonalIcon name="assignments" size={16} color={c.muted} /><Text style={[a.small, a.lessonText]}>{item.context.lesson_name}</Text></View>
          <Text style={a.count}>{item.question_count} {item.question_count === 1 ? "question" : "questions"}</Text>
          <View style={a.actions}><StudentAssignmentButton label="View assignment" accessibilityLabel={`View assignment: ${item.title}`} primary icon="arrow" onPress={() => onView(item)} />
            <StudentAssignmentButton label="View results" accessibilityLabel={`View results: ${item.title}`} icon="stats" onPress={() => onResults(item)} /></View>
        </View>)}</View>
        {(offset > 0 || page.items.length > 0) && <View style={a.pager}>
          <StudentAssignmentButton label="Previous" outlined disabled={offset === 0} onPress={() => setOffset(value => Math.max(0, value - 20))} />
          <Text accessibilityLiveRegion="polite" style={a.small}>Page {Math.floor(offset / 20) + 1}</Text>
          <StudentAssignmentButton label="Next" outlined disabled={!page.has_more} onPress={() => setOffset(value => value + 20)} />
        </View>}
      </>}
      {!!row && <>
        <View style={a.detailIntro}>
          <View style={a.detailTop}><Text style={a.eyebrow}>Assignment details</Text><ActivitySheetsArt small /></View>
          <Text accessibilityRole="header" style={a.title}>{row.title}</Text><Text style={a.small}>{publishedDate(row.published_at)}</Text>
        </View>
        <View style={a.card}>
          <View style={a.context}><Text style={a.body}>Lesson</Text><Text style={a.lessonTitle}>{row.context.lesson_name}</Text></View>
          <Text style={a.count}>{row.question_count} {row.question_count === 1 ? "question" : "questions"}</Text>
          {!!row.instructions && <View style={a.stack}><Text accessibilityRole="header" style={a.heading}>Instructions</Text><Text style={a.instructions}>{row.instructions}</Text></View>}
          <View style={a.stack}><Text style={a.label}>Question types</Text><View style={a.types}>{Array.from(new Set(row.methods)).map(method => <View key={method} style={a.type}><Text style={a.typeText}>{methodLabels[method]}</Text></View>)}</View></View>
        </View>
        <View style={a.stack}><StudentAssignmentButton label="Open assignment" primary icon="arrow" onPress={() => onOpen(row)} />
          <Text style={a.small}>One attempt. Save your answers before leaving.</Text>
          <StudentAssignmentButton label="View results" icon="stats" onPress={() => onResults(row)} />
        </View>
        <StudentAssignmentDisclosure>
          <Text style={a.body}>Curriculum: {row.context.curriculum_name ?? "Teacher lesson"}</Text><Text style={a.body}>{lessonLevelLabel(row.context)}</Text><Text style={a.body}>Subject: {row.context.subject_name}</Text>
          <Text style={a.small}>You have one attempt. You can return to your saved work. Your answers aren’t saved automatically, so save them as you go. There is no timer.</Text>
          <Text style={a.small}>Open assignment takes you to your available attempt or submission receipt. Available results are shown separately in View results.</Text>
          <StudentAssignmentButton label="Refresh assignment" icon="refresh" onPress={onRefresh} />
        </StudentAssignmentDisclosure>
      </>}
    </ScrollView>
  </SafeAreaView></PersonalDesign.Provider>;
}
