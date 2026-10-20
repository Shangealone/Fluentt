import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateActivities,
  pronunciationApi,
  pronunciationAccess,
} from '../apps/mobile/src/services/api/pronunciation.ts';

const mockActivities = {
  activities: [
    {
      id: 'act-1',
      lesson_id: 'lesson-1',
      target_text: 'Magandang umaga sa inyong lahat.',
      language: 'tagalog',
      instructions: 'Bigkasin nang malinaw.',
      reference_audio_metadata: { syllables: 10 },
      version: 1,
    },
    {
      id: 'act-2',
      lesson_id: null,
      target_text: 'Good morning, welcome to our class.',
      language: 'english',
      instructions: 'Natural intonation.',
      reference_audio_metadata: { syllables: 8 },
      version: 1,
    },
  ],
  total: 2,
};

test('validateActivities accepts well-formed response', () => {
  const result = validateActivities(mockActivities);
  assert.equal(result.total, 2);
  assert.equal(result.activities.length, 2);
  assert.equal(result.activities[0].target_text, 'Magandang umaga sa inyong lahat.');
  assert.equal(result.activities[1].language, 'english');
});

test('validateActivities rejects missing fields', () => {
  assert.throws(
    () => validateActivities({ activities: null, total: 0 }),
    /Malformed pronunciation activities response/
  );
  assert.throws(
    () =>
      validateActivities({
        activities: [{ id: 'act-1' }],
        total: 1,
      }),
    /Malformed pronunciation activity item/
  );
});

test('pronunciationAccess wraps runner correctly', async () => {
  const prevUrl = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000';
  const calls = [];
  const fakeRunner = async op => {
    calls.push('invoked');
    return op('test-secret');
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (url.includes('/me/pronunciation/activities/act-1')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockActivities.activities[0],
      };
    }
    if (url.includes('/me/pronunciation/activities')) {
      const isEnglish = url.includes('language=english');
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          activities: isEnglish ? [mockActivities.activities[1]] : mockActivities.activities,
          total: isEnglish ? 1 : 2,
        }),
      };
    }
    if (url.includes('/transcribe') && opts.method === 'POST') {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          attempt_id: 'attempt-101',
          activity_id: 'act-1',
          transcription: 'Magandang umaga sa inyong lahat.',
          raw_transcript: 'Magandang umaga sa inyong lahat.',
          normalized_transcript: 'magandang umaga sa inyong lahat',
          detected_language: 'tl',
          prompt_language: 'tl',
          confidence: 0.95,
          duration_ms: 2500,
          processing_time_ms: 45,
          model_id: 'whisper-multilingual-v1',
          model_version: 'openai/whisper-base',
          simulated: true,
          silence_detected: false,
          words: [],
          scoring_status: 'pending',
          message: 'Speech transcribed successfully.',
        }),
      };
    }
    if (url.includes('/transcription')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          attempt_id: 'attempt-101',
          status: 'completed',
          has_transcription: true,
          transcription: 'Magandang umaga sa inyong lahat.',
          detected_language: 'tl',
          prompt_language: 'tl',
          silence_detected: false,
          simulated: true,
        }),
      };
    }
    if (url.includes('/evaluate') && opts.method === 'POST') {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          attempt_id: 'attempt-101',
          activity_id: 'act-1',
          target_text: 'Magandang umaga sa inyong lahat.',
          transcription: 'Magandang umaga sa inyong lahat.',
          language: 'tl',
          overall_score: 95.5,
          accuracy_score: 96.0,
          fluency_score: 94.0,
          completeness_score: 100.0,
          prosody_score: 92.0,
          words: [],
          scoring_status: 'scored',
          summary_feedback: 'Mahusay ang pagbigkas.',
          actionable_tips: ['Panatilihin ang tamang diin.'],
          model_version: 'gop-multilingual-v1.0',
          evaluation_method: 'goodness_of_pronunciation_gop',
          simulated: true,
        }),
      };
    }
    if (url.includes('/assessment')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          attempt_id: 'attempt-101',
          scoring_status: 'scored',
          has_assessment: true,
          overall_score: 95.5,
          accuracy_score: 96.0,
          fluency_score: 94.0,
          completeness_score: 100.0,
          prosody_score: 92.0,
          summary_feedback: 'Mahusay ang pagbigkas.',
          simulated: true,
        }),
      };
    }
    if (url.includes('/me/pronunciation/attempts') && opts.method === 'POST') {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          attempt_id: 'attempt-101',
          activity_id: 'act-1',
          target_text: 'Magandang umaga sa inyong lahat.',
          language: 'tagalog',
          attempted_at: '2026-10-20T10:00:00Z',
          scoring_status: 'pending',
          file_size_bytes: 512,
          duration_ms: 2500,
          mime_type: 'audio/webm',
          simulated: false,
          message: 'Recording submitted successfully.',
          transcription: 'Magandang umaga sa inyong lahat.',
        }),
      };
    }
    if (url.includes('/me/pronunciation/attempts')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [
          {
            attempt_id: 'attempt-101',
            activity_id: 'act-1',
            target_text: 'Magandang umaga sa inyong lahat.',
            language: 'tagalog',
            attempted_at: '2026-10-20T10:00:00Z',
            scoring_status: 'pending',
            file_size_bytes: 512,
            duration_ms: 2500,
            transcription: 'Magandang umaga sa inyong lahat.',
          },
        ],
      };
    }
    throw new Error(`Unexpected url ${url}`);
  };

  try {
    const access = pronunciationAccess(fakeRunner);

    // List all
    const all = await access.activities();
    assert.equal(all.total, 2);

    // Filter language
    const en = await access.activities('english');
    assert.equal(en.total, 1);
    assert.equal(en.activities[0].language, 'english');

    // Single item
    const single = await access.activity('act-1');
    assert.equal(single.id, 'act-1');
    assert.equal(single.target_text, 'Magandang umaga sa inyong lahat.');

    // Submit attempt
    const submission = await access.submitAttempt(
      'act-1',
      { uri: 'file:///data/recording.webm', name: 'recording.webm', type: 'audio/webm' },
      2500
    );
    assert.equal(submission.attempt_id, 'attempt-101');
    assert.equal(submission.scoring_status, 'pending');
    assert.equal(submission.transcription, 'Magandang umaga sa inyong lahat.');

    // List attempts
    const history = await access.attempts('act-1');
    assert.equal(history.length, 1);
    assert.equal(history[0].scoring_status, 'pending');
    assert.equal(history[0].transcription, 'Magandang umaga sa inyong lahat.');

    // Transcribe attempt
    const transcribed = await access.transcribe('attempt-101');
    assert.equal(transcribed.raw_transcript, 'Magandang umaga sa inyong lahat.');
    assert.equal(transcribed.detected_language, 'tl');

    // Get transcription status
    const status = await access.getTranscription('attempt-101');
    assert.equal(status.has_transcription, true);
    assert.equal(status.transcription, 'Magandang umaga sa inyong lahat.');

    // Section 34: Evaluate pronunciation attempt
    const evaluated = await access.evaluate('attempt-101');
    assert.equal(evaluated.scoring_status, 'scored');
    assert.equal(evaluated.overall_score, 95.5);
    assert.equal(evaluated.evaluation_method, 'goodness_of_pronunciation_gop');

    // Section 34: Get assessment status
    const assessmentStatus = await access.getAssessment('attempt-101');
    assert.equal(assessmentStatus.has_assessment, true);
    assert.equal(assessmentStatus.overall_score, 95.5);

    assert.equal(calls.length, 9);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = prevUrl;
  }
});

