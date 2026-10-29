import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { router, usePreventRemove } from "expo-router";
import * as Crypto from "expo-crypto";
import { Button, ErrorMessage, Input, s } from "../../components/ui";
import { Choices } from "../../components/onboarding";
import { Picker } from "../assignments/AssignmentEditor";
import { messageError, type CommunicationAccess, type CommunicationContext, type Message } from "../../services/api/communications";
import { MessageSubmission } from "./state";

export function MessageCard({ row, onOpen }: { row: Message; onOpen?: () => void }) {
  return <View style={s.card}><Text accessibilityRole="header" style={s.heading}>{row.kind === "announcement" ? "Class announcement" : "Direct message"} · {row.sender.username}</Text>
    <Text style={s.body}>{new Date(row.sent_at).toLocaleString()} · {row.read ? "Read by you / sent by you" : "Unread by you"}</Text>
    <Text selectable style={s.body}>{row.content}</Text>
    {onOpen && <Button label={`Open message from ${row.sender.username} at ${new Date(row.sent_at).toLocaleString()}`} secondary onPress={onOpen} />}
  </View>;
}
export function MessageComposer({ api, classId, studentId, onSent, onUnavailable }: { api: CommunicationAccess; classId: string; studentId?: string; onSent: (row: Message) => void; onUnavailable?: (cause: unknown) => void }) {
  const [text, setText] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [submission] = useState(() => new MessageSubmission()), [leaving, setLeaving] = useState<(() => void) | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  usePreventRemove(!!text || !!submission.pending || busy, ({ repeat }) => setLeaving(() => repeat));
  async function send() {
    if (submission.busy) return;
    const invalid = messageError(submission.pending?.content ?? text); if (invalid) { setError(invalid); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const row = await submission.send(text, (body, key) => api.send(classId, studentId, body, key), Crypto.randomUUID);
      if (alive.current) { setText(""); setNotice("Message saved on the server. No push notification was sent."); onSent(row); }
    } catch (cause) { if (alive.current) { setError(cause instanceof Error ? cause.message : "Sending failed. Retry the original request."); onUnavailable?.(cause); } }
    finally { if (alive.current) setBusy(false); }
  }
  return <View style={s.card}><Text accessibilityRole="header" style={s.heading}>{studentId ? "Write a direct message" : "Write a class announcement"}</Text>
    <Text style={s.body}>Plain text only. No attachments or editing/deletion after sending. Do not include private answer keys, protected grades or research information.</Text>
    <Input accessibilityLabel="Message body" multiline value={text} editable={!busy && !submission.pending} onChangeText={setText} style={{ minHeight: 120, textAlignVertical: "top" }} />
    <Text style={s.body}>{[...text].length} / 4,000 Unicode characters</Text>
    {!!error && <ErrorMessage message={error} />}{!!notice && <Text accessibilityRole="alert" style={s.body}>{notice}</Text>}
    {submission.pending && <Text style={s.body}>Send outcome may be unknown. Retry keeps the same text and request ID. After closing or restarting, refresh history before composing again.</Text>}
    <Button label={submission.pending ? "Retry original send" : "Send message"} disabled={busy || !!messageError(submission.pending?.content ?? text)} onPress={() => void send()} />
    {leaving && <View style={s.card}><Text style={s.heading}>Leave this message?</Text><Text style={s.body}>Unsaved text and the local retry request will be discarded. An interrupted send may already be saved; inspect history before sending again.</Text>
      <Button label="Keep composing" onPress={() => setLeaving(null)} /><Button label="Confirm leave" secondary disabled={busy} onPress={() => { const repeat = leaving; setText(""); submission.discard(); setLeaving(null); repeat(); }} /></View>}
  </View>;
}
export function MessageHistory({ api, classId, studentId, refresh, onUnavailable }: { api: CommunicationAccess; classId: string; studentId?: string; refresh: number; onUnavailable?: (cause: unknown) => void }) {
  const anchor = useRef<string | undefined>(undefined), [selected, setSelected] = useState<string | null>(null), [readRefresh, setReadRefresh] = useState(0);
  const history = useCallback(async (offset: number) => { const page = await api.history(classId, studentId, offset, anchor.current).catch(cause => { onUnavailable?.(cause); throw cause; }); anchor.current ??= page.as_of; return page; }, [api, classId, studentId, onUnavailable]);
  const detail = useCallback(async () => {
    const row = await api.detail(classId, selected!).catch(cause => { onUnavailable?.(cause); throw cause; });
    const marked = row.read ? row : await api.read(classId, row.id).catch(cause => { onUnavailable?.(cause); throw cause; });
    return { items: [marked], offset: 0, limit: 1, has_more: false };
  }, [api, classId, selected, onUnavailable]);
  return <View style={{ gap: 12 }}><Text style={s.body}>Newest first. Pages retain their history timestamp until refresh. Opening an individual message marks it read for you only; read receipts for other participants are not shown.</Text>
    {selected ? <><Button label="Close message detail" secondary onPress={() => { setSelected(null); setReadRefresh(value => value + 1); }} />
      <Picker key={selected} fetch={detail} render={row => <MessageCard key={row.id} row={row} />} /></>
      : <Picker key={`${refresh}:${readRefresh}`} fetch={history} emptyTitle="No messages yet" emptyDescription="No messages are available in this authorized class conversation. Refresh to check for new messages."
        render={row => <MessageCard key={row.id} row={row} onOpen={() => setSelected(row.id)} />} />}
  </View>;
}
export function ClassCommunication({ api, context, studentId, initialMode }: { api: CommunicationAccess; context: CommunicationContext; studentId?: string; initialMode?: string }) {
  const classId = context.classroom.id, instructor = context.role === "instructor";
  const [tab] = useState<"announcements" | "direct">(studentId || initialMode === "direct" ? "direct" : "announcements"), [refresh, setRefresh] = useState(0), [search, setSearch] = useState(""), [q, setQ] = useState("");
  const [denied, setDenied] = useState(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const onUnavailable = useCallback((cause: unknown) => { if (alive.current && [403, 404].includes((cause as { status?: number }).status ?? 0)) setDenied(true); }, []);
  const selectedStudent = instructor ? studentId : context.viewer.id;
  const people = useCallback((offset: number) => api.participants(classId, q, offset), [api, classId, q]);
  if (denied) return <View><ErrorMessage message="Class or participant access is no longer available. Prior communication is hidden." /><Button label="Recheck communication access" onPress={() => router.replace({ pathname: "/communication", params: { classId, studentId, mode: tab, refresh: Crypto.randomUUID() } })} /></View>;
  return <View style={{ gap: 16 }}><Text accessibilityRole="header" style={s.heading}>{context.classroom.class_name}</Text>
    <Text style={s.body}>Instructor: {context.instructor.username} · Signed in as {context.viewer.username}</Text>
    <Text style={s.body}>Synthetic demonstration use only until real-student retention and moderation policies are approved. Current class membership is required. Messages are retained when access is suspended.</Text>
    <Button label="Choose another communication class" secondary onPress={() => router.replace("/communication")} />
    <Choices values={["announcements", "direct"]} value={tab} onChange={value => {
      // Tab changes leave the compose host through its own confirmed route boundary.
      if (value !== tab) router.replace({ pathname: "/communication", params: { classId, mode: value } });
    }} label={value => value === "announcements" ? "Class announcements" : "Instructor–student direct messages"} />
    <Button label="Refresh messages and access" secondary onPress={() => router.replace({ pathname: "/communication", params: { classId, studentId, mode: tab, refresh: Crypto.randomUUID() } })} />
    <Text style={s.body}>Messages use manual refresh. No live push, typing indicator or automatic sharing is enabled.</Text>
    {tab === "announcements" ? <>
      <Text style={s.body}>Current members, including later joiners, can read class announcements. Announcements do not accept replies.</Text>
      {instructor && <MessageComposer onUnavailable={onUnavailable} api={api} classId={classId} onSent={() => setRefresh(value => value + 1)} />}
      <MessageHistory onUnavailable={onUnavailable} key={`announcements:${refresh}`} api={api} classId={classId} refresh={refresh} />
    </> : instructor && !selectedStudent ? <><Input accessibilityLabel="Search enrolled usernames" value={search} onChangeText={setSearch} maxLength={200} autoCorrect={false} />
      <Button label="Apply recipient search" onPress={() => setQ(search)} />
      <Picker key={`${q}:${refresh}`} fetch={people} emptyTitle="No current enrolled students match" emptyDescription="Only eligible current students in your own class may receive direct messages."
        render={person => <Button key={person.id} label={`Open conversation with ${person.username}`} onPress={() => router.replace({ pathname: "/communication", params: { classId, studentId: person.id, mode: "direct" } })} />} />
    </> : <><Text style={s.heading}>Conversation with {context.peer?.username ?? context.instructor.username}</Text><Text style={s.body}>Direct messages are private to the instructor of this class and the selected enrolled student. Either can send. No peer or personal-learner chat.</Text>
      {instructor && <Button label="Choose another enrolled student" secondary onPress={() => router.replace({ pathname: "/communication", params: { classId, mode: "direct" } })} />}
      <MessageComposer onUnavailable={onUnavailable} api={api} classId={classId} studentId={selectedStudent} onSent={() => setRefresh(value => value + 1)} />
      <MessageHistory onUnavailable={onUnavailable} key={`direct:${selectedStudent}:${refresh}`} api={api} classId={classId} studentId={selectedStudent} refresh={refresh} />
    </>}
  </View>;
}
export function CommunicationBrowser({ api, classId, studentId, mode }: { api: CommunicationAccess; classId?: string; studentId?: string; mode?: string }) {
  const [search, setSearch] = useState(""), [q, setQ] = useState(""), [refresh, setRefresh] = useState(0);
  const classes = useCallback((offset: number) => api.classes(q, offset), [api, q]);
  const context = useCallback(async () => ({ items: [await api.context(classId!, studentId)], offset: 0, limit: 1, has_more: false }), [api, classId, studentId]);
  return <View style={{ gap: 16 }}>{!classId ? <><Input accessibilityLabel="Search communication class names" value={search} onChangeText={setSearch} maxLength={200} />
    <Button label="Apply class search" onPress={() => { setQ(search); setRefresh(value => value + 1); }} /><Button label="Refresh communication classes" secondary onPress={() => setRefresh(value => value + 1)} />
    <Picker key={`${q}:${refresh}`} fetch={classes} emptyTitle="No eligible communication classes" emptyDescription="Instructors need an active owned class; school students need a current eligible enrollment."
      render={row => <Button key={row.id} label={`Open communication: ${row.class_name}`} onPress={() => router.push({ pathname: "/communication", params: { classId: row.id } })} />} />
  </> : <Picker key={`${classId}:${refresh}`} fetch={context} render={row => <CommunicationMode key={`${row.classroom.id}:${studentId}:${mode}`} api={api} context={row} studentId={studentId} mode={mode} />} />}</View>;
}
function CommunicationMode({ mode, ...props }: { api: CommunicationAccess; context: CommunicationContext; studentId?: string; mode?: string }) {
  return <ClassCommunication {...props} initialMode={mode} />;
}
