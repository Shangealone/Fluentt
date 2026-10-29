import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePathway, pathwayAccess, pathwayApi } from '../apps/mobile/src/services/api/pathways.ts';

const stamp = '2026-10-19T00:00:00Z';

const mockPathway = {
  availability: 'available',
  as_of: stamp,
  policy_version: 'deterministic-curriculum-v1',
  student_role: 'school_student',
  class_id: 'demo-class-1',
  class_name: 'Baitang 7 - Mabini',
  current_position: {
    curriculum_version_id: 'v-1',
    curriculum_version_name: 'DepEd MATATAG 2024',
    grade_number: 7,
    subject_id: 'sub-1',
    subject_name: 'Filipino',
    topic_id: 'top-1',
    topic_name: 'Panitikan',
    lesson_id: 'lsn-1',
    lesson_name: 'Kuwentong Bayan',
    position_index: 1,
    total_lessons_in_topic: 4,
  },
  eligible_activities: [
    {
      activity_type: 'assignment',
      id: 'assign-1',
      title: 'Pagsusuri sa Kuwentong Bayan',
      topic_name: 'Panitikan',
      position: 1,
      prerequisites: { total_required: 0, fulfilled: 0, all_met: true },
      is_required: true,
      status: 'in_progress',
      class_id: 'demo-class-1',
      lesson_id: 'lsn-1',
    },
    {
      activity_type: 'lesson',
      id: 'lsn-2',
      title: 'Mga Elemento ng Pabula',
      topic_name: 'Panitikan',
      position: 2,
      prerequisites: { total_required: 1, fulfilled: 0, all_met: false },
      is_required: true,
      status: 'locked',
      class_id: 'demo-class-1',
      lesson_id: 'lsn-2',
    },
  ],
  completed_milestones: [
    {
      kind: 'lesson',
      id: 'ms-1',
      title: 'Panimulang Aralin',
      completed_at: stamp,
      class_id: 'demo-class-1',
      topic_name: 'Panitikan',
    },
  ],
  recommendations: [
    {
      id: 'rec-1',
      recommendation_type: 'classroom_assignment',
      title: 'Continue assignment: Pagsusuri sa Kuwentong Bayan',
      reason: 'Required classroom assignment ready for your attention.',
      target_id: 'assign-1',
      is_required: true,
      class_id: 'demo-class-1',
    },
  ],
};

test('validatePathway validates compliant deterministic pathway data', () => {
  const result = validatePathway(mockPathway);
  assert.equal(result.availability, 'available');
  assert.equal(result.policy_version, 'deterministic-curriculum-v1');
  assert.equal(result.eligible_activities.length, 2);
  assert.equal(result.recommendations.length, 1);
});

test('validatePathway rejects invalid availability or policy versions', () => {
  assert.throws(() => validatePathway({ ...mockPathway, availability: 'unknown' }));
  assert.throws(() => validatePathway({ ...mockPathway, policy_version: 'sm2-fsrs-v1' }));
  assert.throws(() => validatePathway({ ...mockPathway, as_of: 'not-a-date' }));
  assert.throws(() => validatePathway({ ...mockPathway, student_role: 'instructor' }));
});

test('validatePathway rejects malformed activities', () => {
  assert.throws(() =>
    validatePathway({
      ...mockPathway,
      eligible_activities: [{ ...mockPathway.eligible_activities[0], position: -1 }],
    })
  );
  assert.throws(() =>
    validatePathway({
      ...mockPathway,
      eligible_activities: [{ ...mockPathway.eligible_activities[0], status: 'predicted' }],
    })
  );
});

test('pathwayApi performs authenticated request with class scoping', async () => {
  const prevUrl = process.env.EXPO_PUBLIC_API_URL;
  const originalFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000';
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json(mockPathway);
  };

  try {
    const api = pathwayAccess(async (operation) => operation('token-123'));
    const data = await api.pathway('demo-class-1');
    assert.equal(data.availability, 'available');
    assert(calls[0].url.includes('/me/pathway?class_id=demo-class-1'));
    assert.equal(calls[0].options.headers.Authorization, 'Bearer token-123');
  } finally {
    globalThis.fetch = originalFetch;
    if (prevUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = prevUrl;
  }
});
