import { request, ApiError } from "./client.ts";

export type ActivityType = "lesson" | "assignment" | "flashcard_practice";
export type ActivityStatus = "available" | "in_progress" | "completed" | "locked";
export type RecommendationType = "next_lesson" | "classroom_assignment" | "self_study_practice" | "review_lesson";

export type PrerequisiteStatus = {
  total_required: number;
  fulfilled: number;
  all_met: boolean;
};

export type CurrentMilestone = {
  kind: "lesson" | "assignment";
  id: string;
  title: string;
  completed_at: string;
  class_id?: string | null;
  topic_name?: string | null;
};

export type EligibleActivity = {
  activity_type: ActivityType;
  id: string;
  title: string;
  topic_name?: string | null;
  position: number;
  prerequisites: PrerequisiteStatus;
  is_required: boolean;
  status: ActivityStatus;
  class_id?: string | null;
  lesson_id?: string | null;
};

export type Recommendation = {
  id: string;
  recommendation_type: RecommendationType;
  title: string;
  reason: string;
  target_id: string;
  is_required: boolean;
  class_id?: string | null;
};

export type CurrentPosition = {
  curriculum_version_id?: string | null;
  curriculum_version_name?: string | null;
  grade_number?: number | null;
  subject_id?: string | null;
  subject_name?: string | null;
  topic_id?: string | null;
  topic_name?: string | null;
  lesson_id?: string | null;
  lesson_name?: string | null;
  position_index: number;
  total_lessons_in_topic: number;
};

export type LearningPathway = {
  availability: "available" | "empty" | "unavailable";
  as_of: string;
  policy_version: "deterministic-curriculum-v1";
  student_role: "school_student" | "personal_student";
  class_id?: string | null;
  class_name?: string | null;
  current_position?: CurrentPosition | null;
  eligible_activities: EligibleActivity[];
  completed_milestones: CurrentMilestone[];
  recommendations: Recommendation[];
};

export type PathwayAccess = {
  pathway: (classId?: string) => Promise<LearningPathway>;
};

function invalid(): never {
  throw new ApiError(0, "Unexpected learning pathway data. Refresh to verify your curriculum position.");
}

const natural = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

export function validatePathway(pathway: LearningPathway): LearningPathway {
  if (!pathway || !["available", "empty", "unavailable"].includes(pathway.availability) || pathway.policy_version !== "deterministic-curriculum-v1" || !date(pathway.as_of)) {
    invalid();
  }
  if (!["school_student", "personal_student"].includes(pathway.student_role)) {
    invalid();
  }
  if (!Array.isArray(pathway.eligible_activities) || !Array.isArray(pathway.completed_milestones) || !Array.isArray(pathway.recommendations)) {
    invalid();
  }
  for (const item of pathway.eligible_activities) {
    if (!item || typeof item.id !== "string" || typeof item.title !== "string" || !natural(item.position) || typeof item.is_required !== "boolean" || !["available", "in_progress", "completed", "locked"].includes(item.status)) {
      invalid();
    }
  }
  return pathway;
}

export const pathwayApi = {
  get: async (secret: string, classId?: string): Promise<LearningPathway> => {
    const url = `/me/pathway${classId ? `?class_id=${encodeURIComponent(classId)}` : ""}`;
    return validatePathway(await request<LearningPathway>(url, "GET", undefined, secret));
  },
};

export function pathwayAccess(run: <T>(operation: (credential: string) => Promise<T>) => Promise<T>): PathwayAccess {
  return {
    pathway: (classId?: string) => run(secret => pathwayApi.get(secret, classId)),
  };
}
