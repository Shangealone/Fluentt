import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentApi } from '../apps/mobile/src/services/api/assignments.ts';

test('administrator catalog requests retain the class, search, page and source', async () => {
  const prior = globalThis.fetch, origin = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8001';
  let seen;
  globalThis.fetch = async url => { seen = new URL(url); return Response.json({items:[],has_more:false,offset:20,limit:20}); };
  try {
    await assignmentApi.lessons('synthetic-secret', 'class-a', 'greeting', 20, 'curriculum');
    assert.equal(seen.pathname, '/api/v1/classes/class-a/assignment-lessons');
    assert.equal(seen.searchParams.get('source'), 'curriculum');
    assert.equal(seen.searchParams.get('offset'), '20');
    assert.equal(seen.searchParams.get('q'), 'greeting');
  } finally {
    globalThis.fetch = prior;
    if (origin === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = origin;
  }
});
