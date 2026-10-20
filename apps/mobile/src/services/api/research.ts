import { request } from "./client.ts";

export interface ResearchStudy {
  id: string;
  code: string;
  title: string;
  status: "draft" | "approved" | "active" | "completed" | "archived";
  target_language: string;
  protocol_version: string;
  target_participants: number;
  enrolled_count: number;
  withdrawn_count: number;
  starts_at?: string | null;
  ends_at?: string | null;
  conditions: Record<string, any>;
  locked_at?: string | null;
}

export interface AvailableStudiesResponse {
  studies: ResearchStudy[];
  count: number;
  ethics_disclaimer: string;
}

export interface ConsentDocument {
  study_id: string;
  study_code: string;
  study_title: string;
  target_language: string;
  protocol_version: string;
  consent_document_version: string;
  purpose: string;
  procedures: string;
  voluntary_nature: string;
  confidentiality_and_pseudonymization: string;
  data_retention_policy: string;
  withdrawal_rights: string;
  ethics_statement: string;
  required_affirmation: string;
  retention_notice: string;
}

export interface ParticipantEligibility {
  study_id: string;
  study_code: string;
  eligible: boolean;
  reasons: string[];
  current_status?: "pending" | "enrolled" | "withdrawn" | "completed" | null;
  target_language_match: boolean;
  recruitment_open: boolean;
  quota_available: boolean;
  protocol_version: string;
}

export interface EnrollmentReceipt {
  participant_id: string;
  participant_code: string;
  study_id: string;
  study_code: string;
  protocol_version: string;
  enrollment_status: "enrolled";
  enrolled_at: string;
  ethics_disclaimer: string;
  retention_notice: string;
}

export interface WithdrawalReceipt {
  participant_id: string;
  study_code: string;
  enrollment_status: "withdrawn";
  withdrawn_at: string;
  retention_notice: string;
}

export interface ParticipantStatus {
  participant_id: string;
  participant_code: string;
  study_id: string;
  study_code: string;
  study_title: string;
  target_language: string;
  protocol_version: string;
  enrollment_status: "pending" | "enrolled" | "withdrawn" | "completed";
  eligibility_status: "pending" | "eligible" | "ineligible";
  enrolled_at?: string | null;
  withdrawn_at?: string | null;
  ethics_disclaimer: string;
  retention_notice: string;
}

export function validateStudiesResponse(data: any): AvailableStudiesResponse {
  if (
    !data ||
    !Array.isArray(data.studies) ||
    typeof data.count !== "number" ||
    typeof data.ethics_disclaimer !== "string"
  ) {
    throw new Error("Malformed available research studies response");
  }
  return data as AvailableStudiesResponse;
}

export function validateConsentDocument(data: any): ConsentDocument {
  if (
    !data ||
    typeof data.study_id !== "string" ||
    typeof data.protocol_version !== "string" ||
    typeof data.ethics_statement !== "string" ||
    typeof data.retention_notice !== "string"
  ) {
    throw new Error("Malformed consent document response");
  }
  return data as ConsentDocument;
}

export function validateEnrollmentReceipt(data: any): EnrollmentReceipt {
  if (
    !data ||
    typeof data.participant_id !== "string" ||
    typeof data.participant_code !== "string" ||
    data.enrollment_status !== "enrolled" ||
    typeof data.ethics_disclaimer !== "string"
  ) {
    throw new Error("Malformed enrollment receipt response");
  }
  return data as EnrollmentReceipt;
}

export function validateWithdrawalReceipt(data: any): WithdrawalReceipt {
  if (
    !data ||
    typeof data.participant_id !== "string" ||
    data.enrollment_status !== "withdrawn" ||
    typeof data.retention_notice !== "string"
  ) {
    throw new Error("Malformed withdrawal receipt response");
  }
  return data as WithdrawalReceipt;
}

