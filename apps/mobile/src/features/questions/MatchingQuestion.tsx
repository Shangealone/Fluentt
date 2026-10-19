import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, EmptyState, ErrorMessage, Loading, s } from "../../components/ui";
import { choiceStyles } from "./ChoiceQuestion";
import { assignMatch, matchingResponse, validMatches, type MatchPair, type MatchingItem, type MatchingResponse } from "./matching";

/** Controlled interaction; source numbers distinguish labels. Hosts provide Screen scrolling. */
export function MatchingQuestion({ item, value, selectedLeft, onSelectLeft, onChange, disabled = false, review = false }: {
  item: MatchingItem; value: MatchPair[]; selectedLeft: string | null; onSelectLeft: (id: string | null) => void;
  onChange: (pairs: MatchPair[]) => void; disabled?: boolean; review?: boolean;
}) {
  const valid = validMatches(item, value), selected = item.content.left.findIndex(row => row.id === selectedLeft);
  function change(next: MatchPair[]) { if (!disabled && next !== value) onChange(next); }
  return <View style={[s.card, { gap: 16 }]}>
    <Text style={s.heading} accessibilityRole="header">{item.prompt}</Text>
    {!!item.instructions && <Text style={s.body}>{item.instructions}</Text>}
    <Text style={s.body}>{review ? "Original submitted associations (read-only)." : "Select a left item, then a right item. Each target can be used once. Reusing a target clears its previous association. No score is calculated."}</Text>
    {!valid && <ErrorMessage message="The associations are invalid. Reset before matching." />}
    <Text style={s.heading} accessibilityRole="header">Left items</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Choose a left item" style={{ gap: 12 }}>{item.content.left.map((row, index) => <Pressable key={row.id} accessibilityRole="radio"
      aria-checked={selectedLeft === row.id} aria-disabled={disabled || !valid}
      accessibilityState={{ checked: selectedLeft === row.id, disabled: disabled || !valid }} disabled={disabled || !valid}
      accessibilityLabel={`Left ${index + 1}: ${row.text}`} style={[choiceStyles.option, selectedLeft === row.id && choiceStyles.selected]}
      onPress={() => { if (!disabled && valid) onSelectLeft(selectedLeft === row.id ? null : row.id); }}>
      <Text style={s.body}>Left {index + 1}: {row.text}{selectedLeft === row.id ? " · Selected" : ""}</Text>
    </Pressable>)}</View>
    <Text style={s.body} accessibilityLiveRegion="polite">{selected < 0 ? "Choose a left item first." : `Left ${selected + 1} selected. Choose a right item.`}</Text>
    <Text style={s.heading} accessibilityRole="header">Right items</Text>
    {item.content.right.map((row, index) => <Button key={row.id} secondary label={`Match with right ${index + 1}: ${row.text}`}
      disabled={disabled || !valid || selected < 0} onPress={() => {
        if (!disabled && valid && selected >= 0) { change(assignMatch(item, value, selectedLeft!, row.id)); onSelectLeft(null); }
      }} />)}
    <Text style={s.heading} accessibilityRole="header">Your associations</Text>
    {valid && item.content.left.map((row, index) => {
      const pair = value.find(pair => pair.left_id === row.id), right = item.content.right.findIndex(target => target.id === pair?.right_id);
      return <View key={row.id} style={{ gap: 8 }}>
        <Text style={s.body}>Left {index + 1}: {row.text} → {right < 0 ? "Unmatched" : `Right ${right + 1}: ${item.content.right[right].text}`}</Text>
        {pair && <Button secondary label={`Remove association for left ${index + 1}`} disabled={disabled}
          onPress={() => change(value.filter(pair => pair.left_id !== row.id))} />}
      </View>;
    })}
    <Text style={s.body} accessibilityLiveRegion="polite">{review ? `${value.length} submitted associations.` : matchingResponse(item, value) ? "All items matched. Ready; not submitted or scored." : `${valid ? value.length : 0} of ${item.content.left.length} associations. Unfinished.`}</Text>
    <Button label="Reset matching" secondary disabled={disabled || !value.length && selectedLeft === null} onPress={() => {
      if (!disabled) { change([]); onSelectLeft(null); }
    }} />
  </View>;
}
function Interaction({ item, disabled, onResponse }: { item: MatchingItem; disabled: boolean; onResponse?: (answer: MatchingResponse | null) => void }) {
  const [pairs, setPairs] = useState<MatchPair[]>([]), [left, setLeft] = useState<string | null>(null);
  return <MatchingQuestion item={item} value={pairs} selectedLeft={left} onSelectLeft={setLeft} disabled={disabled}
    onChange={next => { setPairs(next); onResponse?.(matchingResponse(item, next)); }} />;
}
/** Hosts own blur/session/attempt cleanup; revision/reset/phase boundaries discard local state. */
export function UnscoredMatchingPreview({ item, phase = "ready", active = true, resetKey = "", disabled = false, onResponse, onRetry }: {
  item: MatchingItem | null; phase?: "ready" | "loading" | "error"; active?: boolean; resetKey?: string | number;
  disabled?: boolean; onResponse?: (answer: MatchingResponse | null) => void; onRetry?: () => void;
}) {
  if (!active) return null;
  if (phase === "loading") return <Loading />;
  if (phase === "error") return <View><ErrorMessage message="Question preview is unavailable." />{onRetry && <Button label="Retry preview" onPress={onRetry} />}</View>;
  if (!item) return <EmptyState title="No question to preview" description="Select an authorized question version first." />;
  return <Interaction key={`${item.id}:${resetKey}`} item={item} disabled={disabled} onResponse={onResponse} />;
}
