import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMaterialPage,
  validateNotificationPage,
  materialsApi,
  notificationsApi,
  materialsAccess,
  notificationsAccess,
} from '../apps/mobile/src/services/api/materials.ts';
import { routeAllowed } from '../apps/mobile/src/session/routing.ts';

const stamp = '2026-10-19T00:00:00Z';

const mockMaterialPage = {
  items: [
    {
      id: 'mat-1',
      lesson_id: 'lesson-1',
      title: 'Kuwentong Bayan Reading Guide',
      description: 'Pangunahing gabay sa pagbasa',
      resource_type: 'reading',
      content_text: 'Teksto ng kuwentong bayan...',
      reference_url: null,
      media_url: null,
      is_required: true,
      source_metadata: {},
    },
  ],
  lesson_id: 'lesson-1',
  lesson_name: 'Kuwentong Bayan',
  total_count: 1,
  as_of: stamp,
};

const mockNotificationPage = {
  items: [
    {
      id: 'notif-1',
      event_type: 'assignment_published',
      title: 'Bagong Takdang-Aralin',
      message: 'May bagong takdang-aralin sa klase.',
      related_resource_type: 'assignment',
      related_resource_id: 'assign-1',
      read_at: null,
      created_at: stamp,
    },
  ],
  limit: 20,
  offset: 0,
  has_more: false,
  unread_count: 1,
  as_of: stamp,
};

test('validateMaterialPage validates compliant materials response', () => {
  const result = validateMaterialPage(mockMaterialPage);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, 'Kuwentong Bayan Reading Guide');
  assert.equal(result.items[0].is_required, true);
});

test('validateMaterialPage rejects malformed materials', () => {
  assert.throws(() => validateMaterialPage({ ...mockMaterialPage, as_of: 'not-a-date' }));
  assert.throws(() =>
    validateMaterialPage({
      ...mockMaterialPage,
      items: [{ ...mockMaterialPage.items[0], is_required: 'yes' }],
    })
  );
});

test('validateNotificationPage validates compliant notification response', () => {
  const result = validateNotificationPage(mockNotificationPage);
  assert.equal(result.items.length, 1);
  assert.equal(result.unread_count, 1);
  assert.equal(result.items[0].event_type, 'assignment_published');
});

test('validateNotificationPage rejects invalid notification structures', () => {
  assert.throws(() => validateNotificationPage({ ...mockNotificationPage, unread_count: 'none' }));
  assert.throws(() =>
    validateNotificationPage({
      ...mockNotificationPage,
      items: [{ ...mockNotificationPage.items[0], created_at: 'invalid-date' }],
    })
  );
});

test('notifications and learning-materials routes are accessible to authorized profiles', () => {
  assert(routeAllowed({ role: 'school_student', profile_status: 'active' }, 'notifications'));
  assert(routeAllowed({ role: 'instructor', profile_status: 'active' }, 'notifications'));
  assert(routeAllowed({ role: 'personal_student', profile_status: 'active', grade: 7, language: 'tagalog' }, 'notifications'));

  assert(routeAllowed({ role: 'school_student', profile_status: 'active' }, 'learning-materials'));
  assert(routeAllowed({ role: 'instructor', profile_status: 'active' }, 'learning-materials'));
  assert(routeAllowed({ role: 'personal_student', profile_status: 'active', grade: 7, language: 'tagalog' }, 'learning-materials'));

  assert(!routeAllowed(null, 'notifications'));
  assert(!routeAllowed(null, 'learning-materials'));
});

test('materialsApi and notificationsApi perform authenticated requests', async () => {
  const prevUrl = process.env.EXPO_PUBLIC_API_URL;
  const originalFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000';
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/materials')) return Response.json(mockMaterialPage);
    return Response.json(mockNotificationPage);
  };

  try {
    const matAccess = materialsAccess(async (op) => op('token-xyz'));
    const matData = await matAccess.getLessonMaterials('lesson-1');
    assert.equal(matData.total_count, 1);
    assert(calls[0].url.includes('/lessons/lesson-1/materials'));
    assert.equal(calls[0].options.headers.Authorization, 'Bearer token-xyz');

    const notifAccess = notificationsAccess(async (op) => op('token-xyz'));
    const notifData = await notifAccess.list();
    assert.equal(notifData.unread_count, 1);
    assert(calls[1].url.includes('/me/notifications'));
  } finally {
    globalThis.fetch = originalFetch;
    if (prevUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = prevUrl;
  }
});
