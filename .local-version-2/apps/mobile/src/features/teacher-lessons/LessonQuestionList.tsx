import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { PanResponder, Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../accessibility/Primitives";
import type { TeacherQuestion } from "../../services/api/teacherLessons";
import { LessonButton, LessonNote, l } from "./LessonUI";
import { simpleQuestionLabels } from "./SimpleQuestionAuthor";
import { WritingDisclosure, w } from "./WritingUI";

type QuestionText = Pick<TeacherQuestion, "method" | "prompt">;
type Props<T> = {
  questions: T[]; describe: (row: T) => QuestionText; onChange: (rows: T[]) => void;
  onAdd: () => void; onEdit?: (index: number) => void; onPreview: (row: T) => void;
  disabled: boolean; onDragStateChange: (dragging: boolean) => void;
  assignment?: boolean; renderNotice?: (row: T) => ReactNode;
};
type Bounds<T> = { row: T; y: number; height: number };

export function LessonQuestionList(props: Omit<Props<TeacherQuestion>, "describe" | "onAdd" | "assignment" | "renderNotice"> & { onEdit: (index: number) => void }) {
  return <AuthorQuestionList {...props} describe={row => row} onAdd={() => props.onEdit(-1)} />;
}

export function AuthorQuestionList<T extends object>(props: Props<T>) {
  const [reorder, setReorder] = useState(false), [removing, setRemoving] = useState<T | null>(null), [moving, setMoving] = useState<T | null>(null), [working, setWorking] = useState<T[] | null>(null), [announcement, setAnnouncement] = useState("");
  const latest = useRef(props); useLayoutEffect(() => { latest.current = props; });
  const refs = useRef(new Map<T, ComponentRef<typeof View>>());
  const [identity, setIdentity] = useState(() => ({ source: props.questions, keys: props.questions.map((row, i) => ({ row, id: i + 1 })), next: props.questions.length + 1 }));
  if (identity.source !== props.questions) {
    let next = identity.next;
    const keys = props.questions.map(row => identity.keys.find(entry => entry.row === row) ?? { row, id: next++ });
    setIdentity({ source: props.questions, keys, next });
  }
  const drag = useRef<{ row: T; order: T[]; bounds: Bounds<T>[] } | null>(null);
  const key = (row: T) => identity.keys.find(entry => entry.row === row)?.id ?? -1;
  const cancel = useCallback(() => { drag.current = null; setWorking(null); setMoving(null); latest.current.onDragStateChange(false); }, []);
  useEffect(() => { if (props.disabled) cancel(); }, [props.disabled, cancel]);
  useEffect(() => () => { drag.current = null; latest.current.onDragStateChange(false); }, []);
  function begin(row: T) {
    if (latest.current.disabled || drag.current) return;
    const operation = { row, order: [...latest.current.questions], bounds: [] as Bounds<T>[] }; drag.current = operation;
    setMoving(row); setWorking(operation.order); latest.current.onDragStateChange(true);
    for (const question of operation.order) refs.current.get(question)?.measureInWindow((_x, y, _width, height) => { if (drag.current === operation) operation.bounds.push({ row: question, y, height }); });
  }
  function move(y: number) {
    const operation = drag.current; if (!operation || latest.current.disabled) return;
    const position = operation.bounds.find(bound => y >= bound.y && y <= bound.y + bound.height); if (!position) return;
    const from = operation.order.indexOf(operation.row), to = latest.current.questions.indexOf(position.row);
    if (from === to || from < 0 || to < 0) return;
    const next = [...operation.order]; next.splice(from, 1); next.splice(to, 0, operation.row); operation.order = next; setWorking(next);
  }
  function finish(commit: boolean) {
    const operation = drag.current;
    if (commit && operation && !latest.current.disabled) {
      if (operation.order.some((row, i) => row !== latest.current.questions[i])) latest.current.onChange(operation.order);
      setAnnouncement(`Question moved to position ${operation.order.indexOf(operation.row) + 1} of ${operation.order.length}. Save draft to save this order.`);
    }
    cancel();
  }
  function shift(row: T, delta: number) {
    if (props.disabled || drag.current) return;
    const from = props.questions.indexOf(row), to = from + delta; if (from < 0 || to < 0 || to >= props.questions.length) return;
    const next = [...props.questions]; next.splice(from, 1); next.splice(to, 0, row); props.onChange(next); setAnnouncement(`Question moved to position ${to + 1}. Save draft to save this order.`);
  }
  const display = working ?? props.questions;
  const draft = props.assignment ? "assignment" : "lesson";
  return <View style={w.stack}>
    <View style={w.intro}><Text accessibilityRole="header" style={w.title}>A little practice</Text><Text style={w.body}>{reorder ? "Put your questions in the order you want students to see." : props.assignment ? "Create a question or browse the questions for this lesson." : "Add questions, or keep this a reading-only lesson."}</Text></View>
    {reorder ? <><View style={styles.toolbar}><Text style={[l.label, l.flex]}>⠿ Reorder questions</Text><View style={{ width: 88 }}><LessonButton label="✓ Done" quiet disabled={props.disabled || !!moving} onPress={() => setReorder(false)} /></View></View><Text style={w.body}>Hold a card or its grip, then drag it up or down.</Text></> : <><LessonButton label="＋ Add a question" primary disabled={props.disabled || props.questions.length >= 200} onPress={props.onAdd} />{props.questions.length > 1 && <LessonButton label="↕ Reorder questions" quiet disabled={props.disabled} onPress={() => setReorder(true)} />}</>}
    {!props.questions.length && <View style={w.sheet}><Text style={w.heading}>Questions can come later</Text><Text style={w.body}>{props.assignment ? "You can save your draft now and add questions before publishing." : "Your lesson can be shared as a reading lesson."}</Text></View>}
    {display.map((q, i) => {
      const { method, prompt } = props.describe(q);
      return <QuestionRow key={key(q)} enabled={reorder && !props.disabled} register={node => { if (node) refs.current.set(q, node); else refs.current.delete(q); }} onBegin={() => begin(q)} onMove={move} onFinish={finish} onShift={delta => shift(q, delta)} index={i} moving={moving === q}>
      <Text style={w.number}>{i + 1}</Text><View style={[w.flex, { gap: 8 }]}><Text style={w.small}>{simpleQuestionLabels[method]}</Text><Text style={l.label}>{method === "fill_in_the_blank" ? prompt.replace(/\{\{[A-Za-z0-9_-]+\}\}/g, "_____") : prompt}</Text>
        {props.renderNotice?.(q)}
        {reorder ? <WritingDisclosure label="Move this question"><LessonButton label="Move up" quiet disabled={props.disabled || !!moving || i === 0} onPress={() => shift(q, -1)} /><LessonButton label="Move down" quiet disabled={props.disabled || !!moving || i === props.questions.length - 1} onPress={() => shift(q, 1)} /></WritingDisclosure> : <><View style={l.row}>{props.onEdit && <View style={l.flex}><LessonButton label="Edit" quiet disabled={props.disabled} onPress={() => props.onEdit?.(i)} /></View>}<View style={l.flex}><LessonButton label="Preview" quiet disabled={props.disabled} onPress={() => props.onPreview(q)} /></View></View><WritingDisclosure label="More options"><LessonButton label="Remove question" quiet disabled={props.disabled} onPress={() => setRemoving(q)} /></WritingDisclosure></>}
      </View>
    </QuestionRow>;
    })}
    {!!announcement && <Text accessibilityLiveRegion="polite" style={w.link}>{announcement}</Text>}
    {reorder && <Text style={w.small}>Done keeps this order in your draft. Use Save draft to save it.</Text>}
    {removing && props.questions.includes(removing) && <View style={w.sheet}><Text accessibilityRole="header" style={w.heading}>Remove this question?</Text><Text style={w.body}>It will be removed from this {draft} draft.</Text><LessonButton label="Keep question" primary disabled={props.disabled} onPress={() => setRemoving(null)} /><LessonButton label="Remove question" disabled={props.disabled} onPress={() => { props.onChange(props.questions.filter(q => q !== removing)); setRemoving(null); }} /></View>}
    {props.questions.length >= 200 && <LessonNote>This {draft} has reached its 200-question limit.</LessonNote>}
  </View>;
}

function QuestionRow(props: { children: ReactNode; index: number; moving: boolean; enabled: boolean; register: (node: ComponentRef<typeof View> | null) => void; onBegin: () => void; onMove: (y: number) => void; onFinish: (commit: boolean) => void; onShift: (delta: number) => void }) {
  const node = useRef<ComponentRef<typeof View>>(null), handle = useRef<ComponentRef<typeof View>>(null), current = useRef(props); useLayoutEffect(() => { current.current = props; });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), armed = useRef(false);
  const stop = useCallback((commit: boolean) => { if (timer.current) clearTimeout(timer.current); timer.current = null; if (armed.current) current.current.onFinish(commit); armed.current = false; }, []);
  const start = useCallback(() => { if (!current.current.enabled) return; stop(false); timer.current = setTimeout(() => { armed.current = true; current.current.onBegin(); }, 350); }, [stop]);
  // PanResponder registers these callbacks; ref values are read only on gestures.
  // eslint-disable-next-line react-hooks/refs
  const [native] = useState(() => PanResponder.create({ onStartShouldSetPanResponder: () => current.current.enabled, onMoveShouldSetPanResponderCapture: () => armed.current, onPanResponderGrant: () => { if (!armed.current) start(); }, onPanResponderMove: (_event, gesture) => { if (armed.current) current.current.onMove(gesture.moveY); else if (Math.abs(gesture.dy) > 9) stop(false); }, onPanResponderRelease: () => stop(true), onPanResponderTerminate: () => stop(false), onPanResponderTerminationRequest: () => !armed.current }));
  useEffect(() => {
    if (Platform.OS !== "web" || !props.enabled) return;
    const element = node.current as unknown as HTMLElement;
    // Capture on the stationary list, not the card that moves during sorting.
    const capture = element.parentElement ?? element;
    const oldTouchAction = element.style.touchAction, oldSelection = element.style.userSelect;
    element.style.touchAction = "none"; element.style.userSelect = "none";
    let pointer: number | null = null, x = 0, y = 0;
    const down = (event: PointerEvent) => { if (event.button !== 0 || (event.target as HTMLElement).closest('button:not([data-testid="question-drag-handle"]),input')) return; pointer = event.pointerId; x = event.clientX; y = event.clientY; start(); capture.setPointerCapture(pointer); };
    const move = (event: PointerEvent) => { if (pointer !== event.pointerId) return; if (armed.current) { event.preventDefault(); current.current.onMove(event.clientY); } else if (Math.hypot(event.clientX - x, event.clientY - y) > 9) stop(false); };
    const end = (event: PointerEvent) => { if (pointer !== event.pointerId) return; stop(event.type === "pointerup"); const id = pointer; pointer = null; if (capture.hasPointerCapture(id)) capture.releasePointerCapture(id); };
    const blur = () => { stop(false); if (pointer !== null && capture.hasPointerCapture(pointer)) capture.releasePointerCapture(pointer); pointer = null; };
    const key = (event: KeyboardEvent) => { if (event.target !== (handle.current as unknown) || !["ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); current.current.onShift(event.key === "ArrowUp" ? -1 : 1); requestAnimationFrame(() => (handle.current as unknown as HTMLElement)?.focus()); };
    const context = (event: Event) => event.preventDefault();
    element.addEventListener("pointerdown", down); document.addEventListener("pointermove", move, { passive: false }); document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end); capture.addEventListener("lostpointercapture", end); window.addEventListener("blur", blur); element.addEventListener("keydown", key); element.addEventListener("contextmenu", context);
    return () => { blur(); element.style.touchAction = oldTouchAction; element.style.userSelect = oldSelection; element.removeEventListener("pointerdown", down); document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", end); document.removeEventListener("pointercancel", end); capture.removeEventListener("lostpointercapture", end); window.removeEventListener("blur", blur); element.removeEventListener("keydown", key); element.removeEventListener("contextmenu", context); };
  }, [props.enabled, start, stop]);
  useEffect(() => () => stop(false), [stop]);
  return <View ref={value => { node.current = value; props.register(value); }} {...(Platform.OS !== "web" && props.enabled ? native.panHandlers : {})} style={[styles.card, props.moving && styles.moving]}>
    {props.children}{props.enabled && <Pressable ref={handle} testID="question-drag-handle" accessibilityRole="button" accessibilityLabel={`Move question ${props.index + 1}`} accessibilityHint="Hold and drag, or use arrow keys or Move this question controls." delayLongPress={350} onLongPress={Platform.OS === "web" ? undefined : () => { if (!armed.current && current.current.enabled) { armed.current = true; current.current.onBegin(); } }} onTouchEnd={Platform.OS === "web" ? undefined : () => stop(true)} onTouchCancel={Platform.OS === "web" ? undefined : () => stop(false)} style={styles.grip}><Text style={styles.gripText}>⠿</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({ card: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderColor: "#E4EBE5", borderRadius: 18, padding: 16, backgroundColor: "#FFFFFF" }, moving: { borderColor: "#4C8B71", backgroundColor: "#F9FCF3" }, grip: { width: 44, minHeight: 52, justifyContent: "center", alignItems: "center", backgroundColor: "#F0F4EB", borderRadius: 12 }, gripText: { color: "#749385", fontSize: 24 }, toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 14, backgroundColor: "#EDF3E5", gap: 5 } });
