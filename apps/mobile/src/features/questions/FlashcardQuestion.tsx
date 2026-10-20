import { useEffect, useRef, useState } from "react";
import { BackHandler, Platform, Text, View } from "react-native";
import { Button, EmptyState, ErrorMessage, Loading, s } from "../../components/ui";
import { p, pc } from "../../theme/personal";
import { flashcardResponse, initialCardState, rateCard, recallLabels, revealCard, usableBack, validDeck,
  type FlashcardBack, type FlashcardFront, type FlashcardResponse, type FlashcardState, type PracticeCard, type Recall } from "./flashcards";

/** Back props must already be authorized for practice; hiding text is not server authorization. */
export function FlashcardQuestion({ front, back, value, onChange, disabled = false, onRetry, allowRecallRevision = false, practice = false }: {
  front: FlashcardFront; back: FlashcardBack | null; value: FlashcardState; onChange: (state: FlashcardState) => void;
  disabled?: boolean; onRetry?: () => void; allowRecallRevision?: boolean;
  practice?: boolean;
}) {
  const available = usableBack(front, back), revealed = available && value.revealed;
  function change(next: FlashcardState) { if (!disabled && next !== value) onChange(next); }
  if (practice) return <View style={{ gap: 20 }}>
    <View style={p.card}><Text style={p.eyebrow}>Active recall · Flashcard</Text><Text accessibilityRole="header" style={{ fontSize: 30, fontWeight: "600", letterSpacing: -0.8, color: pc.ink }}>{front.cue}</Text>
      <Text style={p.caption}>{front.prompt}</Text><View style={p.rule} />
      <Text style={p.eyebrow}>{revealed ? "Meaning & explanation" : "Think of your answer"}</Text>
      <Text style={[p.body, { color: pc.ink, fontSize: 16, lineHeight: 26 }]}>{revealed ? back!.back : "Recall the meaning before revealing the card."}</Text>
      {!revealed && <Button label="Reveal back" disabled={disabled || !available} onPress={() => change(revealCard(front, back, value))} />}
    </View>
    {revealed && <><View style={p.note}><Text style={[p.caption, { color: pc.teal }]}>✓ Back revealed</Text><Text style={p.body}>How did that feel? This is your own recall check, not a test score or a review schedule.</Text></View>
      <Text style={p.eyebrow}>Choose your recall experience</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{(Object.keys(recallLabels) as Recall[]).map((rating, index) => <Button key={rating} label={rating.charAt(0).toUpperCase() + rating.slice(1)}
        disabled={disabled || value.recall !== null} onPress={() => change(rateCard(value, rating))} style={{ flex: 1, minWidth: 65, backgroundColor: ["#F9DDE4", "#E5E8EE", pc.navy, pc.teal][index] }} textStyle={{ color: index < 2 ? pc.ink : "white", fontSize: 12 }} />)}</View>
      <Text accessibilityLiveRegion="polite" style={p.caption}>{value.recall ? `You chose ${value.recall}. Nothing is scheduled or saved.` : "Optional · Choose once for this card visit."}</Text></>}
  </View>;
  return <View style={[s.card, { gap: 16 }]}>
    <Text accessibilityRole="header" style={s.heading}>{front.prompt}</Text>
    {!!front.instructions && <Text style={s.body}>{front.instructions}</Text>}
    <Text accessibilityRole="header" style={s.heading}>Front / cue</Text><Text style={s.body}>{front.cue}</Text>
    <Text style={s.body}>Recall silently, then deliberately reveal the back. Ratings describe your recall; they are not test scores.</Text>
    {!available && <><ErrorMessage message="The authorized back for this version is unavailable." />{onRetry && <Button label="Retry card" disabled={disabled} onPress={onRetry} />}</>}
    <Button label="Reveal back" disabled={disabled || !available || revealed} onPress={() => change(revealCard(front, back, value))} />
    {revealed && <View style={{ gap: 12 }}><Text accessibilityRole="header" style={s.heading}>Back</Text><Text style={s.body}>{back!.back}</Text>
      <Text style={s.body}>{allowRecallRevision ? "Unscored assignment recall. You may revise it before final submission; use Save progress to persist it." : "Optional self-recall rating. Choose once per visit; moving to another card clears this local state."}</Text>
      {(Object.keys(recallLabels) as Recall[]).map(rating => <Button key={rating} label={recallLabels[rating]} secondary
        disabled={disabled || (!allowRecallRevision && value.recall !== null)} onPress={() => change(allowRecallRevision ? { ...value, recall: rating } : rateCard(value, rating))} />)}
    </View>}
    <Text style={s.body} accessibilityLiveRegion="polite">{revealed ? value.recall ? `${recallLabels[value.recall]}. ${allowRecallRevision ? "Use Save progress. No score or scheduler update." : "Local only; not saved, scored or scheduled."}` : "Back revealed. No rating selected." : "Back hidden."}</Text>
  </View>;
}

