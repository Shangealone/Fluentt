import { useState } from "react";
import { Text, View } from "react-native";
import { Button, EmptyState, ErrorMessage, Loading, s } from "../../components/ui";
import { appendUnit, arrangementResponse, moveUnit, removeUnit, validSequence, type ArrangementItem, type ArrangementResponse } from "./arrangement";

/** Accessible tap/earlier/later controls; host inside Screen for scrolling and keyboard avoidance. */
export function ArrangementQuestion({ item, value, onChange, disabled = false, review = false }: {
  item: ArrangementItem; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean; review?: boolean;
}) {
  const valid = validSequence(item, value);
  function change(next: string[]) { if (!disabled && next !== value) onChange(next); }
  return <View style={[s.card, { gap: 16 }]}>
    <Text style={s.heading} accessibilityRole="header">{item.prompt}</Text>
    {!!item.instructions && <Text style={s.body}>{item.instructions}</Text>}
    <Text style={s.body}>{review ? "Original submitted sequence (read-only). Unit numbers distinguish repeated labels." : "Append each unit once, then move or remove it. Unit numbers distinguish repeated labels. No score is calculated."}</Text>
    {!valid && <ErrorMessage message="The sequence is invalid. Reset it before arranging units." />}
    <Text style={s.heading} accessibilityRole="header">Available units</Text>
    {item.content.items.map((row, index) => <Button key={row.id} secondary
      label={`Append unit ${index + 1}: ${row.text}`} disabled={disabled || !valid || value.includes(row.id)}
      onPress={() => change(appendUnit(item, value, row.id))} />)}
    <Text style={s.heading} accessibilityRole="header">Your sequence</Text>
    {valid && value.map((id, index) => {
      const source = item.content.items.findIndex(row => row.id === id);
      return <View key={id} style={{ gap: 8 }}>
        <Text style={s.body}>{index + 1}. Unit {source + 1}: {item.content.items[source].text}</Text>
        <View style={{ gap: 8 }}>
          <Button label={`Move position ${index + 1} earlier`} secondary disabled={disabled || index === 0} onPress={() => change(moveUnit(value, index, -1))} />
          <Button label={`Move position ${index + 1} later`} secondary disabled={disabled || index === value.length - 1} onPress={() => change(moveUnit(value, index, 1))} />
          <Button label={`Remove position ${index + 1} from sequence`} secondary disabled={disabled} onPress={() => change(removeUnit(value, id))} />
        </View>
      </View>;
    })}
    <Text style={s.body} accessibilityLiveRegion="polite">{review ? `${value.length} units in the submitted sequence.` : arrangementResponse(item, value) ? "All units arranged. Ready; not submitted or scored." : `${valid ? value.length : 0} of ${item.content.items.length} units arranged. Sequence unfinished.`}</Text>
    <Button label="Reset sequence" secondary disabled={disabled || !value.length} onPress={() => change([])} />
  </View>;
}

function Interaction({ item, disabled, onResponse }: { item: ArrangementItem; disabled: boolean; onResponse?: (answer: ArrangementResponse | null) => void }) {
  const [ids, setIds] = useState<string[]>([]);
  return <ArrangementQuestion item={item} value={ids} disabled={disabled} onChange={next => { setIds(next); onResponse?.(arrangementResponse(item, next)); }} />;
}
/** Revision/reset/phase remounts clear local buffers. Hosts own blur/session/attempt cleanup. */
export function UnscoredArrangementPreview({ item, phase = "ready", active = true, resetKey = "", disabled = false, onResponse, onRetry }: {
  item: ArrangementItem | null; phase?: "ready" | "loading" | "error"; active?: boolean; resetKey?: string | number;
  disabled?: boolean; onResponse?: (answer: ArrangementResponse | null) => void; onRetry?: () => void;
}) {
  if (!active) return null;
  if (phase === "loading") return <Loading />;
  if (phase === "error") return <View><ErrorMessage message="Question preview is unavailable." />{onRetry && <Button label="Retry preview" onPress={onRetry} />}</View>;
  if (!item) return <EmptyState title="No question to preview" description="Select an authorized question version first." />;
  return <Interaction key={`${item.id}:${resetKey}`} item={item} disabled={disabled} onResponse={onResponse} />;
}
