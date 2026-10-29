import { isReportingReadiness, type ReportingReadiness } from "./research-reporting-contract";

export type StudyState = "DRAFT" | "READY" | "ACTIVE" | "PAUSED" | "COMPLETED";
export const states: StudyState[] = ["DRAFT", "READY", "ACTIVE", "PAUSED", "COMPLETED"];
export const phases = ["pre_test", "intervention", "post_test", "delayed_follow_up", "questionnaire"] as const;
export const phaseLabels = { pre_test: "Pre-test", intervention: "Intervention", post_test: "Post-test", delayed_follow_up: "Delayed follow-up", questionnaire: "Questionnaire" };
export type Policy = { version: string; reference: string; parameters: Record<string, unknown> };
export type Window = { opens_at: string; closes_at: string };
export type Assessment = { assessment_id: string; instrument_version: string; opens_at: string | null; closes_at: string | null; timer_limit_seconds: number | null };
export const assessmentStages = ["pre_test", "immediate_post_test", "delayed_retention_test"] as const;
export const assessmentStageLabels = { pre_test: "Pre-test", immediate_post_test: "Immediate post-test", delayed_retention_test: "Delayed retention test" };
export type AssessmentDeliveryDraft = {
  version: string; blueprint_policy: Policy | null; difficulty_policy: Policy | null; scoring_policy: Policy | null;
  stages: Partial<Record<typeof assessmentStages[number], { assessment_id: string | null; maximum_attempts: number | null; timeout_policy: Policy | null; feedback_policy: Policy | null }>>;
  delayed_follow_up: { policy: Policy; anchor: "immediate_post_test_completion"; minimum_delay_seconds: number } | null;
};
export type AssessmentPublication = { status: "BLOCKED"; execution_available: false; blockers: string[] };
export type Configuration = {
  assessment_delivery_draft?: AssessmentDeliveryDraft | null;
  starts_at: string | null; ends_at: string | null; timezone: string | null; active_weekdays: number[] | null;
  protocol_reference: string | null; consent_document_version: string | null; consent_requirements: string[] | null;
  allocation_unit: "participant" | "classroom" | null; allocation_policy: Policy | null; due_date_policy: Policy | null;
  conditions: { condition: string; scheduler_configuration_id: string }[]; assessments: Assessment[];
  declared_evidence: Record<string, string>;
  administrator_setup?: { proposed_intervention_weeks: number | null; daily_availability: { opens: string; closes: string } | null;
    phase_windows: Partial<Record<typeof phases[number], Window>>; review_policy: Policy | null; assessment_attempt_limit: number | null } | null;
};
export type Study = { id: string; study_id: string; code: string; title: string; language: string; protocol_version: string;
  target_participants: number; status: StudyState; revision: string; protocol_id: string; configuration_version: number;
  configuration_fingerprint: string; configuration: Configuration; activation_blockers: string[]; assessment_publication?: AssessmentPublication; reporting?: ReportingReadiness };
export type Page<T> = { items: T[]; has_more: boolean; offset: number; limit: number };
export type Choice = { id: string; label: string; language?: string; instrument_version?: string;
  implementation_version?: string; configuration_version?: number; selectable?: boolean; condition?: string; reason?: string };
