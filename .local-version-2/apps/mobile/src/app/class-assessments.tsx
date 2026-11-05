import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { Text } from "../accessibility/Primitives";
import { Picker } from "../features/assignments/AssignmentEditor";
import { LessonButton, LessonChoice, LessonField, LessonFrame, LessonHero, LessonNote, l } from "../features/teacher-lessons/LessonUI";
import type { AssignmentDraft, ClassAssessment } from "../services/api/assignments";
import { useSession } from "../session/provider";

export default function ClassAssessments() {
  const params = useLocalSearchParams<{ classId?: string }>();
  const classId = typeof params.classId === "string" ? params.classId : "";
  return <ClassroomAssessments key={classId} classId={classId} />;
}

function ClassroomAssessments({ classId }: { classId: string }) {
  const { profile, assignments } = useSession();
  const [draft, setDraft] = useState<AssignmentDraft | null>(null);
  const [kind, setKind] = useState<ClassAssessment["kind"]>("pre_test");
  const [opening, setOpening] = useState("");
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState<{ row: AssignmentDraft; assessment: ClassAssessment; key: string } | null>(null);
  const lock = useRef(false);
  const fetch = useCallback(async (offset: number) => {
    const page = await assignments.list(classId, offset);
    return { ...page, items: page.items.filter(row => row.class_assessment || (row.status === "draft" && row.question_count > 0)) };
  }, [assignments, classId]);
  const frozen = busy || !!pending || confirm;
  async function choose(id: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setDraft(null);
    try { setDraft(await assignments.get(id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t open the draft."); }
    finally { lock.current = false; setBusy(false); }
  }
  function preparePublication() {
    const value = opening.trim();
    if (kind === "post_test" && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) {
      setError("Enter an opening date and time with its timezone, such as 2026-12-06T09:00+08:00.");
      return;
    }
    setError(""); setConfirm(true);
  }
  async function publish() {
    if (lock.current || !draft) return;
    const operation = pending ?? { row: draft, assessment: { kind, opens_at: kind === "post_test" ? new Date(opening.trim()).toISOString() : null }, key: Crypto.randomUUID() };
    lock.current = true; setBusy(true); setPending(operation); setConfirm(false); setError("");
    try {
      const published = await assignments.publish(operation.row, operation.key, operation.assessment);
      setNotice(`${published.title} is published for your class.`);
      setDraft(null); setPending(null); setRefresh(value => value + 1);
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      if (!pending && status && status !== 408 && status !== 429 && status < 500) setPending(null);
      setError(cause instanceof Error ? cause.message : "Couldn’t confirm publication. Retry the same request.");
    } finally { lock.current = false; setBusy(false); }
  }
  if (profile?.role !== "instructor" || !classId) return null;
  return <LessonFrame busy={busy} onBack={() => router.replace({ pathname: "/class-details", params: { id: classId } })} onAccount={() => router.push("/account")}>
    <LessonHero title="Class assessments" description="Prepare and publish pretests and posttests for your class." />
    {!!error && <LessonNote error>{error}</LessonNote>}
    {!!notice && <LessonNote>{notice}</LessonNote>}
    <LessonButton label="Prepare a question draft" primary disabled={frozen} onPress={() => router.push({ pathname: "/assignment-builder", params: { classId } })} />
    <Text style={l.body}>Save your questions in the builder, then return here to choose the assessment type and publish.</Text>
    <Picker key={refresh} fetch={fetch} emptyTitle="No assessments or question drafts on this page" emptyDescription="Prepare and save a question draft first."
      render={row => row.class_assessment ? <View key={row.id} style={l.card}>
        <Text style={l.label}>{row.title}</Text><Text style={l.small}>{row.class_assessment.kind === "pre_test" ? "Pretest" : "Posttest"}</Text>
        {row.class_assessment.opens_at && <Text style={l.small}>Opens {new Date(row.class_assessment.opens_at).toLocaleString()}</Text>}
        <LessonButton label="View class results" disabled={frozen} onPress={() => router.push({ pathname: "/assignment-results", params: { id: row.id } })} />
      </View> : <LessonChoice key={row.id} title={row.title} radio checked={draft?.id === row.id} disabled={frozen} onPress={() => void choose(row.id)} />} />
    {draft && <View style={l.stack}>
      <Text style={l.heading}>{draft.title}</Text>
      <LessonButton label="Edit or preview draft" disabled={frozen} onPress={() => router.push({ pathname: "/assignment-builder", params: { classId, id: draft.id } })} />
      <LessonChoice title="Pretest" radio checked={kind === "pre_test"} disabled={frozen} onPress={() => setKind("pre_test")} />
      <LessonChoice title="Posttest" radio checked={kind === "post_test"} disabled={frozen} onPress={() => setKind("post_test")} />
      {kind === "post_test" && <LessonField label="Opening date and time" value={opening} onChange={setOpening} disabled={frozen} help="Include the timezone. Example 2026-12-06T09:00+08:00." />}
      {confirm && <LessonNote>Publishing freezes these questions. Students can submit the assessment once.</LessonNote>}
      <LessonButton label={pending ? "Retry publication" : confirm ? "Confirm publication" : "Publish assessment"} primary disabled={busy}
        onPress={pending || confirm ? () => void publish() : preparePublication} />
      {confirm && <LessonButton label="Cancel" onPress={() => setConfirm(false)} />}
    </View>}
  </LessonFrame>;
}
