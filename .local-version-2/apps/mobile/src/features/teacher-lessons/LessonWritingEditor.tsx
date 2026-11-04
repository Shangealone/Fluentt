import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, View } from "react-native";
import { Text, TextInput } from "../../accessibility/Primitives";
import type { LessonSection } from "../../services/api/teacherLessons";
import { LessonButton, LessonNote, l } from "./LessonUI";
import { updateSections, type SectionAction } from "./sectionEditing";
import { WritingDisclosure, w } from "./WritingUI";

export const partHeading = (heading: string, index: number) => heading.trim() ? heading : `Lesson part ${index + 1}`;
export function LessonWritingEditor({ sections, active, onActive, onChange, disabled, showValidation, focusRequest }: { sections: LessonSection[]; active: number | null; onActive: (index: number | null) => void; onChange: (sections: LessonSection[]) => void; disabled: boolean; showValidation: boolean; focusRequest: number }) {
  const [menu, setMenu] = useState(false), [removing, setRemoving] = useState(false), [focus, setFocus] = useState(0);
  const body = useRef<ComponentRef<typeof TextInput>>(null), heading = useRef<ComponentRef<typeof TextInput>>(null), editor = useRef<ComponentRef<typeof View>>(null);
  const index = active !== null && sections[active] ? active : 0, section = sections[index];
  const blocked = disabled || removing;
  useEffect(() => { if (!focus && !focusRequest) return; const timer = setTimeout(() => { body.current?.focus(); (editor.current as unknown as { scrollIntoView?: (options: { block: string }) => void })?.scrollIntoView?.({ block: "nearest" }); }, 0); return () => clearTimeout(timer); }, [focus, focusRequest]);
  function apply(action: SectionAction) {
    if (disabled || (action === "starter" && sections.length)) return;
    const next = updateSections(sections, index, action);
    if (next.sections === sections) return;
    onChange(next.sections); onActive(next.active); setRemoving(false); setMenu(false); setFocus(v => v + 1);
  }
  function edit(next: Partial<LessonSection>) { if (!blocked) onChange(sections.map((value, i) => i === index ? { ...value, ...next } : value)); }
  const issue = section ? !section.body.trim() ? "Add some lesson text, or remove this empty part." : Array.from(section.heading).length > 200 ? "Keep the title to 200 characters or fewer." : Array.from(section.body).length > 20000 ? "Keep this part to 20,000 characters or fewer." : null : null;
  return <View style={w.stack}>
    <View style={w.intro}><Text accessibilityRole="header" style={w.title}>Write your lesson</Text><Text style={w.body}>One idea at a time. Make it your own.</Text></View>
    {!!sections.length && <View style={w.menu}><Pressable accessibilityRole="button" accessibilityLabel={`Lesson parts, ${index + 1} of ${sections.length}`} accessibilityState={{ expanded: menu, disabled: blocked }} disabled={blocked} onPress={() => setMenu(v => !v)} style={w.disclosureButton}><Text style={w.link}>Lesson parts · {index + 1} of {sections.length}</Text><Text style={w.link}>{menu ? "⌃" : "⌄"}</Text></Pressable>{menu && sections.map((part, i) => <Pressable key={i} accessibilityRole="button" accessibilityState={{ selected: i === index, disabled: blocked }} disabled={blocked} onPress={() => { onActive(i); setMenu(false); setFocus(v => v + 1); }} style={[w.menuItem, i === index && w.selected]}><Text style={w.link}>{i + 1}. {partHeading(part.heading, i)}{showValidation && !part.body.trim() ? " · Needs text" : ""}</Text></Pressable>)}</View>}
    {section ? <View ref={editor} style={w.sheet}>
      <View style={w.row}><Text style={w.small}>PART {index + 1}</Text><Text style={w.small}>Title optional</Text></View>
      <TextInput ref={heading} accessibilityLabel="Part title, optional" placeholder="Give this part a title" value={section.heading} editable={!blocked} onChangeText={value => edit({ heading: value })} style={w.titleInput} />
      <TextInput ref={body} accessibilityLabel="Lesson text" accessibilityHint="Type or paste text. Save draft saves your whole lesson." placeholder="Type or paste your lesson here…" multiline textAlignVertical="top" value={section.body} editable={!blocked} onChangeText={value => edit({ body: value })} style={w.writing} />
      {issue && (showValidation || Array.from(section.heading).length > 200 || Array.from(section.body).length > 20000) && <Text accessibilityRole="alert" style={w.error}>{issue}</Text>}
      <WritingDisclosure label="More options"><View style={l.row}><View style={l.flex}><LessonButton label="Rename" quiet disabled={blocked} onPress={() => heading.current?.focus()} /><LessonButton label="Move up" quiet disabled={blocked || index === 0} onPress={() => apply("up")} /></View><View style={l.flex}><LessonButton label="Duplicate" quiet disabled={blocked || sections.length >= 50} onPress={() => apply("duplicate")} /><LessonButton label="Move down" quiet disabled={blocked || index === sections.length - 1} onPress={() => apply("down")} /></View></View><LessonButton label="Remove part" quiet disabled={blocked} onPress={() => { if (section.heading.trim() || section.body.trim()) setRemoving(true); else apply("remove"); }} /></WritingDisclosure>
    </View> : <View style={w.stack}><Text style={w.heading}>A place for your ideas</Text><Text style={w.body}>Start writing, or begin with a simple outline.</Text><LessonButton label="Start writing" primary disabled={blocked} onPress={() => apply("add")} /><LessonButton label="Use a starter outline" quiet disabled={blocked} onPress={() => apply("starter")} /></View>}
    {removing && <View style={w.sheet}><Text accessibilityRole="header" style={w.heading}>Remove this part?</Text><Text style={w.body}>“{partHeading(section.heading, index)}” and its writing will be removed from this draft.</Text><LessonButton label="Keep part" primary disabled={disabled} onPress={() => setRemoving(false)} /><LessonButton label="Remove part" disabled={disabled} onPress={() => apply("remove")} /></View>}
    {!!sections.length && <LessonButton label="＋ Add another part" quiet disabled={blocked || sections.length >= 50} onPress={() => apply("add")} />}
    <WritingDisclosure label="About writing your lesson"><LessonNote>Switching parts keeps your writing here. Use Save draft to save it. You can include up to 50 parts, with 200 characters per title and 20,000 per part. An untitled part uses a simple numbered heading.</LessonNote></WritingDisclosure>
  </View>;
}
