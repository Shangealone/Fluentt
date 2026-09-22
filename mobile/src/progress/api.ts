import { apiClient } from '../api/client';
import { LearnerProgressResponse } from './types';

export async function fetchLearnerProgress(): Promise<LearnerProgressResponse> {
  return apiClient<LearnerProgressResponse>('/analytics/progress');
}
