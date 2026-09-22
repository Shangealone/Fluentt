export type PerformanceRating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewSessionCreate {
  client_session_id: string;
  lesson_id?: string | null;
}

export interface ReviewSession {
  id: string;
  user_id: string;
  client_session_id: string;
  lesson_id: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface ReviewAttemptCreate {
  client_event_id: string;
  session_id: string;
  client_session_id?: string;
  vocabulary_item_id: string;
  response_time_ms: number;
  performance_rating: PerformanceRating;
  correct?: boolean;
  submitted_answer?: string;
  client_interaction_at?: string;
  device_platform?: string;
  application_version?: string;
  created_at?: string;
}

export interface SchedulingResult {
  vocabulary_item_id: string;
  interval_minutes: number;
  due_date: string;
  repetition_number: number;
  scheduler_type: string;
  algorithm_version: string;
}

export interface ReviewAttemptResponse {
  attempt_id?: string;
  id?: string;
  client_event_id: string;
  session_id: string;
  vocabulary_item_id: string;
  response_time_ms: number;
  performance_rating?: string;
  correct?: boolean;
  created_at?: string;
  schedule?: SchedulingResult;
  next_due_at?: string;
}
