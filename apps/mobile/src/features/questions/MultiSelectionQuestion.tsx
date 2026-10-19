import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, EmptyState, ErrorMessage, Loading, s } from "../../components/ui";
import { choiceStyles } from "./ChoiceQuestion";
import { selectedIds, selectionRows, toggleSelection, type MultiItem, type MultiResponse } from "./multi";

/** Host in Screen for scrolling; whole independently wrapping tokens never use text offsets. */
export function MultiSelectionQuestion({ item, value, disabled = false, review = false, onChange }: {
  item: MultiItem; value: MultiResponse | null; disabled?: boolean; review?: boolean; onChange: (value: MultiResponse) => void;
}) {
  const selected = selectedIds(item, value), tokens = item.method === "error_identification";
  return <View style={[s.card, { gap: 12 }]}>
    <Text style={s.heading} accessibilityRole="header">{item.prompt}</Text>
    {!!item.instructions && <Text style={s.body}>{item.instructions}</Text>}
    <Text style={s.body}>{review ? "Original submitted selections (read-only)." : tokens ? "Select the erroneous segment or segments in reading order." : "Select all options that apply."} {!review && "No configured selection minimum or maximum. This response is unscored."}</Text>
    <View style={[choiceStyles.options, tokens && { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" }]}>
      {selectionRows(item).map((row, index) => <Pressable key={row.id} accessibilityRole="checkbox"
        accessibilityLabel={tokens ? `Segment ${index + 1}: ${row.text}` : row.text}
        accessibilityState={{ checked: selected.includes(row.id), disabled }} aria-checked={selected.includes(row.id)} aria-disabled={disabled}
        disabled={disabled} onPress={() => { if (!disabled) { const next = toggleSelection(item, value, row.id); if (next) onChange(next); } }}
        style={({ pressed }) => [choiceStyles.option, { maxWidth: "100%", minWidth: 0, flexShrink: 1 }, selected.includes(row.id) && choiceStyles.selected,
          { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
        <Text style={choiceStyles.answer}>{selected.includes(row.id) ? "☑" : "☐"} {row.text}</Text>
      </Pressable>)}
    </View>
    <Text style={s.body} accessibilityLiveRegion="polite">{review ? `${selected.length} selections in the submitted response.` : selected.length ? `${selected.length} selected. Not submitted or scored.` : "No selections. Response unfinished."}</Text>
  </View>;
}

function Interaction({ item, disabled, onResponse }: { item: MultiItem; disabled: boolean; onResponse?: (value: MultiResponse | null) => void }) {
  const [value, setValue] = useState<MultiResponse | null>(null);
  return <View style={choiceStyles.options}>
    <MultiSelectionQuestion item={item} value={value} disabled={disabled} onChange={next => { setValue(next); onResponse?.(next); }} />
    <Button label="Reset selections" secondary disabled={disabled || !selectedIds(item, value).length} onPress={() => { setValue(null); onResponse?.(null); }} />
  </View>;
}

/** Hosts discard their own attempt state on blur/session loss; local state resets on remount. */
export function UnscoredMultiPreview({ item, phase = "ready", active = true, resetKey = "", disabled = false, onResponse, onRetry }: {
  item: MultiItem | null; phase?: "ready" | "loading" | "error"; active?: boolean; resetKey?: string | number;
  disabled?: boolean; onResponse?: (value: MultiResponse | null) => void; onRetry?: () => void;
}) {
  if (!active) return null;
  if (phase === "loading") return <Loading />;
  if (phase === "error") return <View><ErrorMessage message="Question preview is unavailable." />{onRetry && <Button label="Retry preview" onPress={onRetry} />}</View>;
  if (!item) return <EmptyState title="No question to preview" description="Select an authorized question version first." />;
  return <Interaction key={`${item.id}:${resetKey}`} item={item} disabled={disabled} onResponse={onResponse} />;
}
