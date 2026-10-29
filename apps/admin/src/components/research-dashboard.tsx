"use client";

import { useState, useEffect } from "react";
import type { AdminProfile } from "@/services/admin-contract";

interface ResearchStudy {
  id: string;
  code: string;
  title: string;
  target_language: string;
  protocol_version: string;
  status: string;
  target_participants: number;
  enrolled_count: number;
  active_count: number;
  withdrawn_count: number;
}

interface DescriptiveMetric {
  count: number;
  mean: number | null;
  median: number | null;
  std_dev: number | null;
  min_value: number | null;
  max_value: number | null;
  mean_percentage: number | null;
  is_small_cell: boolean;
}

interface AssessmentComparison {
  assessment_id: string;
  kind: string;
  title: string;
  instrument_version: string;
  maximum_possible: number;
  control_stats: DescriptiveMetric;
  experimental_stats: DescriptiveMetric;
  overall_stats: DescriptiveMetric;
}

interface PairedComparisons {
  absolute_gain_control: DescriptiveMetric;
  absolute_gain_experimental: DescriptiveMetric;
  normalized_gain_control: DescriptiveMetric;
  normalized_gain_experimental: DescriptiveMetric;
  retention_loss_control: DescriptiveMetric;
  retention_loss_experimental: DescriptiveMetric;
}

interface EngagementSummary {
  total_review_events: number;
  active_learners: number;
  mean_reviews_per_learner: number;
  retention_accuracy_pct: number;
  mean_duration_ms: number;
  total_lapses: number;
  rating_counts: Record<string, number>;
}

interface StudyAnalyticsSummary {
  study_id: string;
  study_code: string;
  study_title: string;
  target_language: string;
  protocol_version: string;
  flow: {
    target_participants: number;
    total_enrolled: number;
    allocated_control: number;
    allocated_experimental: number;
    active_in_progress: number;
    completed_study: number;
    total_withdrawn: number;
    withdrawn_by_reason: Record<string, number>;
    completion_rate_pct: number;
    dropout_rate_pct: number;
  };
  assessments: AssessmentComparison[];
  paired: PairedComparisons;
  engagement_control: EngagementSummary;
  engagement_experimental: EngagementSummary;
  data_integrity_notice: string;
  ethics_disclaimer: string;
}

