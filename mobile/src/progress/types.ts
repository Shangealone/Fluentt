export interface RecentActivityItem {
  attempt_id: string;
  vocabulary_item_id: string;
  term: string;
  correct: boolean;
  performance_rating: string | null;
  created_at: string;
}

export interface LearnerProgressResponse {
  total_reviews: number;
  unique_vocabulary_reviewed: number;
  streak_days: number;
  performance_breakdown: {
    again: number;
    hard: number;
    good: number;
    easy: number;
    [key: string]: number;
  };
  recent_activity: RecentActivityItem[];
}
