import { useEffect, useRef, useState, type ComponentRef } from "react";
import { PanResponder, Platform, Pressable, Text, View, type ViewStyle } from "react-native";
import { Button } from "../../components/ui";
import { p, pc } from "../../theme/personal";
import type { StarterSentence } from "./beginnerLessons";

export type CardRect = { x: number; y: number; width: number; height: number };
export function containsPoint(rect: CardRect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
/** Insert by the visible row and card midpoint, including wrapped rows. */
export function sentenceDropIndex(rects: CardRect[], x: number, y: number): number {
  const index = rects.findIndex(rect => y < rect.y || (y <= rect.y + rect.height && x < rect.x + rect.width / 2));
  return index < 0 ? rects.length : index;
}
export function placeSentenceCard(answer: string[], id: string, index: number, limit: number): string[] {
  const rest = answer.filter(value => value !== id);
  if (!answer.includes(id) && rest.length >= limit) return answer;
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, id);
  return rest;
}

type CardProps = { text: string; label: string; disabled: boolean; selected: boolean; onTap: () => void; onLift: () => void; onDrop: (x: number, y: number) => void; onCancel: () => void };
export function DraggableWordCard(props: CardProps) {
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  // create stores these callbacks; refs are read only when a gesture fires, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => PanResponder.create({
    // Capture the initial contact so fast diagonal drags cannot leave a small card before capture.
    onStartShouldSetPanResponderCapture: () => !latest.current.disabled,
    onMoveShouldSetPanResponderCapture: (_, gesture) => !latest.current.disabled && (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5),
    onPanResponderGrant: () => { setOffset({ x: 0, y: 0 }); latest.current.onLift(); },
    onPanResponderMove: (_, gesture) => setOffset({ x: gesture.dx, y: gesture.dy }),
    onPanResponderRelease: (_, gesture) => {
      setOffset(null);
      if (Math.abs(gesture.dx) <= 5 && Math.abs(gesture.dy) <= 5) { latest.current.onCancel(); latest.current.onTap(); }
      else latest.current.onDrop(gesture.moveX, gesture.moveY);
    },
    onPanResponderTerminate: () => { setOffset(null); latest.current.onCancel(); },
    onPanResponderTerminationRequest: () => false,
  }));
  return <View {...responder.panHandlers} style={[
    Platform.OS === "web" ? { touchAction: "none" } as ViewStyle : {},
    { zIndex: offset ? 100 : 0 }, offset ? { transform: [{ translateX: offset.x }, { translateY: offset.y }] } : {},
  ]}><Pressable accessibilityRole="button" accessibilityLabel={props.label}
    accessibilityHint="Drag to the sentence area or tap to select. Use the position controls to reorder without dragging."
    accessibilityState={{ disabled: props.disabled }} disabled={props.disabled} onPress={props.onTap}
    style={[{ minHeight: 46, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1,
      borderBottomWidth: 3, borderColor: props.selected ? pc.rose : pc.line, backgroundColor: props.selected ? pc.pink : "white",
      opacity: props.disabled ? 0.6 : 1, zIndex: offset ? 100 : 0, elevation: offset ? 12 : 0 },
      Platform.OS === "web" ? { touchAction: "none", userSelect: "none" } as ViewStyle : {},
      offset ? { backgroundColor: pc.aqua } : {}]}>
    <Text style={{ color: pc.ink, fontSize: 16, fontWeight: "600" }}>{props.text}</Text>
  </Pressable></View>;
}