export type Binding = { id: string; class_id: string; scope_id: string; study_id: string };
export type History = { id: string; version: number; protocol_version: string; fingerprint: string; configuration: Configuration };
export const transitions: Record<StudyState, StudyState[]> = { DRAFT: ["READY"], READY: ["ACTIVE", "COMPLETED"], ACTIVE: ["PAUSED", "COMPLETED"], PAUSED: ["ACTIVE", "COMPLETED"], COMPLETED: [] };
export function allowedTransition(study: Study, next: StudyState, manage: boolean) {
  return manage && transitions[study.status].includes(next) && (!(next === "READY" || next === "ACTIVE") || study.activation_blockers.length === 0);
}
export function isStudy(value: unknown): value is Study {
  if (!value || typeof value !== "object") return false;
  const row = value as Study;
  return [row.id, row.study_id, row.title, row.code, row.language, row.protocol_version, row.protocol_id, row.configuration_fingerprint].every(value => typeof value === "string") && states.includes(row.status)
    && typeof row.revision === "string" && typeof row.configuration_version === "number"
    && Number.isInteger(row.target_participants) && row.target_participants > 0
    && !!row.configuration && Array.isArray(row.configuration.conditions) && Array.isArray(row.configuration.assessments)
    && !!row.configuration.declared_evidence && typeof row.configuration.declared_evidence === "object"
    && (row.configuration.active_weekdays === null || Array.isArray(row.configuration.active_weekdays))
    && (row.configuration.consent_requirements === null || Array.isArray(row.configuration.consent_requirements))
    && Array.isArray(row.activation_blockers) && row.activation_blockers.every(b => typeof b === "string")
    && (row.assessment_publication === undefined || (!!row.assessment_publication && row.assessment_publication.status === "BLOCKED"
      && row.assessment_publication.execution_available === false && Array.isArray(row.assessment_publication.blockers)
      && row.assessment_publication.blockers.every(b => typeof b === "string")))
    && (row.reporting === undefined || isReportingReadiness(row.reporting));
}
export function utcInput(value?: string | null) { return value ? new Date(value).toISOString().slice(0, 19) : ""; }
export function buildConfiguration(data: FormData, previous: Configuration, instruments: Choice[]): Configuration {
  const text = (key: string) => String(data.get(key) ?? "").trim();
  const integer = (key: string, max = 2147483647) => {
    const value = text(key);
    if (!value) return null;
    if (!/^[1-9][0-9]*$/.test(value) || Number(value) > max) throw new Error(`${key}: use a positive whole number up to ${max}.`);
    return Number(value);
  };
  const date = (key: string) => {
    const value = text(key);
    if (!value) return null;
    const parsed = new Date(`${value}Z`);
    if (!Number.isFinite(parsed.getTime())) throw new Error(`${key}: enter a valid UTC date and time.`);
    return parsed.toISOString();
  };
  const window = (key: string): Window | null => {
    const opens_at = date(`${key}.opens`), closes_at = date(`${key}.closes`);
    if (!opens_at && !closes_at) return null;
    if (!opens_at || !closes_at || opens_at >= closes_at) throw new Error(`${key}: provide an end after its start.`);
    return { opens_at, closes_at };
  };
  const policy = (key: string): Policy | null => {
    if (!text(`${key}.version`) && !text(`${key}.reference`) && !text(`${key}.parameters`)) return null;
    if (!text(`${key}.version`) || !text(`${key}.reference`)) throw new Error(`${key}: provide a version and policy reference.`);
    const parameters: unknown = JSON.parse(text(`${key}.parameters`) || "{}");
    if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) throw new Error(`${key}: parameters must be a JSON object.`);
    return { version: text(`${key}.version`), reference: text(`${key}.reference`), parameters: parameters as Record<string, unknown> };
  };
  const starts_at = date("starts_at"), ends_at = date("ends_at"), timezone = text("timezone") || null;
  if (starts_at && ends_at && starts_at >= ends_at) throw new Error("Study end must follow its start.");
  if (timezone) { try { new Intl.DateTimeFormat("en", { timeZone: timezone }); } catch { throw new Error("Use a recognized IANA timezone."); } }
  const active_weekdays = data.getAll("weekday").map(Number);
  const phase_windows: Partial<Record<typeof phases[number], Window>> = {};
  for (const phase of phases) { const value = window(phase); if (value) phase_windows[phase] = value; }
  for (const value of Object.values(phase_windows)) {
    if ((starts_at && value.opens_at < starts_at) || (ends_at && value.closes_at > ends_at)) throw new Error("Phase windows must fit within the study dates.");
  }
  const opens = text("daily.opens"), closes = text("daily.closes");
  if ((opens || closes) && (!opens || !closes || opens >= closes)) throw new Error("Provide an ordered same-day availability window.");
  const selected = String(data.get("sm2") ?? "");
  const conditions = selected ? [{ condition: "sm2_control", scheduler_configuration_id: selected }] : [];
  if (!data.has("remove_unavailable")) conditions.push(...previous.conditions.filter(c => c.condition !== "sm2_control"));
  const assessments = data.getAll("instrument").map(String).map(id => {
    const existing = previous.assessments.find(a => a.assessment_id === id);
    const option = instruments.find(i => i.id === id);
    const instrument_version = option?.instrument_version ?? existing?.instrument_version;
    if (!instrument_version) throw new Error("Select an available exact locked instrument version.");
    const range = window(`assessment.${id}`);
    return { assessment_id: id, instrument_version, opens_at: range?.opens_at ?? null, closes_at: range?.closes_at ?? null, timer_limit_seconds: integer(`timer.${id}`) };
  });
  for (const item of assessments) if ((starts_at && item.opens_at && item.opens_at < starts_at) || (ends_at && item.closes_at && item.closes_at > ends_at)) throw new Error("Instrument windows must fit within study dates.");
  const declared_evidence = Object.fromEntries(["protocol", "ethics", "site_permission", "instruments", "conditions"].filter(key => text(`evidence.${key}`)).map(key => [key, text(`evidence.${key}`)]));
  const result: Configuration = { ...previous, starts_at, ends_at, timezone, active_weekdays: active_weekdays.length ? active_weekdays : null,
    protocol_reference: text("protocol_reference") || null, consent_document_version: text("consent_document_version") || null,
    consent_requirements: data.getAll("consent_kind").length ? data.getAll("consent_kind").map(String) : null,
    allocation_unit: (text("allocation_unit") || null) as Configuration["allocation_unit"],
    allocation_policy: policy("allocation"), due_date_policy: policy("due"), conditions, assessments, declared_evidence,
    administrator_setup: { proposed_intervention_weeks: integer("weeks", 520), daily_availability: opens ? { opens, closes } : null,
      phase_windows, review_policy: policy("review"), assessment_attempt_limit: integer("attempts") } };
  // Forms predating this section omit the marker and must preserve retained draft plans.
  if (data.has("delivery.present")) {
    result.assessment_delivery_draft = null;
    if (data.has("delivery.enabled")) {
      const version = text("delivery.version");
      if (!version || version.length > 80) throw new Error("Provide a delivery draft version (1-80 characters).");
      const stages: AssessmentDeliveryDraft["stages"] = {};
      const seen = new Set<string>();
      for (const stage of assessmentStages) {
        const assessment_id = text(`delivery.${stage}.instrument`) || null;
        if (assessment_id && (!assessments.some(a => a.assessment_id === assessment_id) || seen.has(assessment_id))) throw new Error("Use a distinct, selected instrument for each assessment stage.");
        if (assessment_id) seen.add(assessment_id);
        stages[stage] = { assessment_id, maximum_attempts: integer(`delivery.${stage}.attempts`), timeout_policy: policy(`delivery.${stage}.timeout`), feedback_policy: policy(`delivery.${stage}.feedback`) };
      }
      const followUpPolicy = policy("delivery.follow_up"), delay = integer("delivery.delay");
      if ((followUpPolicy || delay) && (!followUpPolicy || !delay)) throw new Error("Provide both the follow-up policy and positive delay in seconds.");
      result.assessment_delivery_draft = { version, stages, blueprint_policy: policy("delivery.blueprint"), difficulty_policy: policy("delivery.difficulty"), scoring_policy: policy("delivery.scoring"),
        delayed_follow_up: followUpPolicy && delay ? { policy: followUpPolicy, anchor: "immediate_post_test_completion", minimum_delay_seconds: delay } : null };
    }
  }
  if (new TextEncoder().encode(JSON.stringify(result)).length > 65536) throw new Error("Configuration exceeds 64 KiB.");
  return result;
}
