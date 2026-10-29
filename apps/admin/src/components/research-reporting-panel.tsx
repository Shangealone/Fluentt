import { Button } from "./ui";
import type { Study } from "@/services/research-classroom-contract";
import { metricLabels } from "@/services/research-reporting-contract";
import styles from "./research-setup.module.css";

export function ResearchReportingPanel({ study }: { study: Study }) {
  const reporting = study.reporting;
  if (!reporting) return <p role="status">Reporting status is unavailable. Refresh and verify access.</p>;
  return <section aria-label="Research monitoring and disclosure readiness">
    <h3>Research monitoring</h3>
    <p>Results are unavailable until approved participant authorization, instruments, measurement and disclosure rules are in place. N/A means unavailable; it does not mean zero students, zero responses or a zero score.</p>
    <dl className={styles.summary}>
      <div><dt>Questionnaire</dt><dd>UNPUBLISHED</dd></div>
      <div><dt>Responses</dt><dd>N/A</dd></div>
      <div><dt>Thesis exports</dt><dd>BLOCKED</dd></div>
    </dl>
    <p>Protocol {study.protocol_version}, configuration revision {study.configuration_version}. Configured study dates: {study.configuration.starts_at ?? "Unresolved"} to {study.configuration.ends_at ?? "Unresolved"}. These are planned dates, not an observed measurement window.</p>
    <p>Questionnaire instrument: N/A. No approved questions or scales are published. No inferred significance, gains, retention, model predictions or pronunciation results are presented.</p>
    <ul>{reporting.blockers.map(reason => <li key={reason}>{reason.replaceAll("_", " ")}</li>)}</ul>
    <div className={styles.fields}>{reporting.metrics.map(metric => <article key={metric.key} className={styles.empty}>
      <h4>{metricLabels[metric.key]}</h4><strong>N/A</strong>
      <p>Sample size: N/A · Denominator: N/A<br />Observation window: N/A<br />Instrument / algorithm / metric version: N/A</p>
    </article>)}</div>
    <p>No authorized dataset is available for disclosure. Withdrawal handling and small-cell suppression require an approved policy. The planned participant target is not an analysis denominator.</p>
    <Button type="button" disabled>Export thesis data (blocked)</Button>
    <p className={styles.hint}>Availability contract: {reporting.contract_version}. This identifies the readiness response, not a validated metric or questionnaire version.</p>
  </section>;
}
