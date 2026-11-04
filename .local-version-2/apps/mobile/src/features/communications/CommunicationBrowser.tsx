import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, View } from "react-native";
import { Text, TextInput, useWindowDimensions } from "../../accessibility/Primitives";

import { router as expoRouter, useFocusEffect, usePreventRemove } from "expo-router";
import * as Crypto from "expo-crypto";
import { PersonalIcon } from "../../components/PersonalIcon";
import { homeColors as c } from "../../theme/personal";
import { messageError, type CommunicationAccess, type CommunicationContext, type Message } from "../../services/api/communications";
import { messageNavigation, MessageSubmission } from "./state";
import { AboutMessages, Action, classroomArt, CommunicationPage, Hero, m, SearchField, SectionHeading } from "./CommunicationUI";

// Explicit navigation also covers pushes, which do not trigger usePreventRemove.
const router = {
  push: (...args: Parameters<typeof expoRouter.push>) => messageNavigation.request(() => expoRouter.push(...args)),
  replace: (...args: Parameters<typeof expoRouter.replace>) => messageNavigation.request(() => expoRouter.replace(...args)),
};

function messageDate(value: string) {
  const date = new Date(value), now = new Date(), yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const day = date.toDateString() === now.toDateString() ? "Today" : date.toDateString() === yesterday.toDateString() ? "Yesterday" : date.toLocaleDateString();
  return `${day} · ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function MessageCard({ row, viewerId, onOpen }: { row: Message; viewerId?: string; onOpen?: () => void }) {
  const sent = row.sender.id === viewerId;
  const unread = !sent && !row.read;
  return <View style={m.card}>
    {row.kind === "announcement" && <View style={m.announcementTag}><Text style={m.announcementText}>Class announcement</Text></View>}
    <View style={m.messageTop}>
      <View style={m.avatar}><Text accessible={false} style={m.avatarText}>{row.sender.username.slice(0, 1).toUpperCase()}</Text></View>
      <View style={m.authorCopy}><Text accessibilityRole="header" style={m.cardTitle}>{row.sender.username}</Text><Text style={[m.caption, m.messageDate]}>{messageDate(row.sent_at)}</Text></View>
    </View>
    <Text selectable style={m.body}>{row.content}</Text>
    <View style={m.messageActions}>
      <View style={m.status}>{unread && <View accessible={false} style={m.unreadDot} />}<Text style={m.statusText}>{sent ? "Sent" : row.read ? "Read" : "Unread"}</Text></View>
      {onOpen && <Action label="Open message" quiet icon="arrow" accessibilityLabel={`Open message from ${row.sender.username} at ${messageDate(row.sent_at)}`} onPress={onOpen} />}
    </View>
  </View>;
}

export function MessageComposer({ api, classId, studentId, onSent, onUnavailable, collapsible = false }: {
  api: CommunicationAccess; classId: string; studentId?: string; onSent: (row: Message) => void; onUnavailable?: (cause: unknown) => void; collapsible?: boolean;
}) {
  const [text, setText] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [submission] = useState(() => new MessageSubmission());
  const [leaving, setLeaving] = useState<(() => void) | null>(null), [expanded, setExpanded] = useState(!collapsible);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [approved, setApproved] = useState<(() => void) | null>(null);
  useEffect(() => { if (approved && !text && !busy && !submission.pending) { setApproved(null); approved(); } }, [approved, text, busy, submission]);
  useFocusEffect(useCallback(() => messageNavigation.register(action => {
    if (submission.busy || busy) return;
    if (text || submission.pending) setLeaving(() => action);
    else action();
  }), [submission, text, busy]));
  usePreventRemove(!!text || !!submission.pending || busy, ({ repeat }) => {
    if (!submission.busy && !busy) setLeaving(() => repeat);
  });
  async function send() {
    if (submission.busy) return;
    if (messageError(submission.pending?.content ?? text)) { setError("Write a plain-text message using 1–4,000 characters."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const row = await submission.send(text, (body, key) => api.send(classId, studentId, body, key), Crypto.randomUUID);
      if (alive.current) {
        setText(""); setNotice(studentId ? "Message sent." : "Announcement posted.");
        if (collapsible) setExpanded(false);
        onSent(row);
      }
    } catch (cause) {
      if (alive.current) { setError(cause instanceof Error ? cause.message : "We couldn’t send this message. Please try again."); onUnavailable?.(cause); }
    } finally { if (alive.current) setBusy(false); }
  }
  function toggle() {
    if (submission.busy || busy) return;
    if (!expanded) { setExpanded(true); return; }
    if (text || submission.pending || busy) setLeaving(() => () => setExpanded(false));
    else setExpanded(false);
  }
  return <View style={m.composerHost}>
    {collapsible && <Action label={expanded ? "Close announcement" : "Write an announcement"} primary disabled={busy} expanded={expanded} onPress={toggle} />}
    {!!notice && <Text accessibilityLiveRegion="polite" style={m.success}>{notice}</Text>}
    {leaving && <Modal transparent animationType="fade" visible onRequestClose={() => setLeaving(null)}>
      <View style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.35)" }}>
      <View accessibilityViewIsModal accessibilityRole="alert" style={[m.card, m.leave]}>
      <Text accessibilityRole="header" style={m.cardTitle}>Leave this message?</Text>
      <Text style={m.caption}>Your unsent text will be cleared. If a send was interrupted, check your messages before sending it again.</Text>
      <Action label="Keep writing" onPress={() => setLeaving(null)} />
      <Action label="Discard and leave" quiet disabled={busy} onPress={() => { const repeat = leaving; setText(""); submission.discard(); setLeaving(null); setApproved(() => repeat); }} />
    </View></View></Modal>}
    {expanded && <View style={[m.card, m.composer]}>
      <Text accessibilityRole="header" style={m.cardTitle}>{studentId ? "Write a message" : "Write an announcement"}</Text>
      <View><Text style={m.label}>{studentId ? "Your message" : "What would you like your class to know?"}</Text>
        <TextInput accessibilityLabel={studentId ? "Your message" : "Class announcement"} multiline value={text} editable={!busy && !submission.pending}
          onChangeText={value => { setText(value); setError(""); setNotice(""); }} placeholder={studentId ? "Write your message…" : "Share a class update…"} placeholderTextColor="#88958D" style={[m.input, m.textarea]} textAlignVertical="top" />
      </View>
      <View style={m.composeMeta}><Text style={m.caption}>Text only</Text><Text style={[m.caption, m.counter]}>{[...text].length} / 4,000</Text></View>
      {!!error && <Text accessibilityRole="alert" style={m.error}>{error}</Text>}
      {submission.pending && <Text accessibilityRole="alert" style={m.notice}>We couldn’t confirm this was sent. Retry the same message, or check your messages before writing it again.</Text>}
      <Action label={busy ? "Sending…" : submission.pending ? "Retry same message" : studentId ? "Send message" : "Post announcement"} primary busy={busy}
        disabled={busy || !!messageError(submission.pending?.content ?? text)} onPress={() => void send()} />
    </View>}
  </View>;
}

export function MessageHistory({ api, classId, studentId, viewerId, refresh, onUnavailable }: {
  api: CommunicationAccess; classId: string; studentId?: string; viewerId: string; refresh: number; onUnavailable?: (cause: unknown) => void;
}) {
  const anchor = useRef<string | undefined>(undefined), [selected, setSelected] = useState<string | null>(null), [readRefresh, setReadRefresh] = useState(0);
  const history = useCallback(async (offset: number) => {
    const page = await api.history(classId, studentId, offset, anchor.current).catch(cause => { onUnavailable?.(cause); throw cause; });
    anchor.current ??= page.as_of;
    return page;
  }, [api, classId, studentId, onUnavailable]);
  const detail = useCallback(async () => {
    const row = await api.detail(classId, selected!).catch(cause => { onUnavailable?.(cause); throw cause; });
    const marked = row.read ? row : await api.read(classId, row.id).catch(cause => { onUnavailable?.(cause); throw cause; });
    return { items: [marked], offset: 0, limit: 1, has_more: false };
  }, [api, classId, selected, onUnavailable]);
  return <View>
    {selected ? <>
      <Action label="Back to messages" quiet onPress={() => { setSelected(null); setReadRefresh(value => value + 1); }} />
      <CommunicationPage key={selected} fetch={detail} loadingLabel="Opening your message…" render={row => <MessageCard key={row.id} row={row} viewerId={viewerId} />} />
    </> : <>
      <Text style={[m.caption, m.newest]}>Newest first</Text>
      <CommunicationPage key={`${refresh}:${readRefresh}`} fetch={history}
        emptyTitle={studentId ? "Start a conversation" : "No announcements yet"}
        emptyDescription={studentId ? "Write a message above when you need to get in touch." : "Class announcements will appear here."}
        render={row => <MessageCard key={row.id} row={row} viewerId={viewerId} onOpen={() => setSelected(row.id)} />} />
    </>}
  </View>;
}

export function ClassCommunication({ api, context, studentId, initialMode }: { api: CommunicationAccess; context: CommunicationContext; studentId?: string; initialMode?: string }) {
  const classId = context.classroom.id, instructor = context.role === "instructor";
  const { fontScale } = useWindowDimensions();
  const [tab] = useState<"announcements" | "direct">(studentId || initialMode === "direct" ? "direct" : "announcements");
  const [refresh, setRefresh] = useState(0), [search, setSearch] = useState(""), [q, setQ] = useState("");
  // Refresh server lists on focus without remounting the local composer.
  useFocusEffect(useCallback(() => { setRefresh(value => value + 1); }, []));
  const [denied, setDenied] = useState(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const onUnavailable = useCallback((cause: unknown) => { if (alive.current && [403, 404].includes((cause as { status?: number }).status ?? 0)) setDenied(true); }, []);
  const selectedStudent = instructor ? studentId : context.viewer.id;
  const people = useCallback((offset: number) => api.participants(classId, q, offset), [api, classId, q]);
  const refreshContext = () => router.replace({ pathname: "/communication", params: { classId, studentId, mode: tab, refresh: Crypto.randomUUID() } });
  if (denied) return <View style={[m.card, m.stateCard]}>
    <Text accessibilityRole="header" style={m.stateTitle}>This conversation is no longer available</Text><Text accessibilityRole="alert" style={m.stateMessage}>Your class or conversation access has changed. Recheck access to continue.</Text><Action label="Recheck access" primary onPress={refreshContext} />
  </View>;
  return <View>
    <Hero className={context.classroom.class_name} />
    <View style={m.classChange}><Action label="Choose another class" quiet onPress={() => router.replace("/communication")} /></View>
    <View accessibilityRole="tablist" accessibilityLabel="Class messages" style={m.tabs}>
      {(["announcements", "direct"] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} aria-selected={tab === value}
        onPress={() => { if (value !== tab) router.replace({ pathname: "/communication", params: { classId, mode: value } }); }}
        style={({ pressed }) => [m.tab, tab === value && m.selectedTab, fontScale > 1.2 && m.tabStack, pressed && m.pressed]}>
        {value === "announcements" ? <Image accessible={false} source={require("../../../assets/icons/speaker.png")} resizeMode="contain" style={m.tabImage} /> : <PersonalIcon name="tutor" size={17} color={tab === value ? c.teal : c.muted} />}
        <Text style={[m.tabText, tab === value && m.selectedTabText]}>{value === "announcements" ? "Announcements" : "Messages"}</Text>
      </Pressable>)}
    </View>
    {tab === "announcements" ? <>
      {!instructor && <Text style={m.caption}>Class updates from {context.instructor.username}. Announcements don’t accept replies.</Text>}
      {instructor && <MessageComposer collapsible onUnavailable={onUnavailable} api={api} classId={classId} onSent={() => setRefresh(value => value + 1)} />}
      <SectionHeading title="Class announcements" onRefresh={refreshContext} />
      <MessageHistory onUnavailable={onUnavailable} key={`announcements:${refresh}`} api={api} classId={classId} viewerId={context.viewer.id} refresh={refresh} />
    </> : instructor && !selectedStudent ? <>
      <SearchField label="Search students" placeholder="Student username" value={search} onChange={setSearch} onSearch={() => setQ(search)} />
      <SectionHeading title="Your students" onRefresh={refreshContext} />
      <Text style={[m.caption, m.peerCaption]}>Choose a student to start or continue a private conversation.</Text>
      <CommunicationPage key={`${q}:${refresh}`} fetch={people} loadingLabel="Loading your students…" errorTitle="We couldn’t load your students" emptyTitle={q ? "No matching students" : "No students yet"}
        emptyDescription={q ? "Try another username." : "Enrolled students will appear here."}
        render={person => <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={`Open conversation with ${person.username}`}
          onPress={() => router.replace({ pathname: "/communication", params: { classId, studentId: person.id, mode: "direct" } })} style={({ pressed }) => [m.person, pressed && m.pressed]}>
          <View style={m.avatar}><Text accessible={false} style={m.avatarText}>{person.username.slice(0, 1).toUpperCase()}</Text></View>
          <View style={m.personCopy}><Text style={m.personName}>{person.username}</Text><Text style={[m.caption, m.personCaption]}>Open conversation</Text></View><PersonalIcon name="arrow" size={16} color={c.teal} />
        </Pressable>} />
    </> : <>
      <Text accessibilityRole="header" style={[m.cardTitle, m.peer]}>Conversation with {context.peer?.username ?? context.instructor.username}</Text>
      <Text style={[m.caption, m.peerCaption]}>{instructor ? "Only you and this student can read this class conversation." : "Your teacher for this class."}</Text>
      {instructor && <Action label="Choose another student" quiet onPress={() => router.replace({ pathname: "/communication", params: { classId, mode: "direct" } })} />}
      <MessageComposer onUnavailable={onUnavailable} api={api} classId={classId} studentId={selectedStudent} onSent={() => setRefresh(value => value + 1)} />
      <SectionHeading title="Your conversation" onRefresh={refreshContext} />
      <MessageHistory onUnavailable={onUnavailable} key={`direct:${selectedStudent}:${refresh}`} api={api} classId={classId} studentId={selectedStudent} viewerId={context.viewer.id} refresh={refresh} />
    </>}
    <AboutMessages />
  </View>;
}

export function CommunicationBrowser({ api, classId, studentId, mode }: { api: CommunicationAccess; classId?: string; studentId?: string; mode?: string }) {
  const [search, setSearch] = useState(""), [q, setQ] = useState(""), [refresh, setRefresh] = useState(0);
  useFocusEffect(useCallback(() => { if (!classId) setRefresh(value => value + 1); }, [classId]));
  const classes = useCallback((offset: number) => api.classes(q, offset), [api, q]);
  const context = useCallback(async () => ({ items: [await api.context(classId!, studentId)], offset: 0, limit: 1, has_more: false }), [api, classId, studentId]);
  return !classId ? <View>
    <Hero />
    <SearchField label="Search classes" placeholder="Class name" value={search} onChange={setSearch} onSearch={() => { setQ(search); setRefresh(value => value + 1); }} />
    <SectionHeading title="Your classes" onRefresh={() => setRefresh(value => value + 1)} />
    <CommunicationPage key={`${q}:${refresh}`} fetch={classes} loadingLabel="Loading your classes…" errorTitle="We couldn’t load your classes" emptyTitle={q ? "No matching classes" : "No classes to show"}
      emptyDescription={q ? "Try another class name." : "Your classes will appear here when they’re available."}
      render={row => <View key={row.id} style={m.card}>
        <View style={m.classTop}><View style={m.classArt}><Image accessible={false} source={classroomArt} resizeMode="contain" style={m.classImage} /></View><Text accessibilityRole="header" style={[m.cardTitle, m.classCopy]}>{row.class_name}</Text></View>
        <Action label="Open messages" icon="arrow" accessibilityLabel={`Open messages for ${row.class_name}`} onPress={() => router.push({ pathname: "/communication", params: { classId: row.id } })} />
      </View>} />
  </View> : <CommunicationPage key={`${classId}:${refresh}`} fetch={context} loadingLabel="Opening class messages…"
    render={row => <ClassCommunication key={`${row.classroom.id}:${studentId}:${mode}`} api={api} context={row} studentId={studentId} initialMode={mode} />} />;
}
