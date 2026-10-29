export const metricLabels = {
  participant_flow: "Participant flow", assignment_adherence: "Assignment adherence", review_adherence: "Review adherence",
  pre_test_completion: "Pre-test completion", immediate_post_test_completion: "Immediate post-test completion",
  delayed_retention_completion: "Delayed retention completion", assessment_results: "Assessment results",
  recall_accuracy: "Recall accuracy", review_count: "Review count", workload: "Actual workload",
  active_study_duration: "Active study time", study_duration: "Observed study duration", pronunciation_score: "Verified pronunciation score",
  questionnaire_responses: "Questionnaire responses", questionnaire_distributions: "Questionnaire distributions",
  missing_data: "Missing outcomes", learning_gain: "Learning gain", retention: "Retention",
} as const;
export type UnavailableMetric = { key: keyof typeof metricLabels; status: "UNAVAILABLE"; value: null; sample_size: null;
  denominator: null; observation_window: null; instrument_version: null; algorithm_version: null; metric_version: null;
  reason: "authorized_measurement_unavailable" };
export type ReportingReadiness = { contract_version: "research-reporting-readiness-v1"; observed_results_available: false;
  inferential_statistics_available: false; export_status: "BLOCKED"; blockers: string[];
  questionnaire: { publication_status: "UNPUBLISHED"; collection_available: false; instrument_version: null; response_count: null };
  metrics: UnavailableMetric[] };
export function isReportingReadiness(value: unknown): value is ReportingReadiness {
  if (!value || typeof value !== "object") return false;
  const row = value as ReportingReadiness;
  return row.contract_version === "research-reporting-readiness-v1" && row.observed_results_available === false
    && row.inferential_statistics_available === false && row.export_status === "BLOCKED"
    && Array.isArray(row.blockers) && row.blockers.every(b => typeof b === "string")
    && !!row.questionnaire && row.questionnaire.publication_status === "UNPUBLISHED" && row.questionnaire.collection_available === false
    && row.questionnaire.instrument_version === null && row.questionnaire.response_count === null
    && Array.isArray(row.metrics) && row.metrics.length === Object.keys(metricLabels).length
    && new Set(row.metrics.map(m => m?.key)).size === row.metrics.length
    && row.metrics.every(m => !!m && Object.hasOwn(metricLabels, m.key) && m.status === "UNAVAILABLE"
      && m.reason === "authorized_measurement_unavailable"
      && [m.value, m.sample_size, m.denominator, m.observation_window, m.instrument_version, m.algorithm_version, m.metric_version].every(v => v === null));
}