export const researchApi = {
  studies: async (token: string, language?: string): Promise<AvailableStudiesResponse> => {
    const query = language ? `?language=${encodeURIComponent(language)}` : "";
    const res = await request<AvailableStudiesResponse>(`/me/research/studies${query}`, "GET", undefined, token);
    return validateStudiesResponse(res);
  },

  study: async (token: string, studyId: string): Promise<ResearchStudy> => {
    return request<ResearchStudy>(`/me/research/studies/${studyId}`, "GET", undefined, token);
  },

  eligibility: async (token: string, studyId: string): Promise<ParticipantEligibility> => {
    return request<ParticipantEligibility>(`/me/research/studies/${studyId}/eligibility`, "GET", undefined, token);
  },

  consentDocument: async (token: string, studyId: string): Promise<ConsentDocument> => {
    const res = await request<ConsentDocument>(`/me/research/studies/${studyId}/consent-document`, "GET", undefined, token);
    return validateConsentDocument(res);
  },

  enroll: async (
    token: string,
    studyId: string,
    payload: {
      protocol_version: string;
      consent_kind?: "consent" | "guardian_consent" | "assent";
      consent_decision?: "granted";
      affirmation_confirmed: boolean;
      evidence_summary?: string;
    }
  ): Promise<EnrollmentReceipt> => {
    const res = await request<EnrollmentReceipt>(
      `/me/research/studies/${studyId}/enroll`,
      "POST",
      {
        protocol_version: payload.protocol_version,
        consent_kind: payload.consent_kind || "consent",
        consent_decision: payload.consent_decision || "granted",
        affirmation_confirmed: payload.affirmation_confirmed,
        evidence_summary: payload.evidence_summary,
      },
      token
    );
    return validateEnrollmentReceipt(res);
  },

  myStatus: async (token: string): Promise<ParticipantStatus[]> => {
    return request<ParticipantStatus[]>("/me/research/status", "GET", undefined, token);
  },

  withdraw: async (
    token: string,
    studyId: string,
    payload?: {
      reason_category?: string;
      notes?: string;
    }
  ): Promise<WithdrawalReceipt> => {
    const res = await request<WithdrawalReceipt>(
      `/me/research/studies/${studyId}/withdraw`,
      "POST",
      {
        reason_category: payload?.reason_category || "voluntary_withdrawal",
        notes: payload?.notes,
      },
      token
    );
    return validateWithdrawalReceipt(res);
  },

  experimentStatus: async (token: string, studyId: string): Promise<BlindedExperimentStatus> => {
    return request<BlindedExperimentStatus>(`/me/research/studies/${studyId}/experiment`, "GET", undefined, token);
  },

  allocate: async (token: string, studyId: string, preferredSeed?: number): Promise<GroupAllocationReceipt> => {
    return request<GroupAllocationReceipt>(
      `/me/research/studies/${studyId}/allocate`,
      "POST",
      { preferred_seed: preferredSeed },
      token
    );
  },

  assessments: async (token: string, studyId: string): Promise<ResearchAssessmentListItem[]> => {
    return request<ResearchAssessmentListItem[]>(`/me/research/studies/${studyId}/assessments`, "GET", undefined, token);
  },

  assessmentDetail: async (token: string, studyId: string, assessmentId: string): Promise<ResearchAssessmentDetail> => {
    return request<ResearchAssessmentDetail>(`/me/research/studies/${studyId}/assessments/${assessmentId}`, "GET", undefined, token);
  },

  startAssessment: async (token: string, studyId: string, assessmentId: string): Promise<StartAssessmentReceipt> => {
    return request<StartAssessmentReceipt>(`/me/research/studies/${studyId}/assessments/${assessmentId}/start`, "POST", {}, token);
  },

  submitAssessment: async (
    token: string,
    studyId: string,
    assessmentId: string,
    payload: SubmitAssessmentRequest
  ): Promise<SubmitAssessmentReceipt> => {
    return request<SubmitAssessmentReceipt>(
      `/me/research/studies/${studyId}/assessments/${assessmentId}/submit`,
      "POST",
      payload,
      token
    );
  },
};

export type AssessmentKind = "pre_test" | "learning_level" | "post_test" | "delayed_retention" | "pronunciation";
export type AssessmentAttemptStatus = "not_started" | "in_progress" | "completed" | "invalidated";

export interface BlindedExperimentStatus {
  study_id: string;
  study_code: string;
  study_title: string;
  target_language: string;
  protocol_version: string;
  participant_id: string;
  participant_code: string;
  is_enrolled: boolean;
  is_allocated: boolean;
  is_withdrawn: boolean;
  condition_blinded: string;
  current_level_number: number;
  next_activity: string;
  pre_test_completed: boolean;
  levels_completed: number[];
  post_test_completed: boolean;
  delayed_retention_completed: boolean;
  pronunciation_completed: boolean;
  ethics_disclaimer: string;
}

export interface GroupAllocationReceipt {
  assignment_id: string;
  participant_id: string;
  participant_code: string;
  study_id: string;
  assignment_number: number;
  assigned_at: string;
  allocation_method: string;
  condition_blinded: string;
  condition_unblinded?: string | null;
  reproducibility_seed?: number | null;
  target_group_size: number;
  ethics_disclaimer: string;
}

export interface ResearchAssessmentListItem {
  assessment_id: string;
  study_id: string;
  kind: AssessmentKind;
  level_id?: string | null;
  level_number?: number | null;
  title: string;
  instrument_version: string;
  time_limit_seconds?: number | null;
  total_points: number;
  is_unlocked: boolean;
  attempt_status: AssessmentAttemptStatus;
  score?: number | null;
  maximum_score?: number | null;
  completed_at?: string | null;
}

