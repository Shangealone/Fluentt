import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePreventRemove } from "expo-router";
import * as Crypto from "expo-crypto";
import { Button, ErrorMessage, s } from "../../components/ui";
import { theme } from "../../theme/tokens";
import type { Attempt, CaptureAccess, Progress, RevealedBack } from "../../services/api/capture";
import { progress, savedBuffers, responseComplete } from "./captureState";
import { CaptureQuestion } from "./CaptureQuestion";

export function AttemptPlayer({ initial, api, active = true }: { initial: Attempt; api: CaptureAccess; active?: boolean }) {
  const [row, setRow] = useState(initial), [buffers, setBuffers] = useState(() => savedBuffers(initial)), [position, setPosition] = useState(initial.position);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [blocked, setBlocked] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [backs, setBacks] = useState<Record<string, RevealedBack>>({}), [navigation, setNavigation] = useState(false);
  const [confirmation, setConfirmation] = useState<{ message: string; accept: () => void } | null>(null);
  const [interactionReset, setInteractionReset] = useState(0);
  const [pending, setPending] = useState<{ row: Attempt; body: Progress; key: string } | null>(null);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  usePreventRemove(active && (dirty || busy || !!pending), ({ repeat }) => {
    if (!lock.current) setConfirmation({ message: "Leave and discard unsaved changes? Saved progress remains on the server. If submission was interrupted, inspect its saved status before trying again.", accept: () => { setDirty(false); setPending(null); repeat(); } });
  });
  function restore(value: Attempt) { setRow(value); setBuffers(savedBuffers(value)); setPosition(value.position); setBacks({}); setInteractionReset(value => value + 1); setDirty(false); setUncertain(false); setBlocked(false); setPending(null); }
  function failed(cause: unknown) {
    setError(cause instanceof Error ? cause.message : "Could not verify the saved outcome. Reload progress.");
    const status = (cause as { status?: number }).status;
    if (status === 403 || status === 404 || status === 401) { setBlocked(true); setBacks({}); }
    if (!status || status === 408 || status === 409 || status >= 500) setUncertain(true);
  }
  async function operation(kind: "save" | "submit" | "reload" | "reveal") {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      if (kind === "reveal") {
        const item = row.questions[position - 1], back = await api.reveal(row, item);
        if (alive.current) { setBacks(current => ({ ...current, [item.assignment_question_id]: back })); setRow(current => ({ ...current, revision: back.attempt_revision })); }
      } else if (kind === "reload") {
        const saved = await api.read(row.id); if (alive.current) { restore(saved); setNotice("Saved state restored. Unsaved local changes were discarded."); }
      } else if (kind === "save") {
        const saved = await api.save(row, progress(row, buffers, position));
        if (alive.current) { restore(saved); setNotice("Progress saved on the server. Not submitted."); }
      } else {
        const request = pending ?? { row, body: progress(row, buffers, position), key: Crypto.randomUUID() };
        setPending(request);
        const saved = await api.submit(request.row, request.body, request.key);
        if (alive.current) { restore(saved); setNotice("Submission confirmed by the server."); }
      }
    } catch (cause) { if (alive.current) { failed(cause); if ((cause as { status?: number }).status === 422) setPending(null); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  if (!active) return null;
  const completed = row.questions.filter(item => responseComplete(item, buffers[item.assignment_question_id])).length;
  const frozen = busy || uncertain || !!pending || blocked;
  const item = row.questions[position - 1];
  const progressPct = Math.round((position / row.question_count) * 100);

  return (
    <View style={{ gap: 16 }}>
      {/* Header and Progress Track */}
      <View style={playerStyles.headerBox}>
        <View style={playerStyles.titleRow}>
          <Text accessibilityRole="header" style={s.heading}>
            {row.title}
          </Text>
          <View style={playerStyles.statusBadges}>
            <Text style={playerStyles.badgeText}>
              {completed}/{row.question_count} ANSWERED
            </Text>
            <Text
              style={[
                playerStyles.badgeText,
                { color: dirty ? "#D97706" : "#0D9488" },
              ]}
            >
              {dirty ? "● UNSAVED" : "✓ SAVED"}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={playerStyles.progressTrack}>
          <View
            style={[
              playerStyles.progressFill,
              { width: `${progressPct}%` },
            ]}
          />
        </View>

        <Text accessibilityLiveRegion="polite" style={playerStyles.progressMeta}>
          Question {position} of {row.question_count} ({progressPct}% through assessment)
        </Text>
      </View>

      {!!error && <ErrorMessage message={error} />}
      {!!notice && (
        <View style={playerStyles.noticeBox}>
          <Text accessibilityRole="alert" style={playerStyles.noticeText}>
            {notice}
          </Text>
        </View>
      )}

      {confirmation ? (
        <View style={s.card}>
          <Text style={s.heading}>{confirmation.message}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              label="Keep working"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => setConfirmation(null)}
            />
            <Button
              label="Confirm"
              variant="primary"
              style={{ flex: 1 }}
              onPress={() => {
                const accept = confirmation.accept;
                setConfirmation(null);
                accept();
              }}
            />
          </View>
        </View>
      ) : (
        <>
          {row.status === "submitted" ? (
            <View style={[s.card, { alignItems: "center", paddingVertical: 36, gap: 12 }]}>
              <Text style={{ fontSize: 44 }}>🎉</Text>
              <Text style={s.heading} accessibilityRole="header">
                Submission received
              </Text>
              <Text style={[s.body, { textAlign: "center" }]}>
                Submitted {new Date(row.submitted_at!).toLocaleString()} •{" "}
                {row.completed_count}/{row.question_count} structurally answered.
              </Text>
              <Button
                label="Return to Published Assignments →"
                variant="primary"
                onPress={() =>
                  router.replace({
                    pathname: "/published-assignments",
                    params: { classId: row.class_id, id: row.assignment_id },
                  })
                }
              />
            </View>
          ) : !blocked && item ? (
            <>
              {/* Question Index Strip */}
              <View style={playerStyles.dotsStrip}>
                {row.questions.map((q, idx) => {
                  const isCurrent = position === idx + 1;
                  const isAnswered = responseComplete(q, buffers[q.assignment_question_id]);
                  return (
                    <Pressable
                      key={q.assignment_question_id}
                      disabled={frozen || isCurrent}
                      onPress={() => {
                        setPosition(idx + 1);
                        setDirty(true);
                      }}
                      style={[
                        playerStyles.dotItem,
                        isAnswered && playerStyles.dotAnswered,
                        isCurrent && playerStyles.dotCurrent,
                      ]}
                    >
                      <Text
                        style={[
                          playerStyles.dotText,
                          isAnswered && playerStyles.dotTextAnswered,
                          isCurrent && playerStyles.dotTextCurrent,
                        ]}
                      >
                        {idx + 1}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Question Component */}
              <CaptureQuestion
                key={`${item.assignment_question_id}:${interactionReset}`}
                item={item}
                answer={buffers[item.assignment_question_id]}
                back={backs[item.assignment_question_id] ?? null}
                disabled={frozen}
                onReveal={() => void operation("reveal")}
                onChange={(answer) => {
                  if (!frozen) {
                    setBuffers((current) => ({
                      ...current,
                      [item.assignment_question_id]: answer,
                    }));
                    setDirty(true);
                    setNotice("");
                  }
                }}
              />

              {/* Primary Stepper Bar */}
              <View style={playerStyles.navBar}>
                <Button
                  label="← Previous"
                  variant="secondary"
                  disabled={frozen || position === 1}
                  style={{ flex: 1 }}
                  onPress={() => {
                    setPosition(position - 1);
                    setDirty(true);
                  }}
                />
                {position < row.question_count ? (
                  <Button
                    label="Next →"
                    variant="primary"
                    disabled={frozen}
                    style={{ flex: 1 }}
                    onPress={() => {
                      setPosition(position + 1);
                      setDirty(true);
                    }}
                  />
                ) : (
                  <Button
                    label="Review final submission"
                    icon="✓"
                    variant="primary"
                    disabled={busy || blocked || (!pending && uncertain)}
                    style={{ flex: 1.2 }}
                    onPress={() =>
                      setConfirmation({
                        message: `Submit this attempt permanently? ${
                          row.question_count - completed
                        } questions are unanswered or incomplete. No further edits are permitted.`,
                        accept: () => void operation("submit"),
                      })
                    }
                  />
                )}
              </View>

              {/* Secondary Utility Controls Bar */}
              <View style={playerStyles.utilityBar}>
                <Button
                  label="Save progress"
                  variant="secondary"
                  size="sm"
                  disabled={frozen}
                  onPress={() => void operation("save")}
                />
                <Button
                  label="Clear current response"
                  icon="↺"
                  variant="ghost"
                  size="sm"
                  disabled={frozen}
                  onPress={() => {
                    setBuffers((current) => {
                      const next = { ...current };
                      delete next[item.assignment_question_id];
                      return next;
                    });
                    setInteractionReset((v) => v + 1);
                    setDirty(true);
                  }}
                />
                {pending && (
                  <Button
                    label="Retry original submission"
                    variant="danger"
                    size="sm"
                    onPress={() => void operation("submit")}
                  />
                )}
              </View>
            </>
          ) : (
            <ErrorMessage message="Assignment access could not be verified. Protected question data is hidden. Restore access and reload saved progress." />
          )}

          {row.status !== "submitted" && (
            <View style={playerStyles.footerRow}>
              <Button
                label="Reload Saved State"
                variant="ghost"
                size="sm"
                disabled={busy}
                onPress={() =>
                  setConfirmation({
                    message: "Reload from server and discard unsaved local work?",
                    accept: () => void operation("reload"),
                  })
                }
              />
              <Button
                label="Leave Assignment"
                variant="ghost"
                size="sm"
                disabled={busy}
                onPress={() =>
                  router.replace({
                    pathname: "/published-assignments",
                    params: { classId: row.class_id, id: row.assignment_id },
                  })
                }
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const playerStyles = StyleSheet.create({
  headerBox: {
    gap: 8,
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  statusBadges: {
    flexDirection: "row",
    gap: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: theme.colors.subtle,
  },
  progressTrack: {
    height: 8,
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
  },
  progressMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.muted,
  },
  noticeBox: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 12,
  },
  noticeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#065F46",
  },
  dotsStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 2,
  },
  dotItem: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dotAnswered: {
    backgroundColor: theme.colors.successLight,
    borderColor: "#A7F3D0",
  },
  dotCurrent: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dotText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.muted,
  },
  dotTextAnswered: {
    color: "#065F46",
  },
  dotTextCurrent: {
    color: "#FFFFFF",
  },
  navBar: {
    flexDirection: "row",
    gap: 12,
  },
  utilityBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },
});
