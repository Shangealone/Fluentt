"use client";

import { useState, type FormEvent } from "react";
import { Button } from "./ui";
import { ResearchAssessmentStatus } from "./research-assessment-status";
import { assessmentStages, assessmentStageLabels, buildConfiguration, phases, phaseLabels, utcInput, type Choice, type Configuration, type Policy, type Study } from "@/services/research-classroom-contract";
import styles from "./research-setup.module.css";

function PolicyFields({ name, title, value }: { name: string; title: string; value?: Policy | null }) {
  return <div className={styles.policy}><h4>{title}</h4>
    <label>Policy version<input name={`${name}.version`} maxLength={80} defaultValue={value?.version ?? ""} /></label>
    <label>Approved policy reference<input name={`${name}.reference`} maxLength={500} defaultValue={value?.reference ?? ""} /></label>
    <details><summary>Policy parameters (JSON object)</summary><label>{title} parameters<textarea name={`${name}.parameters`} rows={3} defaultValue={value ? JSON.stringify(value.parameters, null, 2) : ""} /></label></details>
  </div>;
}

export function ResearchProtocolForm({ study, conditions, instruments, disabled, onSave, onDirty }: {
  study: Study; conditions: Choice[]; instruments: Choice[]; disabled: boolean;
  onSave(config: Configuration): Promise<void>; onDirty(value: boolean): void;
}) {
  const config = study.configuration, setup = config.administrator_setup;
  const delivery = config.assessment_delivery_draft;
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const allInstruments = [...instruments, ...config.assessments.filter(a => !instruments.some(i => i.id === a.assessment_id)).map(a => ({ id: a.assessment_id, label: "Current pinned instrument", instrument_version: a.instrument_version }))];
  const sm2 = config.conditions.find(c => c.condition === "sm2_control")?.scheduler_configuration_id;
  const hasUnavailable = config.conditions.some(c => c.condition !== "sm2_control");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try { await onSave(buildConfiguration(new FormData(event.currentTarget), config, allInstruments)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Review this configuration."); }
  }
  return <form onSubmit={submit} onChange={() => { setDirty(true); onDirty(true); }} className={styles.form}>
    <div><p className="eyebrow">VERSIONED DRAFT SETTINGS</p><h2>Plan the research classroom</h2><p>Each save creates a retained revision. These settings are proposals until independently reviewed. Saving does not enable learning or grant permission.</p></div>
    <fieldset disabled={disabled || study.status !== "DRAFT"}>
      <legend>1. Study calendar</legend>
      <div className={styles.fields}>
        <label>Protocol reference<input name="protocol_reference" maxLength={500} defaultValue={config.protocol_reference ?? ""} /></label>
        <label>Schedule timezone<input name="timezone" maxLength={100} placeholder="e.g. Asia/Manila" defaultValue={config.timezone ?? ""} /></label>
        <label>Study starts (UTC)<input name="starts_at" type="datetime-local" step="1" defaultValue={utcInput(config.starts_at)} /></label>
        <label>Study ends (UTC)<input name="ends_at" type="datetime-local" step="1" defaultValue={utcInput(config.ends_at)} /></label>
        <label>Proposed intervention weeks<input name="weeks" type="number" min="1" max="520" placeholder="3 (proposal; approval required)" defaultValue={setup?.proposed_intervention_weeks ?? ""} /></label>
      </div>
      <p className={styles.hint}>Three intervention weeks are a proposal, not an approved default. Dates are entered in UTC; daily availability uses the schedule timezone. Duration does not generate dates automatically.</p>
      <fieldset className={styles.weekdays}><legend>Eligible weekdays (select only the proposed protocol days)</legend>
        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day, index) => <label key={day}><input type="checkbox" name="weekday" value={index + 1} defaultChecked={config.active_weekdays?.includes(index + 1) ?? false} />{day}</label>)}
      </fieldset>
      <p className={styles.hint}>Monday-Friday remains unselected until proposed by an operator and approved independently.</p>
    </fieldset>
    <fieldset disabled={disabled || study.status !== "DRAFT"}>
      <legend>2. Availability and phase windows</legend>
      <div className={styles.fields}>
        <label>Daily opens (schedule timezone)<input name="daily.opens" type="time" defaultValue={setup?.daily_availability?.opens ?? ""} /></label>
        <label>Daily closes (same day)<input name="daily.closes" type="time" defaultValue={setup?.daily_availability?.closes ?? ""} /></label>
        <label>Proposed assessment attempt limit<input name="attempts" type="number" min="1" max="2147483647" defaultValue={setup?.assessment_attempt_limit ?? ""} /></label>
      </div>
      {phases.map(phase => <div key={phase} className={styles.window}><h4>{phaseLabels[phase]}</h4><div className={styles.fields}>
        <label>{phaseLabels[phase]} opens (UTC)<input name={`${phase}.opens`} type="datetime-local" step="1" defaultValue={utcInput(setup?.phase_windows[phase]?.opens_at)} /></label>
        <label>{phaseLabels[phase]} closes (UTC)<input name={`${phase}.closes`} type="datetime-local" step="1" defaultValue={utcInput(setup?.phase_windows[phase]?.closes_at)} /></label>
      </div></div>)}
      <p className={styles.hint}>Windows and attempt limits are stored planning settings. No assessment runner, daily timer or questionnaire collection is enabled here.</p>
    </fieldset>
    <fieldset disabled={disabled || study.status !== "DRAFT"}>
      <legend>3. Review and allocation policies</legend>
      <div className={styles.fields}><PolicyFields name="review" title="Review policy" value={setup?.review_policy} /><PolicyFields name="due" title="Due-date policy" value={config.due_date_policy} /><PolicyFields name="allocation" title="Allocation policy" value={config.allocation_policy} /></div>
      <label>Proposed allocation unit<select aria-label="Proposed allocation unit" name="allocation_unit" defaultValue={config.allocation_unit ?? ""}><option value="">Unresolved</option><option value="participant">Participant</option><option value="classroom">Classroom</option></select></label>
      <p className={styles.hint}>Selecting a policy reference does not allocate participants or change a scheduler.</p>
    </fieldset>
    <fieldset disabled={disabled || study.status !== "DRAFT"}>
      <legend>4. Conditions and frozen instruments</legend>
      <label>SM-2 condition configuration<select aria-label="SM-2 condition configuration" name="sm2" defaultValue={sm2 ?? ""}><option value="">No condition selected</option>
        {sm2 && !conditions.some(c => c.id === sm2 && c.selectable) && <option value={sm2}>Saved reference (implementation unverified)</option>}
        {conditions.filter(c => c.selectable).map(c => <option key={c.id} value={c.id}>SM-2 / {c.implementation_version} / configuration {c.configuration_version}</option>)}
      </select></label>
      <p>SM-2 is offered only when an existing supported version is returned by the server. ESR is unavailable: the installed adapter uses simulated inference. No approved ESR treatment is ready.</p>
      {hasUnavailable && <label className={styles.check}><input type="checkbox" name="remove_unavailable" />Remove the saved unavailable experimental condition in this revision</label>}
      {!allInstruments.length && <p className={styles.empty}>No locked instruments are available for this study. Have an authorized operator provide approved, versioned instruments; this page cannot author tests.</p>}
      {allInstruments.map(item => {
        const current = config.assessments.find(a => a.assessment_id === item.id);
        return <div className={styles.window} key={item.id}>
          <label className={styles.check}><input type="checkbox" name="instrument" value={item.id} defaultChecked={!!current} />{item.label.replaceAll("_", " ")} / {item.instrument_version}</label>
          <small className={styles.identifier}>{item.id}</small><div className={styles.fields}>
            <label>Instrument opens (UTC)<input name={`assessment.${item.id}.opens`} type="datetime-local" step="1" defaultValue={utcInput(current?.opens_at)} /></label>
            <label>Instrument closes (UTC)<input name={`assessment.${item.id}.closes`} type="datetime-local" step="1" defaultValue={utcInput(current?.closes_at)} /></label>
            <label>Timer limit (seconds)<input name={`timer.${item.id}`} type="number" min="1" max="2147483647" defaultValue={current?.timer_limit_seconds ?? ""} /></label>
          </div>
        </div>;
      })}
    </fieldset>
    <ResearchAssessmentStatus publication={study.assessment_publication} />
    <fieldset disabled={disabled || study.status !== "DRAFT"}>
      <legend>5. Assessment delivery draft</legend>
      <input type="hidden" name="delivery.present" value="1" />
      <label className={styles.check}><input type="checkbox" name="delivery.enabled" defaultChecked={!!delivery} />Save an assessment delivery draft in this revision</label>
      <label>Delivery draft version<input name="delivery.version" maxLength={80} defaultValue={delivery?.version ?? ""} /></label>
      <p>The same blueprint, difficulty and scoring policies apply to both conditions. Use existing frozen instruments selected above. These declarations do not verify instrument approval or execute grading.</p>
      <div className={styles.fields}>
        <PolicyFields name="delivery.blueprint" title="Common blueprint policy" value={delivery?.blueprint_policy} />
        <PolicyFields name="delivery.difficulty" title="Common difficulty policy" value={delivery?.difficulty_policy} />
        <PolicyFields name="delivery.scoring" title="Common scoring policy" value={delivery?.scoring_policy} />
      </div>
      {assessmentStages.map(stage => <div key={stage} className={styles.window}>
        <h4>{assessmentStageLabels[stage]}</h4>
        <div className={styles.fields}>
          <label>{assessmentStageLabels[stage]} instrument<select name={`delivery.${stage}.instrument`} defaultValue={delivery?.stages[stage]?.assessment_id ?? ""}>
            <option value="">Unresolved</option>{allInstruments.map(item => <option key={item.id} value={item.id}>{item.label.replaceAll("_", " ")} / {item.instrument_version}</option>)}
          </select></label>
          <label>{assessmentStageLabels[stage]} maximum attempts<input name={`delivery.${stage}.attempts`} type="number" min="1" max="2147483647" defaultValue={delivery?.stages[stage]?.maximum_attempts ?? ""} /></label>
        </div>
        <p className={styles.hint}>Opening/closing times, timer and exact instrument version use the selected frozen instrument settings above. No timer starts when saving.</p>
        <div className={styles.fields}>
          <PolicyFields name={`delivery.${stage}.timeout`} title={`${assessmentStageLabels[stage]} timeout / submission policy`} value={delivery?.stages[stage]?.timeout_policy} />
          <PolicyFields name={`delivery.${stage}.feedback`} title={`${assessmentStageLabels[stage]} feedback policy`} value={delivery?.stages[stage]?.feedback_policy} />
        </div>
      </div>)}
      <div className={styles.window}><h4>Delayed follow-up interval</h4>
        <p>The proposed interval starts after immediate post-test completion. It is not an immediate second quiz. No interval is assumed or enforced by this draft.</p>
        <label>Proposed minimum delay (seconds)<input name="delivery.delay" type="number" min="1" max="2147483647" defaultValue={delivery?.delayed_follow_up?.minimum_delay_seconds ?? ""} /></label>
        <PolicyFields name="delivery.follow_up" title="Delayed follow-up policy" value={delivery?.delayed_follow_up?.policy} />
      </div>
      <p>Unchecked removes this plan only from the new revision; prior revisions stay retained. Review practice and questionnaires have no countdown added by this form.</p>
    </fieldset>
    <fieldset disabled={disabled || study.status !== "DRAFT"}>
      <legend>6. Permission and instrument requirements</legend>
      <label>Consent document version (configuration only)<input name="consent_document_version" maxLength={80} defaultValue={config.consent_document_version ?? ""} /></label>
      <fieldset className={styles.weekdays}><legend>Required evidence kinds in the approved protocol</legend>
        {["consent", "guardian_consent", "assent"].map(kind => <label key={kind}><input type="checkbox" name="consent_kind" value={kind} defaultChecked={config.consent_requirements?.includes(kind) ?? false} />{kind.replaceAll("_", " ")}</label>)}
      </fieldset>
      <div className={styles.fields}>{["protocol", "ethics", "site_permission", "instruments", "conditions"].map(kind => <label key={kind}>{kind.replaceAll("_", " ")} evidence reference<input name={`evidence.${kind}`} maxLength={500} defaultValue={config.declared_evidence[kind] ?? ""} /></label>)}</div>
      <p>References are declarations only. Independent approval must be recorded through the authorized operator process. This form records no participant consent and cannot verify ethics approval.</p>
    </fieldset>
    {error && <p role="alert" className="error">{error}</p>}
    {study.status === "DRAFT" ? <><label className={styles.check}><input type="checkbox" required disabled={disabled} />I reviewed these proposed changes and want to retain a new draft revision.</label><Button type="submit" disabled={disabled || !dirty}>Save draft revision</Button></> : <p>This protocol is frozen in {study.status}. A changed protocol requires a new study.</p>}
  </form>;
}