export interface ResearchAssessmentItem {
  item_id: string;
  prompt: string;
  item_type: "multiple_choice" | "identification" | "true_false" | "pronunciation_read";
  options?: string[] | null;
  points: number;
  audio_prompt_url?: string | null;
}

export interface ResearchAssessmentDetail {
  assessment_id: string;
  study_id: string;
  kind: AssessmentKind;
  instrument_version: string;
  title: string;
  instructions: string;
  time_limit_seconds?: number | null;
  items: ResearchAssessmentItem[];
  total_points: number;
  attempt_status: AssessmentAttemptStatus;
  attempt_id?: string | null;
}

export interface StartAssessmentReceipt {
  attempt_id: string;
  assessment_id: string;
  participant_id: string;
  attempt_number: number;
  started_at: string;
  time_limit_seconds?: number | null;
  status: "in_progress";
}

export interface SubmitAssessmentRequest {
  attempt_id: string;
  responses: Record<string, string>;
  response_duration_ms: number;
  audio_submission_reference?: string | null;
}

export interface SubmitAssessmentReceipt {
  result_id: string;
  assessment_id: string;
  participant_id: string;
  participant_code: string;
  attempt_number: number;
  status: "completed" | "invalidated";
  score: number;
  maximum_score: number;
  percentage: number;
  feedback_message: string;
  submitted_at: string;
  ethics_disclaimer: string;
}

export interface ResearchAccess {
  studies: (language?: string) => Promise<AvailableStudiesResponse>;
  study: (studyId: string) => Promise<ResearchStudy>;
  eligibility: (studyId: string) => Promise<ParticipantEligibility>;
  consentDocument: (studyId: string) => Promise<ConsentDocument>;
  enroll: (
    studyId: string,
    payload: {
      protocol_version: string;
      consent_kind?: "consent" | "guardian_consent" | "assent";
      consent_decision?: "granted";
      affirmation_confirmed: boolean;
      evidence_summary?: string;
    }
  ) => Promise<EnrollmentReceipt>;
  myStatus: () => Promise<ParticipantStatus[]>;
  withdraw: (
    studyId: string,
    payload?: {
      reason_category?: string;
      notes?: string;
    }
  ) => Promise<WithdrawalReceipt>;
  experimentStatus: (studyId: string) => Promise<BlindedExperimentStatus>;
  allocate: (studyId: string, preferredSeed?: number) => Promise<GroupAllocationReceipt>;
  assessments: (studyId: string) => Promise<ResearchAssessmentListItem[]>;
  assessmentDetail: (studyId: string, assessmentId: string) => Promise<ResearchAssessmentDetail>;
  startAssessment: (studyId: string, assessmentId: string) => Promise<StartAssessmentReceipt>;
  submitAssessment: (
    studyId: string,
    assessmentId: string,
    payload: SubmitAssessmentRequest
  ) => Promise<SubmitAssessmentReceipt>;
}

export function researchAccess(
  runner: <T>(operation: (credential: string) => Promise<T>) => Promise<T>
): ResearchAccess {
  return {
    studies: (language?: string) => runner((token) => researchApi.studies(token, language)),
    study: (studyId: string) => runner((token) => researchApi.study(token, studyId)),
    eligibility: (studyId: string) => runner((token) => researchApi.eligibility(token, studyId)),
    consentDocument: (studyId: string) => runner((token) => researchApi.consentDocument(token, studyId)),
    enroll: (studyId: string, payload) => runner((token) => researchApi.enroll(token, studyId, payload)),
    myStatus: () => runner((token) => researchApi.myStatus(token)),
    withdraw: (studyId: string, payload) => runner((token) => researchApi.withdraw(token, studyId, payload)),
    experimentStatus: (studyId: string) => runner((token) => researchApi.experimentStatus(token, studyId)),
    allocate: (studyId: string, preferredSeed?: number) => runner((token) => researchApi.allocate(token, studyId, preferredSeed)),
    assessments: (studyId: string) => runner((token) => researchApi.assessments(token, studyId)),
    assessmentDetail: (studyId: string, assessmentId: string) => runner((token) => researchApi.assessmentDetail(token, studyId, assessmentId)),
    startAssessment: (studyId: string, assessmentId: string) => runner((token) => researchApi.startAssessment(token, studyId, assessmentId)),
    submitAssessment: (studyId: string, assessmentId: string, payload: SubmitAssessmentRequest) =>
      runner((token) => researchApi.submitAssessment(token, studyId, assessmentId, payload)),
  };
}