export function SentenceCards({ item, answer, locked, onChange }: { item: StarterSentence; answer: string[]; locked: boolean; onChange: (value: string[]) => void }) {
  const sentenceRef = useRef<ComponentRef<typeof View>>(null), bankRef = useRef<ComponentRef<typeof View>>(null);
  const cardRefs = useRef<Record<string, ComponentRef<typeof View> | null>>({});
  const bounds = useRef<{ sentence?: CardRect; bank?: CardRect; cards: Record<string, CardRect> }>({ cards: {} });
  const [dragging, setDragging] = useState<string | null>(null), [selected, setSelected] = useState<string | null>(null);
  const dragGeneration = useRef(0);
  const position = selected ? answer.indexOf(selected) : -1;
  const begin = (id: string) => {
    const generation = ++dragGeneration.current;
    // Keep the position controls stable during the gesture so the scroll offset and drop bounds do not jump.
    bounds.current = { cards: {} }; setDragging(id);
    const measure = (view: ComponentRef<typeof View> | null, save: (rect: CardRect) => void) => view?.measureInWindow((x, y, width, height) => {
      if (generation === dragGeneration.current) save({ x, y, width, height });
    });
    measure(sentenceRef.current, rect => { bounds.current.sentence = rect; });
    measure(bankRef.current, rect => { bounds.current.bank = rect; });
    answer.forEach(value => { if (value !== id) measure(cardRefs.current[value], rect => { bounds.current.cards[value] = rect; }); });
  };
  const end = (id: string, x: number, y: number) => {
    dragGeneration.current++; setDragging(null);
    if (locked) return;
    if (bounds.current.sentence && containsPoint(bounds.current.sentence, x, y)) {
      const rest = answer.filter(value => value !== id);
      // Never guess a position from a partially measured row.
      if (rest.some(value => !bounds.current.cards[value])) return;
      const index = sentenceDropIndex(rest.map(value => bounds.current.cards[value]), x, y);
      onChange(placeSentenceCard(answer, id, index, item.orderedIds.length));
      setSelected(id);
    } else if (bounds.current.bank && containsPoint(bounds.current.bank, x, y)) {
      onChange(answer.filter(value => value !== id)); setSelected(null);
    }
  };
  const card = (id: string, chosen: boolean) => {
    const token = item.tokens.find(value => value.id === id)!;
    return <View key={id} ref={view => { if (chosen) cardRefs.current[id] = view; }} collapsable={false} style={{ zIndex: dragging === id ? 100 : 0 }}>
      <DraggableWordCard text={token.text} label={chosen ? `Sentence word ${answer.indexOf(id) + 1}: ${token.text}` : `Add word: ${token.text}`}
        selected={selected === id} disabled={locked} onLift={() => begin(id)} onDrop={(x, y) => end(id, x, y)}
        onCancel={() => { dragGeneration.current++; setDragging(null); }}
        onTap={() => { setSelected(id); if (!chosen && !locked) onChange(placeSentenceCard(answer, id, answer.length, item.orderedIds.length)); }} />
    </View>;
  };
  return <View style={p.card}>
    <View style={p.row}><Text style={p.eyebrow}>Your sentence</Text><Text style={p.caption}>{answer.length} / {item.orderedIds.length} words</Text></View>
    <Text style={p.caption}>Drag cards here in the order you hear. Extra words can stay below.</Text>
    <View ref={sentenceRef} collapsable={false} accessibilityLabel="Sentence drop area" style={{ minHeight: 100, padding: 10, borderWidth: 2, borderStyle: "dashed", borderRadius: 14,
      borderColor: dragging ? pc.rose : pc.line, backgroundColor: pc.background, flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start", gap: 8,
      zIndex: dragging && answer.includes(dragging) ? 10 : 0 }}>
      {answer.length ? answer.map(id => card(id, true)) : <Text style={p.caption}>Drop your first word here — or tap a card below.</Text>}
    </View>
    <Text style={p.eyebrow}>Word cards</Text>
    <View ref={bankRef} collapsable={false} accessibilityLabel="Word card bank" style={{ minHeight: 72, paddingVertical: 8, flexDirection: "row", flexWrap: "wrap", gap: 8, zIndex: dragging && !answer.includes(dragging) ? 10 : 0 }}>
      {item.tokens.filter(token => !answer.includes(token.id)).map(token => card(token.id, false))}
      {answer.length === item.tokens.length && <Text style={p.caption}>All cards are in your sentence.</Text>}
    </View>
    {position >= 0 && !locked && <View style={{ gap: 8 }}><Text style={p.caption}>Selected: {item.tokens.find(token => token.id === selected)?.text} · Position {position + 1}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button secondary size="sm" label="Move earlier" disabled={position === 0} onPress={() => onChange(placeSentenceCard(answer, selected!, position - 1, item.orderedIds.length))} />
        <Button secondary size="sm" label="Move later" disabled={position === answer.length - 1} onPress={() => onChange(placeSentenceCard(answer, selected!, position + 1, item.orderedIds.length))} />
        <Button secondary size="sm" label="Remove word" onPress={() => { onChange(answer.filter(value => value !== selected)); setSelected(null); }} />
      </View></View>}
    <Button secondary size="sm" label="Clear sentence" disabled={locked || !answer.length} onPress={() => { onChange([]); setSelected(null); }} />
  </View>;
}