export function ResearchDashboard({ initialProfile }: { initialProfile: AdminProfile }) {
  const [studies, setStudies] = useState<ResearchStudy[]>([]);
  const [selectedStudyId, setSelectedStudyId] = useState<string>("");
  const [analytics, setAnalytics] = useState<StudyAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showDictionary, setShowDictionary] = useState<boolean>(false);
  const [dataDictionary, setDataDictionary] = useState<Record<string, unknown> | null>(null);

  // Load research studies on mount
  useEffect(() => {
    async function loadStudies() {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/research/studies");
        if (!res.ok) throw new Error("Could not load research studies.");
        const data: ResearchStudy[] = await res.json();
        setStudies(data);
        if (data.length > 0) {
          setSelectedStudyId(data[0].id);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error connecting to research service.");
      } finally {
        setLoading(false);
      }
    }
    loadStudies();
  }, []);

  // Load analytics when selected study changes
  useEffect(() => {
    if (!selectedStudyId) return;

    async function loadAnalytics() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/research/studies/${selectedStudyId}/analytics`);
        if (!res.ok) throw new Error("Failed to load analytics for the selected study.");
        const data: StudyAnalyticsSummary = await res.json();
        setAnalytics(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unable to retrieve analytics summary.");
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [selectedStudyId]);

  const handleDownload = async (dataset: "participants.csv" | "assessments.csv" | "reviews.csv") => {
    if (!selectedStudyId) return;
    setDownloading(dataset);
    try {
      const res = await fetch(`/api/admin/research/studies/${selectedStudyId}/exports/${dataset}`);
      if (!res.ok) throw new Error(`Export failed for ${dataset}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fluentt_${analytics?.study_code || selectedStudyId}_${dataset}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to download export dataset.");
    } finally {
      setDownloading(null);
    }
  };

  const handleOpenDictionary = async () => {
    if (dataDictionary) {
      setShowDictionary(true);
      return;
    }
    if (!selectedStudyId) return;
    try {
      const res = await fetch(`/api/admin/research/studies/${selectedStudyId}/exports/data-dictionary`);
      if (!res.ok) throw new Error("Failed to load research data dictionary.");
      const dict = await res.json();
      setDataDictionary(dict);
      setShowDictionary(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Unable to retrieve data dictionary.");
    }
  };

  const selectedStudy = studies.find((s) => s.id === selectedStudyId);

  return (
    <div className="research-container" style={{ display: "grid", gap: "28px" }}>
      {/* Top Protocol Header & Study Selector */}
      <div
        className="card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "18px",
          background: "linear-gradient(135deg, #ffffff 0%, #f8faff 100%)",
          border: "1px solid var(--border)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span
              className="badge"
              style={{
                background: "var(--indigo-light)",
                color: "var(--indigo)",
                border: "1px solid #c7d2fe",
              }}
            >
              EXPERIMENTAL PROTOCOL
            </span>
            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
              IRB-2026-FL-001 (Approved)
            </span>
          </div>
          <h2 style={{ margin: "4px 0", fontSize: "20px" }}>
            {selectedStudy ? selectedStudy.title : "Research Analytics Dashboard"}
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
            Protocol Version: <strong>{selectedStudy?.protocol_version || "v1.0"}</strong> • Target Language:{" "}
            <span style={{ textTransform: "capitalize" }}>{selectedStudy?.target_language || "All"}</span> • Status:{" "}
            <span style={{ textTransform: "uppercase", fontWeight: 700, color: "var(--primary)" }}>
              {selectedStudy?.status || "Active"}
            </span> • Authorized Researcher: <strong>{initialProfile.username}</strong>
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>
            Active Study:
            <select
              className="input"
              value={selectedStudyId}
              onChange={(e) => setSelectedStudyId(e.target.value)}
              style={{ marginLeft: "8px", minHeight: "42px", padding: "6px 14px", fontWeight: 600 }}
            >
              {studies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} ({s.target_language})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "16px 20px",
            background: "var(--rose-light)",
            border: "1px solid #fecdd3",
            borderRadius: "12px",
            color: "var(--rose)",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {loading && !analytics && (
        <div className="card" style={{ textAlign: "center", padding: "48px" }}>
          <p style={{ fontWeight: 600, color: "var(--muted)" }}>Computing reproducible study analytics…</p>
        </div>
      )}

      {analytics && (
        <>
          {/* Data Integrity & Scientific Notice */}
          <div
            style={{
              padding: "16px 20px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "14px",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
            }}
          >
            <span style={{ fontSize: "20px" }}>🛡️</span>
            <div>
              <strong style={{ color: "#1e40af", fontSize: "14px" }}>Educational Statistics & Data Integrity Notice</strong>
              <p style={{ fontSize: "13px", color: "#1e3a8a", margin: "4px 0 0" }}>
                {analytics.data_integrity_notice}
              </p>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                {analytics.ethics_disclaimer}
              </p>
            </div>
          </div>

          {/* Section 1: Participant Flow (CONSORT) */}
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "18px", margin: 0, fontWeight: 700 }}>Participant Flow (CONSORT Diagram Metrics)</h3>
              <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                Target Cohort: {analytics.flow.target_participants} students
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "16px",
              }}
            >
              <div className="card" style={{ padding: "20px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                  Enrolled
                </span>
                <div style={{ fontSize: "32px", fontWeight: 800, margin: "6px 0", color: "var(--primary)" }}>
                  {analytics.flow.total_enrolled}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Consented & Assented
                </div>
              </div>

              <div className="card" style={{ padding: "20px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                  Allocated: SM-2 Control
                </span>
                <div style={{ fontSize: "32px", fontWeight: 800, margin: "6px 0", color: "var(--ink)" }}>
                  {analytics.flow.allocated_control}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Traditional spacing
                </div>
              </div>

              <div className="card" style={{ padding: "20px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                  Allocated: ESR Experimental
                </span>
                <div style={{ fontSize: "32px", fontWeight: 800, margin: "6px 0", color: "var(--indigo)" }}>
                  {analytics.flow.allocated_experimental}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  FIFAKT adaptive spacing
                </div>
              </div>

              <div className="card" style={{ padding: "20px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                  Active In Study
                </span>
                <div style={{ fontSize: "32px", fontWeight: 800, margin: "6px 0", color: "#059669" }}>
                  {analytics.flow.active_in_progress}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Currently progressing
                </div>
              </div>

              <div className="card" style={{ padding: "20px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                  Completed Post-Test
                </span>
                <div style={{ fontSize: "32px", fontWeight: 800, margin: "6px 0", color: "var(--primary-dark)" }}>
                  {analytics.flow.completed_study}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Completion: {analytics.flow.completion_rate_pct}%
                </div>
              </div>

              <div className="card" style={{ padding: "20px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                  Withdrawn / Excluded
                </span>
                <div style={{ fontSize: "32px", fontWeight: 800, margin: "6px 0", color: "var(--rose)" }}>
                  {analytics.flow.total_withdrawn}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Dropout: {analytics.flow.dropout_rate_pct}%
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Assessment Outcomes Comparative Table */}
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "18px", margin: 0, fontWeight: 700 }}>
                Instrument-Level Descriptive Outcomes
              </h3>
              <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                Units: Raw Points & Mean % (Max 10.0)
              </span>
            </div>

            <div className="card" style={{ padding: "0", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "14px 16px", fontWeight: 700 }}>Assessment Instrument</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700 }}>Max</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700, color: "var(--ink)" }}>SM-2 Control (Mean ± SD)</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700, color: "var(--indigo)" }}>ESR Experimental (Mean ± SD)</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700, color: "var(--primary)" }}>Overall Cohort (N, Median)</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700 }}>Privacy Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.assessments.map((a) => {
                    const hasSmallCell = a.control_stats.is_small_cell || a.experimental_stats.is_small_cell;
                    return (
                      <tr key={a.assessment_id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "14px 16px" }}>
                          <strong style={{ display: "block", color: "var(--ink)" }}>{a.title}</strong>
                          <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase" }}>
                            Kind: {a.kind} • Version: {a.instrument_version}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", fontWeight: 600 }}>{a.maximum_possible}</td>
                        <td style={{ padding: "14px 16px" }}>
                          {a.control_stats.count > 0 ? (
                            <>
                              <strong>{a.control_stats.mean !== null ? a.control_stats.mean.toFixed(2) : "—"}</strong>
                              {a.control_stats.std_dev !== null && (
                                <span style={{ color: "var(--muted)" }}> ± {a.control_stats.std_dev.toFixed(2)}</span>
                              )}
                              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                                N={a.control_stats.count} • {a.control_stats.mean_percentage}%
                              </div>
                            </>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>No submissions</span>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {a.experimental_stats.count > 0 ? (
                            <>
                              <strong style={{ color: "var(--indigo)" }}>
                                {a.experimental_stats.mean !== null ? a.experimental_stats.mean.toFixed(2) : "—"}
                              </strong>
                              {a.experimental_stats.std_dev !== null && (
                                <span style={{ color: "var(--muted)" }}> ± {a.experimental_stats.std_dev.toFixed(2)}</span>
                              )}
                              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                                N={a.experimental_stats.count} • {a.experimental_stats.mean_percentage}%
                              </div>
                            </>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>No submissions</span>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {a.overall_stats.count > 0 ? (
                            <>
                              <strong>N={a.overall_stats.count}</strong>
                              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                                Median: {a.overall_stats.median ?? "—"} (Min {a.overall_stats.min_value} - Max{" "}
                                {a.overall_stats.max_value})
                              </div>
                            </>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {hasSmallCell ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: "var(--amber-light)",
                                color: "var(--amber)",
                                border: "1px solid #fde68a",
                              }}
                            >
                              ⚠️ N &lt; 5 (Small Cell)
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: "#f0fdf4",
                                color: "#166534",
                                border: "1px solid #bbf7d0",
                              }}
                            >
                              ✓ Sample Adequate
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Paired Learning Gains & Retention Loss */}
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "18px", margin: 0, fontWeight: 700 }}>
                Within-Subject Learning Gains & Retention Decay
              </h3>
              <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                Paired Individual Differences (Descriptive)
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
              {/* Absolute Learning Gain */}
              <div className="card" style={{ padding: "22px" }}>
                <span className="badge" style={{ background: "var(--surface-subtle)", color: "var(--ink)", border: "1px solid var(--border)" }}>
                  POST-TEST − PRE-TEST
                </span>
                <h4 style={{ margin: "12px 0 6px", fontSize: "16px" }}>Absolute Learning Gain (Raw Points)</h4>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px" }}>
                  Direct point increase on identical or parallel baseline vocabulary items.
                </p>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "13px" }}>SM-2 Control (N={analytics.paired.absolute_gain_control.count})</span>
                  <strong>
                    {analytics.paired.absolute_gain_control.mean !== null ? `+${analytics.paired.absolute_gain_control.mean.toFixed(2)}` : "—"}
                    {analytics.paired.absolute_gain_control.std_dev !== null && (
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}> ± {analytics.paired.absolute_gain_control.std_dev.toFixed(2)}</span>
                    )}
                  </strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "13px", color: "var(--indigo)" }}>ESR Experimental (N={analytics.paired.absolute_gain_experimental.count})</span>
                  <strong style={{ color: "var(--indigo)" }}>
                    {analytics.paired.absolute_gain_experimental.mean !== null ? `+${analytics.paired.absolute_gain_experimental.mean.toFixed(2)}` : "—"}
                    {analytics.paired.absolute_gain_experimental.std_dev !== null && (
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}> ± {analytics.paired.absolute_gain_experimental.std_dev.toFixed(2)}</span>
                    )}
                  </strong>
                </div>
              </div>

              {/* Normalized Learning Gain (Hake's g) */}
              <div className="card" style={{ padding: "22px" }}>
                <span className="badge" style={{ background: "var(--surface-subtle)", color: "var(--ink)", border: "1px solid var(--border)" }}>
                  HAKE&apos;S g = (POST − PRE) / (MAX − PRE)
                </span>
                <h4 style={{ margin: "12px 0 6px", fontSize: "16px" }}>Normalized Learning Gain (g)</h4>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px" }}>
                  Proportion of possible improvement achieved, controlling for baseline knowledge.
                </p>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "13px" }}>SM-2 Control (N={analytics.paired.normalized_gain_control.count})</span>
                  <strong>
                    {analytics.paired.normalized_gain_control.mean !== null ? analytics.paired.normalized_gain_control.mean.toFixed(2) : "—"}
                    {analytics.paired.normalized_gain_control.std_dev !== null && (
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}> ± {analytics.paired.normalized_gain_control.std_dev.toFixed(2)}</span>
                    )}
                  </strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "13px", color: "var(--indigo)" }}>ESR Experimental (N={analytics.paired.normalized_gain_experimental.count})</span>
                  <strong style={{ color: "var(--indigo)" }}>
                    {analytics.paired.normalized_gain_experimental.mean !== null ? analytics.paired.normalized_gain_experimental.mean.toFixed(2) : "—"}
                    {analytics.paired.normalized_gain_experimental.std_dev !== null && (
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}> ± {analytics.paired.normalized_gain_experimental.std_dev.toFixed(2)}</span>
                    )}
                  </strong>
                </div>
              </div>

              {/* Delayed Retention Loss */}
              <div className="card" style={{ padding: "22px" }}>
                <span className="badge" style={{ background: "var(--surface-subtle)", color: "var(--ink)", border: "1px solid var(--border)" }}>
                  POST-TEST − DELAYED RETENTION
                </span>
                <h4 style={{ margin: "12px 0 6px", fontSize: "16px" }}>Delayed Retention Loss (Decay)</h4>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px" }}>
                  Score decay after 14-day dormant interval (lower decay indicates superior retention).
                </p>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "13px" }}>SM-2 Control (N={analytics.paired.retention_loss_control.count})</span>
                  <strong>
                    {analytics.paired.retention_loss_control.mean !== null ? `-${analytics.paired.retention_loss_control.mean.toFixed(2)}` : "—"}
                    {analytics.paired.retention_loss_control.std_dev !== null && (
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}> ± {analytics.paired.retention_loss_control.std_dev.toFixed(2)}</span>
                    )}
                  </strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "13px", color: "var(--indigo)" }}>ESR Experimental (N={analytics.paired.retention_loss_experimental.count})</span>
                  <strong style={{ color: "var(--indigo)" }}>
                    {analytics.paired.retention_loss_experimental.mean !== null ? `-${analytics.paired.retention_loss_experimental.mean.toFixed(2)}` : "—"}
                    {analytics.paired.retention_loss_experimental.std_dev !== null && (
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}> ± {analytics.paired.retention_loss_experimental.std_dev.toFixed(2)}</span>
                    )}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Spaced Repetition Review Telemetry */}
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "18px", margin: 0, fontWeight: 700 }}>
                Spaced Repetition Review Engagement & Telemetry
              </h3>
              <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                Audited Review Events from Learner Sessions
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
              {/* SM-2 Control Card */}
              <div className="card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "17px" }}>SM-2 Control Group</h4>
                  <span className="badge" style={{ background: "var(--surface-subtle)", color: "var(--ink)", border: "1px solid var(--border)" }}>
                    Traditional Algorithm
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", margin: "16px 0" }}>
                  <div style={{ background: "var(--surface-subtle)", padding: "12px", borderRadius: "10px" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>TOTAL REVIEWS</div>
                    <div style={{ fontSize: "20px", fontWeight: 800 }}>{analytics.engagement_control.total_review_events}</div>
                  </div>
                  <div style={{ background: "var(--surface-subtle)", padding: "12px", borderRadius: "10px" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>RETENTION ACCURACY</div>
                    <div style={{ fontSize: "20px", fontWeight: 800 }}>{analytics.engagement_control.retention_accuracy_pct}%</div>
                  </div>
                  <div style={{ background: "var(--surface-subtle)", padding: "12px", borderRadius: "10px" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>MEAN LATENCY</div>
                    <div style={{ fontSize: "20px", fontWeight: 800 }}>{analytics.engagement_control.mean_duration_ms} ms</div>
                  </div>
                  <div style={{ background: "var(--surface-subtle)", padding: "12px", borderRadius: "10px" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>TOTAL LAPSES</div>
                    <div style={{ fontSize: "20px", fontWeight: 800 }}>{analytics.engagement_control.total_lapses}</div>
                  </div>
                </div>

                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Rating distribution: Again: {analytics.engagement_control.rating_counts.again || 0} • Hard:{" "}
                  {analytics.engagement_control.rating_counts.hard || 0} • Good:{" "}
                  {analytics.engagement_control.rating_counts.good || 0} • Easy:{" "}
                  {analytics.engagement_control.rating_counts.easy || 0}
                </div>
              </div>

              {/* ESR Experimental Card */}
              <div className="card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "17px", color: "var(--indigo)" }}>ESR Experimental Group</h4>
                  <span className="badge" style={{ background: "var(--indigo-light)", color: "var(--indigo)", border: "1px solid #c7d2fe" }}>
                    FIFAKT Adaptive Algorithm
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", margin: "16px 0" }}>
                  <div style={{ background: "var(--surface-subtle)", padding: "12px", borderRadius: "10px" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>TOTAL REVIEWS</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--indigo)" }}>
                      {analytics.engagement_experimental.total_review_events}
                    </div>
                  </div>
                  <div style={{ background: "var(--surface-subtle)", padding: "12px", borderRadius: "10px" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>RETENTION ACCURACY</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--indigo)" }}>
                      {analytics.engagement_experimental.retention_accuracy_pct}%
                    </div>
                  </div>
                  <div style={{ background: "var(--surface-subtle)", padding: "12px", borderRadius: "10px" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>MEAN LATENCY</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--indigo)" }}>
                      {analytics.engagement_experimental.mean_duration_ms} ms
                    </div>
                  </div>
                  <div style={{ background: "var(--surface-subtle)", padding: "12px", borderRadius: "10px" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>TOTAL LAPSES</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--indigo)" }}>
                      {analytics.engagement_experimental.total_lapses}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Rating distribution: Again: {analytics.engagement_experimental.rating_counts.again || 0} • Hard:{" "}
                  {analytics.engagement_experimental.rating_counts.hard || 0} • Good:{" "}
                  {analytics.engagement_experimental.rating_counts.good || 0} • Easy:{" "}
                  {analytics.engagement_experimental.rating_counts.easy || 0}
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Secure Export Center */}
          <section className="card" style={{ padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <span className="badge" style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }}>
                    RESEARCH DATA EXPORT CENTER
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
                    CWE-1236 Sanitized • De-identified
                  </span>
                </div>
                <h3 style={{ margin: "4px 0", fontSize: "18px" }}>Approved Longitudinal & Assessment Datasets</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", maxWidth: "680px" }}>
                  Download analysis-ready tabular datasets for statistical replication. All exports utilize stable
                  pseudonymous participant codes (<code>P-TAG-XXXXXX</code>) and enforce spreadsheet formula injection
                  prevention. Personally identifiable information is strictly excluded.
                </p>
              </div>

              <button
                type="button"
                className="button secondary-button"
                onClick={handleOpenDictionary}
                style={{ width: "auto", minHeight: "42px", padding: "8px 16px", margin: 0, fontWeight: 700 }}
              >
                📖 View Research Data Dictionary
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "16px",
                marginTop: "24px",
              }}
            >
              <div
                style={{
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <strong style={{ fontSize: "15px", color: "var(--ink)" }}>1. Longitudinal Participant Dataset</strong>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "8px 0 16px" }}>
                    1 row per participant. Includes condition, pre-test, level tests, post-test, retention,
                    absolute/normalized gains, and withdrawal codes.
                  </p>
                </div>
                <button
                  type="button"
                  className="button"
                  disabled={downloading !== null}
                  onClick={() => handleDownload("participants.csv")}
                  style={{ width: "100%", minHeight: "42px" }}
                >
                  {downloading === "participants.csv" ? "Exporting…" : "⬇ Download participants.csv"}
                </button>
              </div>

              <div
                style={{
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <strong style={{ fontSize: "15px", color: "var(--ink)" }}>2. Assessment Attempts Dataset</strong>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "8px 0 16px" }}>
                    1 row per completed assessment submission. Contains exact points, instrument versions, response
                    latency (ms), and submission timestamps.
                  </p>
                </div>
                <button
                  type="button"
                  className="button"
                  disabled={downloading !== null}
                  onClick={() => handleDownload("assessments.csv")}
                  style={{ width: "100%", minHeight: "42px" }}
                >
                  {downloading === "assessments.csv" ? "Exporting…" : "⬇ Download assessments.csv"}
                </button>
              </div>

              <div
                style={{
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <strong style={{ fontSize: "15px", color: "var(--ink)" }}>3. Spaced Repetition Review Log</strong>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "8px 0 16px" }}>
                    Granular review event log. Contains vocabulary term, recall rating, correctness, reaction latency,
                    and interval progression (days).
                  </p>
                </div>
                <button
                  type="button"
                  className="button"
                  disabled={downloading !== null}
                  onClick={() => handleDownload("reviews.csv")}
                  style={{ width: "100%", minHeight: "42px" }}
                >
                  {downloading === "reviews.csv" ? "Exporting…" : "⬇ Download reviews.csv"}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Data Dictionary Modal */}
      {showDictionary && (
        <div className="confirmation-overlay" onClick={() => setShowDictionary(false)}>
          <div
            className="confirmation-dialog card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "780px", maxHeight: "85vh", overflowY: "auto", padding: "32px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "20px" }}>FLUENTT Research Data Dictionary & Codebook</h3>
              <button
                type="button"
                onClick={() => setShowDictionary(false)}
                style={{ background: "transparent", border: 0, fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "var(--muted)" }}>
              Official variable definitions, missing data coding, and privacy safeguards for the thesis experimental analysis.
            </p>

            {dataDictionary && (
              <div style={{ display: "grid", gap: "20px", marginTop: "20px" }}>
                <div>
                  <h4 style={{ fontSize: "15px", marginBottom: "8px" }}>Missing Data Codes</h4>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <tbody>
                      {Object.entries((dataDictionary.missing_data_codes as Record<string, string>) || {}).map(([code, desc]) => (
                        <tr key={code} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 700, width: "120px" }}><code>{code}</code></td>
                          <td style={{ padding: "8px 12px", color: "var(--muted)" }}>{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h4 style={{ fontSize: "15px", marginBottom: "8px" }}>Variable Definitions</h4>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-subtle)" }}>
                        <th style={{ padding: "8px 12px", textAlign: "left" }}>Variable Name</th>
                        <th style={{ padding: "8px 12px", textAlign: "left" }}>Data Type</th>
                        <th style={{ padding: "8px 12px", textAlign: "left" }}>Definition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((dataDictionary.variables as Array<{ name: string; type: string; description: string }>) || []).map((v) => (
                        <tr key={v.name} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 700 }}><code>{v.name}</code></td>
                          <td style={{ padding: "8px 12px", color: "var(--muted)" }}>{v.type}</td>
                          <td style={{ padding: "8px 12px" }}>{v.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