function PracticeInteraction({ cards, onExit, onResponse, onRetry, disabled }: { cards: PracticeCard[]; onExit: () => void;
  onResponse?: (revisionId: string, response: FlashcardResponse) => void; onRetry?: () => void; disabled: boolean }) {
  const [index, setIndex] = useState(0), [state, setState] = useState(initialCardState), [confirmExit, setConfirmExit] = useState(false), [ended, setEnded] = useState(false);
  const rated = useRef(false), exited = useRef(false);
  useEffect(() => {
    if (Platform.OS !== "android" || ended) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => { setConfirmExit(true); return true; });
    return () => listener.remove();
  }, [ended]);
  if (ended) return <EmptyState title="Practice ended" description="Local card state was discarded. No review history was saved." />;
  if (confirmExit) return <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Exit practice?</Text>
    <Text style={s.body}>Discard local reveal and recall state? Nothing has been saved.</Text>
    <Button label="Keep practicing" onPress={() => setConfirmExit(false)} />
    <Button label="Exit and discard" secondary onPress={() => { if (!exited.current) { exited.current = true; setState(initialCardState()); setEnded(true); onExit(); } }} />
  </View>;
  const card = cards[index];
  function move(delta: number) { const next = index + delta; if (!disabled && next >= 0 && next < cards.length) { rated.current = false; setState(initialCardState()); setIndex(next); } }
  return <View style={{ gap: 16 }}>
    <Text style={s.body}>Card {index + 1} of {cards.length}. Authored order; no scheduler or saved history.</Text>
    <FlashcardQuestion front={card.front} back={card.back} value={state} disabled={disabled} onRetry={onRetry} onChange={next => {
      const response = flashcardResponse(next); if (response && rated.current) return;
      setState(next); if (response) { rated.current = true; onResponse?.(card.front.id, response); }
    }} />
    <Button label="Previous card" secondary disabled={disabled || index === 0} onPress={() => move(-1)} />
    <Button label="Next card" secondary disabled={disabled || index === cards.length - 1} onPress={() => move(1)} />
    <Button label="Exit practice" secondary onPress={() => setConfirmExit(true)} />
  </View>;
}
/** Component-only host: callers authorize pinned cards, use Screen and clear buffers on blur/session loss. */
export function FlashcardPractice({ cards, phase = "ready", active = true, resetKey = "", disabled = false, onExit, onResponse, onRetry }: {
  cards: PracticeCard[]; phase?: "ready" | "loading" | "error"; active?: boolean; resetKey?: string | number;
  disabled?: boolean; onExit: () => void; onResponse?: (revisionId: string, response: FlashcardResponse) => void; onRetry?: () => void;
}) {
  if (!active) return null;
  if (phase === "loading") return <Loading />;
  if (phase === "error" || !validDeck(cards)) return <View><ErrorMessage message="Practice content could not be verified." />{onRetry && <Button label="Retry practice" onPress={onRetry} />}</View>;
  if (!cards.length) return <EmptyState title="No flashcards to practice" description="No authorized cards were supplied. No sample cards are added." />;
  return <PracticeInteraction key={JSON.stringify([resetKey, cards.map(card => card.front.id)])} cards={cards} onExit={onExit} onResponse={onResponse} onRetry={onRetry} disabled={disabled} />;
}
