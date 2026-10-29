import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTopics,
  conversationApi,
  conversationAccess,
} from '../apps/mobile/src/services/api/conversation.ts';

const mockTopics = {
  topics: [
    {
      id: 'topic-1',
      lesson_id: null,
      title: 'Pagpapakilala sa Sarili (Introducing Oneself)',
      language: 'tagalog',
      scenario_description: 'Kumustahan at pagpapakilala sa bagong kaklase sa paaralan.',
      persona: 'Juan (Bagong Kaklase)',
      target_level: 'Grade 7 (Panimula)',
      goal: "Ipakilala ang sarili gamit ang magagalang na pananalita tulad ng 'po' at 'opo'.",
      vocabulary_hints: ['pangalan', 'taga-saan', 'edad', 'salamat po'],
      starter_prompt: 'Magandang araw! Ako si Juan. Kumusta ka?',
      status: 'published',
      version: 1,
    },
    {
      id: 'topic-2',
      lesson_id: null,
      title: 'Ordering at a Local Cafe (Everyday English)',
      language: 'english',
      scenario_description: 'Placing a beverage order and asking questions at a coffee shop.',
      persona: 'Chris (Friendly Barista)',
      target_level: 'Grade 9 (Conversational)',
      goal: 'Order beverages and snacks, ask for dietary options, and complete transactions politely.',
      vocabulary_hints: ['iced coffee', 'pastry', 'takeout', 'thank you'],
      starter_prompt: 'Good morning! Welcome to Fluentt Cafe. What can I get started for you today?',
      status: 'published',
      version: 1,
    },
  ],
  total: 2,
};

test('validateTopics accepts well-formed response', () => {
  const result = validateTopics(mockTopics);
  assert.equal(result.total, 2);
  assert.equal(result.topics.length, 2);
  assert.equal(result.topics[0].title, 'Pagpapakilala sa Sarili (Introducing Oneself)');
  assert.equal(result.topics[1].language, 'english');
});

test('validateTopics rejects malformed response', () => {
  assert.throws(
    () => validateTopics({ topics: null }),
    /Malformed conversation topics response/
  );
  assert.throws(
    () => validateTopics(null),
    /Malformed conversation topics response/
  );
});

test('conversationAccess wraps runner and executes full dialogue lifecycle', async () => {
  const prevUrl = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000';
  const calls = [];
  const fakeRunner = async op => {
    calls.push('invoked');
    return op('test-bearer-token');
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (url.includes('/me/conversation/topics/topic-1')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockTopics.topics[0],
      };
    }
    if (url.includes('/me/conversation/topics')) {
      const isEnglish = url.includes('language=english');
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          topics: isEnglish ? [mockTopics.topics[1]] : mockTopics.topics,
          total: isEnglish ? 1 : 2,
        }),
      };
    }
    if (url.includes('/me/conversation/sessions/session-101/messages') && opts.method === 'POST') {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          session_id: 'session-101',
          user_message: {
            id: 'msg-2',
            sequence: 2,
            role: 'user',
            content: 'Magandang araw po! Ako po si Maria.',
            sent_at: '2026-10-20T10:00:30Z',
            pronunciation_score: null,
            transcription: null,
          },
          assistant_message: {
            id: 'msg-3',
            sequence: 3,
            role: 'assistant',
            content: 'Ikinagagalak kitang makilala, Maria! Taga-saan ka naman?',
            sent_at: '2026-10-20T10:00:32Z',
            feedback: {
              summary: 'Maganda ang iyong sagot! Mahusay ang paggamit ng magagalang na pananalita.',
              corrections: [],
              suggestions: [],
              politeness_marker_detected: true,
              topic_relevance_score: 1.0,
              confidence: 0.94,
              uncertainty_notice: 'Formative feedback provides practice guidance based on educational heuristics.',
            },
          },
          turns_count: 3,
          max_turns: 15,
          is_session_complete: false,
          simulated: true,
        }),
      };
    }
    if (url.includes('/me/conversation/sessions/session-101/end') && opts.method === 'POST') {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          session_id: 'session-101',
          status: 'ended',
          turns_completed: 3,
          overall_feedback: 'Mahusay na pagtatapos ng pagsasanay sa pakikipag-usap!',
          strengths: ['Polite phrasing', 'Active engagement'],
          recommendations: ['Practice descriptive sentences'],
          ended_at: '2026-10-20T10:05:00Z',
        }),
      };
    }
    if (url.includes('/me/conversation/sessions') && opts.method === 'POST') {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          session_id: 'session-101',
          topic_id: 'topic-1',
          topic_title: 'Pagpapakilala sa Sarili (Introducing Oneself)',
          language: 'tagalog',
          persona: 'Juan (Bagong Kaklase)',
          started_at: '2026-10-20T10:00:00Z',
          ended_at: null,
          status: 'active',
          simulated: true,
          model_version: 'fluentt-dialogue-v1.0',
          turns_count: 1,
          max_turns: 15,
          messages: [
            {
              id: 'msg-1',
              sequence: 1,
              role: 'assistant',
              content: 'Magandang araw! Ako si Juan. Kumusta ka?',
              sent_at: '2026-10-20T10:00:00Z',
            },
          ],
        }),
      };
    }
    if (url.includes('/me/conversation/sessions/session-101')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          session_id: 'session-101',
          topic_id: 'topic-1',
          topic_title: 'Pagpapakilala sa Sarili (Introducing Oneself)',
          language: 'tagalog',
          persona: 'Juan (Bagong Kaklase)',
          started_at: '2026-10-20T10:00:00Z',
          ended_at: null,
          status: 'active',
          simulated: true,
          model_version: 'fluentt-dialogue-v1.0',
          turns_count: 1,
          max_turns: 15,
          messages: [],
        }),
      };
    }
    throw new Error(`Unexpected url ${url}`);
  };

  try {
    const access = conversationAccess(fakeRunner);

    // 1. List topics
    const all = await access.topics();
    assert.equal(all.total, 2);

    // 2. Filter topics by language
    const en = await access.topics('english');
    assert.equal(en.total, 1);
    assert.equal(en.topics[0].language, 'english');

    // 3. Single topic
    const single = await access.topic('topic-1');
    assert.equal(single.id, 'topic-1');
    assert.equal(single.persona, 'Juan (Bagong Kaklase)');

    // 4. Start session
    const session = await access.startSession('topic-1');
    assert.equal(session.session_id, 'session-101');
    assert.equal(session.status, 'active');
    assert.equal(session.messages.length, 1);

    // 5. Get session
    const fetchedSession = await access.getSession('session-101');
    assert.equal(fetchedSession.session_id, 'session-101');

    // 6. Send message
    const sendRes = await access.sendMessage('session-101', 'Magandang araw po! Ako po si Maria.');
    assert.equal(sendRes.user_message.content, 'Magandang araw po! Ako po si Maria.');
    assert.equal(sendRes.assistant_message.feedback.politeness_marker_detected, true);
    assert.equal(sendRes.turns_count, 3);

    // 7. End session
    const summary = await access.endSession('session-101');
    assert.equal(summary.status, 'ended');
    assert.equal(summary.turns_completed, 3);

    assert.equal(calls.length, 7);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = prevUrl;
  }
});
