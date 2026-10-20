import { request, ApiError } from "./client.ts";

export type ReviewRating = "again" | "hard" | "good" | "easy";
export type EvaluationContext = "self_study" | "classroom" | "research";

export type ReviewEventInput = {
  event_key: string;
  vocabulary_item_id: string;
  recall_rating: ReviewRating;
  response_duration_ms: number;
  reviewed_at: string;
  context_type?: EvaluationContext;
  class_id?: string | null;
  study_id?: string | null;
};

export type DueReviewItem = {
  review_state_id: string;
  vocabulary_item_id: string;
  term: string;
  meaning: string;
  language: string;
  due_at: string;
  last_reviewed_at?: string | null;
  overdue_seconds: number;
};

export type DueReviewBatch = {
  items: DueReviewItem[];
  total_due: number;
  algorithm: string;
  as_of: string;
};

export type ReviewDecisionResult = {
  status: "committed" | "replayed";
  event_key: string;
  state_revision: number;
  due_at?: string;
  interval_seconds?: number;
};

export type AvailableAlgorithms = {
  available_algorithms: string[];
  policy: string;
};

export type ReviewsAccess = {
  algorithms: () => Promise<AvailableAlgorithms>;
  dueReviews: (algorithm?: string, contextType?: EvaluationContext, classId?: string, limit?: number) => Promise<DueReviewBatch>;
  submitReview: (event: ReviewEventInput, algorithm?: string) => Promise<ReviewDecisionResult>;
};

function invalid(message?: string): never {
  throw new ApiError(0, message ?? "Unexpected reviews data. Refresh and try again.");
}

const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

export function validateDueBatch(batch: DueReviewBatch): DueReviewBatch {
  if (!batch || !Array.isArray(batch.items) || typeof batch.total_due !== "number" || typeof batch.algorithm !== "string" || !date(batch.as_of)) {
    invalid("Malformed due review batch response.");
  }
  for (const item of batch.items) {
    if (!item || typeof item.review_state_id !== "string" || typeof item.vocabulary_item_id !== "string" || typeof item.term !== "string" || !date(item.due_at)) {
      invalid("Malformed due review item.");
    }
  }
  return batch;
}

export const reviewsApi = {
  getAlgorithms: async (secret: string): Promise<AvailableAlgorithms> => {
    return request<AvailableAlgorithms>("/me/reviews/algorithms", "GET", undefined, secret);
  },

  getDueReviews: async (
    secret: string,
    algorithm: string = "sm2",
    contextType: EvaluationContext = "self_study",
    classId?: string,
    limit: number = 50
  ): Promise<DueReviewBatch> => {
    const params = new URLSearchParams({
      algorithm,
      context_type: contextType,
      limit: String(limit),
    });
    if (classId) {
      params.set("class_id", classId);
    }
    const res = await request<DueReviewBatch>(`/me/reviews/due?${params.toString()}`, "GET", undefined, secret);
    return validateDueBatch(res);
  },

  submitReview: async (
    secret: string,
    event: ReviewEventInput,
    algorithm: string = "sm2"
  ): Promise<ReviewDecisionResult> => {
    const params = new URLSearchParams({ algorithm });
    return request<ReviewDecisionResult>(`/me/reviews/events?${params.toString()}`, "POST", event, secret);
  },
};

export function reviewsAccess(run: <T>(operation: (credential: string) => Promise<T>) => Promise<T>): ReviewsAccess {
  return {
    algorithms: () => run(secret => reviewsApi.getAlgorithms(secret)),
    dueReviews: (algorithm = "sm2", contextType = "self_study", classId?: string, limit = 50) =>
      run(secret => reviewsApi.getDueReviews(secret, algorithm, contextType, classId, limit)),
    submitReview: (event: ReviewEventInput, algorithm = "sm2") =>
      run(secret => reviewsApi.submitReview(secret, event, algorithm)),
  };
}
