import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, EmptyState, ErrorMessage, Loading, s } from "../../components/ui";
import { theme } from "../../theme/tokens";
import { selectedChoice, selectChoice, type ChoiceItem, type ChoiceResponse } from "./choice";

export function ChoiceQuestion({ item, value, onChange, disabled = false, review = false }: {
  item: ChoiceItem; value: ChoiceResponse | null; onChange: (answer: ChoiceResponse) => void; disabled?: boolean; review?: boolean;
}) {
  const selected = selectedChoice(item, value);
  const options = item.method === "multiple_choice" ? item.content.options.map(option => ({ ...option, value: option.id }))
    : [{ id: "true", text: "True", value: true }, { id: "false", text: "False", value: false }];
  return <View style={s.card}>
    <Text style={s.heading} accessibilityRole="header">{item.prompt}</Text>
    {!!item.instructions && <Text style={s.body}>{item.instructions}</Text>}
    <View accessibilityRole="radiogroup" accessibilityLabel="Choose one answer" style={styles.options}>
      {options.map(option => <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={option.text}
        aria-checked={selected === option.value} aria-disabled={disabled}
        accessibilityState={{ checked: selected === option.value, disabled }} disabled={disabled}
        onPress={() => { if (!disabled) { const next = selectChoice(item, value, option.value); if (next && next !== value) onChange(next); } }}
        style={({ pressed }) => [styles.option, selected === option.value && styles.selected, { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
        <Text style={styles.answer}>{selected === option.value ? "◉" : "○"} {option.text}</Text>
      </Pressable>)}
    </View>
    <Text style={s.body} accessibilityLiveRegion="polite">{review ? "Original submitted selection (read-only)." : selected === null ? "No answer selected." : "One answer selected. This response is not scored."}</Text>
  </View>;
}

function Interaction({ item, onResponse, disabled }: { item: ChoiceItem; onResponse?: (answer: ChoiceResponse | null) => void; disabled: boolean }) {
  const [value, setValue] = useState<ChoiceResponse | null>(null);
  return <View style={styles.options}>
    <ChoiceQuestion item={item} value={value} disabled={disabled} onChange={answer => { setValue(answer); onResponse?.(answer); }} />
    <Button label="Reset selection" secondary disabled={disabled || value === null}
      onPress={() => { setValue(null); onResponse?.(null); }} />
  </View>;
}

/** Hosts unmount on blur or set active=false. Identity/resetKey changes remount with no selection. */
export function UnscoredChoicePreview({ item, phase = "ready", active = true, resetKey = "", disabled = false, onResponse, onRetry }: {
  item: ChoiceItem | null; phase?: "ready" | "loading" | "error"; active?: boolean; resetKey?: string | number;
  disabled?: boolean; onResponse?: (answer: ChoiceResponse | null) => void; onRetry?: () => void;
}) {
  if (!active) return null;
  if (phase === "loading") return <Loading />;
  if (phase === "error") return <View><ErrorMessage message="Question preview is unavailable." />
    {onRetry && <Button label="Retry preview" onPress={onRetry} />}</View>;
  if (!item) return <EmptyState title="No question to preview" description="Select an authorized question version first." />;
  return <Interaction key={`${item.id}:${resetKey}`} item={item} onResponse={onResponse} disabled={disabled} />;
}

export const choiceStyles = StyleSheet.create({
  options: { gap: 12 },
  option: {
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.15s ease",
      },
    }),
  },
  selected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.accent,
  },
  answer: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: theme.colors.ink,
    flexShrink: 1,
  },
});
const styles = choiceStyles;
