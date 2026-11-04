import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../../accessibility/Primitives";
import type { LessonSection, TeacherLessonInput } from "../../services/api/teacherLessons";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";
import { LessonArt, LessonButton, LessonNote, l } from "./LessonUI";
import { sectionIssue, updateSections, type SectionAction } from "./sectionEditing";

type Props = {
  sections: LessonSection[];
  active: number | null;
  onActive: (index: number | null) => void;
  onChange: (sections: LessonSection[]) => void;
  disabled: boolean;
  showValidation: boolean;
  focusRequest: number;
};

export function LessonContentEditor({ sections, active, onActive, onChange, disabled, showValidation, focusRequest }: Props) {
  const [removing, setRemoving] = useState<number | null>(null);
  const [focus, setFocus] = useState(0);
  const heading = useRef<ComponentRef<typeof TextInput>>(null);
  const editor = useRef<ComponentRef<typeof View>>(null);
  const section = active === null ? null : sections[active];
  const blocked = disabled || removing !== null;
  useEffect(() => {
    if (!focus && !focusRequest) return;
    const timer = setTimeout(() => {
      heading.current?.focus();
      // React Native Web exposes its underlying node; native focus stays keyboard-aware.
      const node = editor.current as unknown as { scrollIntoView?: (options: { block: string }) => void } | null;
      node?.scrollIntoView?.({ block: "nearest" });
    }, 0);
    return () => clearTimeout(timer);
  }, [focus, focusRequest]);

  function apply(action: SectionAction) {
    if (disabled) return;
    const result = updateSections(sections, action === "remove" && removing !== null ? removing : active, action);
    if (result.sections === sections) return;
    onChange(result.sections); onActive(result.active); setRemoving(null);
    if (action === "add" || action === "starter" || action === "duplicate") setFocus(value => value + 1);
  }
  function edit(value: Partial<LessonSection>) {
    if (blocked || active === null) return;
    onChange(sections.map((item, index) => index === active ? { ...item, ...value } : item));
  }
  return <View style={l.stack}>
    <Text accessibilityRole="header" style={l.heading}>Build your lesson</Text>
    <Text style={l.body}>Write one part at a time. Your other sections stay right here.</Text>
    <View style={[l.row, l.between]}><Text style={l.label}>Your sections</Text><Text style={l.small}>{sections.length} of 50</Text></View>
    {!sections.length && <View style={l.card}><LessonArt /><Text style={l.heading}>A place for your ideas</Text><Text style={l.body}>Start with one section, or use a simple structure you can make your own.</Text></View>}
    {sections.map((item, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Section ${index + 1}: ${item.heading || "Untitled section"}`} accessibilityState={{ expanded: index === active, disabled: blocked }} disabled={blocked} onPress={() => onActive(index === active ? null : index)} style={[styles.outline, index === active && styles.selected]}>
      <Text style={styles.number}>{index + 1}</Text><View style={l.flex}><Text style={l.label}>{item.heading || "Untitled section"}</Text><Text style={l.small}>{showValidation && sectionIssue(item) ? "Needs attention" : index === active ? "Editing now" : item.body.trim() ? "Text added · Edit section" : "Add lesson text"}</Text></View><PersonalIcon name="chevron" size={16} />
    </Pressable>)}
    {section && active !== null && <View ref={editor} style={l.card}>
      <View style={[l.row, l.between]}><Text accessibilityRole="header" style={l.heading}>Section {active + 1}</Text><Text style={styles.tag}>Editing</Text></View>
      {showValidation && sectionIssue(section) && <LessonNote error>{sectionIssue(section)}</LessonNote>}
      <Text style={l.label}>Section heading</Text><TextInput ref={heading} accessibilityLabel={`Section ${active + 1} heading`} value={section.heading} onChangeText={value => edit({ heading: value })} editable={!blocked} style={l.input} />
      <Text style={l.label}>Lesson text</Text><TextInput accessibilityLabel={`Section ${active + 1} lesson text`} accessibilityHint="Type or paste your lesson text. Saving the draft keeps your changes." placeholder="Type or paste your lesson text here…" placeholderTextColor={c.muted} value={section.body} onChangeText={value => edit({ body: value })} multiline textAlignVertical="top" editable={!blocked} style={[l.input, styles.writing]} />
      <Text style={l.small}>{Array.from(section.body).length.toLocaleString()} / 20,000 characters</Text>
      <View style={styles.actions}><View style={styles.action}><LessonButton label="Move up" quiet disabled={blocked || active === 0} onPress={() => apply("up")} /></View><View style={styles.action}><LessonButton label="Move down" quiet disabled={blocked || active === sections.length - 1} onPress={() => apply("down")} /></View><View style={styles.action}><LessonButton label="Duplicate" quiet disabled={blocked || sections.length >= 50} onPress={() => apply("duplicate")} /></View><View style={styles.action}><LessonButton label="Remove" quiet disabled={blocked} onPress={() => { if (section.heading.trim() || section.body.trim()) setRemoving(active); else apply("remove"); }} /></View></View>
    </View>}
    {removing !== null && <View style={l.card}><Text accessibilityRole="header" style={l.heading}>Remove this section?</Text><Text style={l.body}>“{sections[removing]?.heading || "Untitled section"}” and its lesson text will be removed from this draft.</Text><LessonButton label="Keep section" primary disabled={disabled} onPress={() => setRemoving(null)} /><LessonButton label="Remove section" disabled={disabled} onPress={() => apply("remove")} /></View>}
    <LessonButton label="Add section" disabled={blocked || sections.length >= 50} onPress={() => apply("add")} />
    <LessonButton label="Use starter structure" disabled={blocked || sections.length > 46} onPress={() => apply("starter")} />
    <Text style={l.small}>Adds Introduction, Explanation, Examples, and Practice. Your existing sections stay. Complete each section or remove it before saving.</Text>
    <Text style={l.small}>Up to 50 sections, 200 characters per heading, and 20,000 per lesson text.</Text>
  </View>;
}

export function LessonReadingPreview({ draft, onClose }: { draft: TeacherLessonInput; onClose: () => void }) {
  return <View style={l.stack}><LessonButton label="Back to editing" onPress={onClose} /><Text style={l.small}>STUDENT READING PREVIEW · LOCAL CONTENT</Text><Text accessibilityRole="header" style={l.title}>{draft.title || "Untitled lesson"}</Text>{!!draft.introduction && <Text style={l.body}>{draft.introduction}</Text>}{draft.sections.map((section, index) => <View key={index} style={l.card}><Text accessibilityRole="header" style={l.heading}>{section.heading || "Untitled section"}</Text><Text style={l.reading}>{section.body || "No lesson text yet. Return to editing to finish this section."}</Text></View>)}{!draft.sections.length && <LessonNote>Add a section to preview your lesson content.</LessonNote>}<LessonButton label="Back to editing" onPress={onClose} /></View>;
}

const styles = StyleSheet.create({
  outline: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderWidth: 1, borderColor: c.line, borderRadius: 15, backgroundColor: "#FFFFFF" },
  selected: { borderColor: c.teal, backgroundColor: "#EDF3E8" },
  number: { fontSize: 12, fontWeight: "700", color: c.ink, backgroundColor: "#F0F3EC", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5 },
  tag: { fontSize: 12, color: c.teal, backgroundColor: "#EDF3E8", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  writing: { minHeight: 260, fontSize: 16, lineHeight: 29 },
  actions: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderColor: c.line, paddingTop: 8 },
  action: { width: "50%", minWidth: 0 },
});
