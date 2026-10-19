import { useRef, useState, type ComponentRef } from "react";
import { Text, TextInput, View } from "react-native";
import { Button, EmptyState, ErrorMessage, Loading, s } from "../../components/ui";
import { codepoints, fieldIds, textErrors, textPrompt, textResponse, type TextItem, type TextResponse, type TextValues } from "./text";

/** Host inside the established Screen for scroll/keyboard avoidance; no learner route is exposed. */
export function TextQuestion({ item, value, onChange, disabled = false, review = false }: {
  item: TextItem; value: TextValues; onChange: (values: TextValues) => void; disabled?: boolean; review?: boolean;
}) {
  const inputs = useRef<Record<string, ComponentRef<typeof TextInput> | null>>(Object.create(null));
  const ids = fieldIds(item), errors = textErrors(item, value), limit = item.content.input_max_length;
  return <View style={[s.card, { gap: 16 }]}>
    <Text style={s.heading} accessibilityRole="header">{textPrompt(item)}</Text>
    {!!item.instructions && <Text style={s.body}>{item.instructions}</Text>}
    <Text style={s.body}>{limit === undefined ? "No declared input limit." : `Up to ${limit} Unicode code points per answer.`} Raw text is preserved. No automatic grading is performed.</Text>
    {ids.map((id, index) => {
      const label = item.method === "identification" ? "Your answer" : `Gap ${index + 1}`;
      const raw = Object.hasOwn(value, id) ? value[id] : "";
      const error = raw ? errors[id] : null;
      return <View key={id} style={{ gap: 8 }}>
        <Text style={s.body} nativeID={`answer-label-${index}`}>{label}</Text>
        <TextInput ref={node => { inputs.current[id] = node; }} style={s.input} value={raw} editable={!disabled} multiline
          accessibilityLabel={label} accessibilityHint={error || (limit === undefined ? "Raw text answer" : `Maximum ${limit} Unicode code points`)}
          aria-invalid={!!error} aria-disabled={disabled} accessibilityState={{ disabled }}
          autoCorrect={false} autoCapitalize="none" autoComplete="off" spellCheck={false}
          enterKeyHint={index < ids.length - 1 ? "next" : "done"} submitBehavior={index < ids.length - 1 ? "submit" : "blurAndSubmit"}
          onSubmitEditing={() => { if (!disabled && index < ids.length - 1) inputs.current[ids[index + 1]]?.focus(); }}
          onChangeText={text => { if (!disabled) onChange({ ...value, [id]: text }); }} />
        <Text style={s.body}>{codepoints(raw)} code points</Text>
        {!!error && <ErrorMessage message={error} />}
      </View>;
    })}
    <Text style={s.body} accessibilityLiveRegion="polite">{review ? "Original submitted text (read-only, without normalization)." : textResponse(item, value) ? "Response complete. Not submitted or scored." : "Complete every answer within its declared limit."}</Text>
  </View>;
}

function Interaction({ item, disabled, onResponse }: { item: TextItem; disabled: boolean; onResponse?: (answer: TextResponse | null) => void }) {
  const [values, setValues] = useState<TextValues>({});
  return <View style={{ gap: 12 }}>
    <TextQuestion item={item} value={values} disabled={disabled} onChange={next => { setValues(next); onResponse?.(textResponse(item, next)); }} />
    <Button label="Reset answers" secondary disabled={disabled || !Object.values(values).some(Boolean)} onPress={() => { setValues({}); onResponse?.(null); }} />
  </View>;
}

/** Revision/reset identity remounts local buffers. Hosts clear their own state on blur/session loss. */
export function UnscoredTextPreview({ item, phase = "ready", active = true, resetKey = "", disabled = false, onResponse, onRetry }: {
  item: TextItem | null; phase?: "ready" | "loading" | "error"; active?: boolean; resetKey?: string | number;
  disabled?: boolean; onResponse?: (answer: TextResponse | null) => void; onRetry?: () => void;
}) {
  if (!active) return null;
  if (phase === "loading") return <Loading />;
  if (phase === "error") return <View><ErrorMessage message="Question preview is unavailable." />{onRetry && <Button label="Retry preview" onPress={onRetry} />}</View>;
  if (!item) return <EmptyState title="No question to preview" description="Select an authorized question version first." />;
  return <Interaction key={`${item.id}:${resetKey}`} item={item} disabled={disabled} onResponse={onResponse} />;
}
