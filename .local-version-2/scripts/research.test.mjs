import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStudiesResponse,
  validateConsentDocument,
  validateEnrollmentReceipt,
  validateWithdrawalReceipt,
  researchAccess,
} from '../apps/mobile/src/services/api/research.ts';

const mockStudiesResponse = {
  studies: [
    {
      id: 'study-tag-01',
      code: 'FLUENTT-EXP-TAG-2026',
      title: 'FLUENTT Adaptive Learning & Spaced Repetition Evaluation (Tagalog)',
      status: 'active',
      target_language: 'tagalog',
      protocol_version: 'thesis-protocol-tag-v1.0',
      target_participants: 30,
      enrolled_count: 5,
      withdrawn_count: 0,
      starts_at: null,
      ends_at: null,
      conditions: {},
      locked_at: null,
    },
    {
      id: 'study-eng-01',
      code: 'FLUENTT-EXP-ENG-2026',
      title: 'FLUENTT Adaptive Learning & Pronunciation Evaluation (English)',
      status: 'active',
      target_language: 'english',
      protocol_version: 'thesis-protocol-eng-v1.0',
      target_participants: 30,
      enrolled_count: 3,
      withdrawn_count: 1,
      conditions: {},
      locked_at: null,
    },
  ],
  count: 2,
  ethics_disclaimer:
    'NOTICE: Software consent recording captures technical participant affirmation under the specified protocol version and does NOT constitute independent Institutional Review Board (IRB) approval.',
};

const mockConsentDoc = {
  study_id: 'study-tag-01',
  study_code: 'FLUENTT-EXP-TAG-2026',
  study_title: 'FLUENTT Adaptive Learning & Spaced Repetition Evaluation (Tagalog)',
  target_language: 'tagalog',
  protocol_version: 'thesis-protocol-tag-v1.0',
  consent_document_version: 'consent-tag-v1.0',
  purpose: 'Evaluate learning gains using adaptive spaced repetition.',
  procedures: 'Complete daily vocabulary and grammar review sessions.',
  voluntary_nature: 'Participation is completely voluntary.',
  confidentiality_and_pseudonymization: 'All experimental data is pseudonymized using a participant code.',
  data_retention_policy: 'Pre-withdrawal records are permanently retained in tamper-evident research audit storage.',
  withdrawal_rights: 'Participants may withdraw at any time through the research interface.',
  ethics_statement:
    'NOTICE: Software consent recording captures technical participant affirmation under the specified protocol version and does NOT constitute independent Institutional Review Board (IRB) approval.',
  required_affirmation: 'I have read and understood the study information and agree to participate.',
  retention_notice:
    'In accordance with research integrity standards, pre-withdrawal audit and interaction logs are permanently preserved.',
};

const mockReceipt = {
  participant_id: 'part-001',
  participant_code: 'P-TAG-A4F82C',
  study_id: 'study-tag-01',
  study_code: 'FLUENTT-EXP-TAG-2026',
  protocol_version: 'thesis-protocol-tag-v1.0',
  enrollment_status: 'enrolled',
  enrolled_at: new Date().toISOString(),
  ethics_disclaimer: 'Ethics notice...',
  retention_notice: 'Retention notice...',
};

const mockWithdrawal = {
  participant_id: 'part-001',
  study_code: 'FLUENTT-EXP-TAG-2026',
  enrollment_status: 'withdrawn',
  withdrawn_at: new Date().toISOString(),
  retention_notice: 'Retention notice...',
};

test('validateStudiesResponse accepts well-formed response', () => {
  const result = validateStudiesResponse(mockStudiesResponse);
  assert.equal(result.count, 2);
  assert.equal(result.studies.length, 2);
  assert.equal(result.studies[0].code, 'FLUENTT-EXP-TAG-2026');
  assert.equal(result.studies[1].target_language, 'english');
});

test('validateStudiesResponse rejects malformed response', () => {
  assert.throws(() => validateStudiesResponse(null), /Malformed available research studies response/);
  assert.throws(() => validateStudiesResponse({ studies: 'not-an-array' }), /Malformed available research studies response/);
  assert.throws(() => validateStudiesResponse({ studies: [], count: 'two' }), /Malformed available research studies response/);
});

test('validateConsentDocument accepts and validates consent details', () => {
  const result = validateConsentDocument(mockConsentDoc);
  assert.equal(result.study_code, 'FLUENTT-EXP-TAG-2026');
  assert.equal(result.protocol_version, 'thesis-protocol-tag-v1.0');
  assert(result.ethics_statement.includes('Software consent recording'));
  assert(result.retention_notice.toLowerCase().includes('preserved'));
});

test('validateConsentDocument rejects missing ethics or retention statement', () => {
  assert.throws(
    () => validateConsentDocument({ ...mockConsentDoc, ethics_statement: null }),
    /Malformed consent document response/
  );
  assert.throws(
    () => validateConsentDocument({ ...mockConsentDoc, retention_notice: undefined }),
    /Malformed consent document response/
  );
});

test('validateEnrollmentReceipt validates pseudonymous code and status', () => {
  const result = validateEnrollmentReceipt(mockReceipt);
  assert.equal(result.participant_code, 'P-TAG-A4F82C');
  assert.equal(result.enrollment_status, 'enrolled');
  // Confirm pseudonym format does not contain user email or full student name
  assert(!result.participant_code.includes('@'));
  assert(!result.participant_code.includes('student'));
});

test('validateWithdrawalReceipt confirms withdrawn status and retention notice', () => {
  const result = validateWithdrawalReceipt(mockWithdrawal);
  assert.equal(result.enrollment_status, 'withdrawn');
  assert(result.retention_notice.length > 0);
});

test('researchAccess wraps runner and invokes operations with authentication', async () => {
  const runner = async (operation) => {
    return operation('test-token-xyz');
  };

  const client = researchAccess(runner);
  assert.equal(typeof client.studies, 'function');
  assert.equal(typeof client.study, 'function');
  assert.equal(typeof client.eligibility, 'function');
  assert.equal(typeof client.consentDocument, 'function');
  assert.equal(typeof client.enroll, 'function');
  assert.equal(typeof client.myStatus, 'function');
  assert.equal(typeof client.withdraw, 'function');
  // Section 37 experiment endpoints
  assert.equal(typeof client.experimentStatus, 'function');
  assert.equal(typeof client.allocate, 'function');
  assert.equal(typeof client.assessments, 'function');
  assert.equal(typeof client.assessmentDetail, 'function');
  assert.equal(typeof client.startAssessment, 'function');
  assert.equal(typeof client.submitAssessment, 'function');
});

test('blinded experiment status preserves participant blinding invariant', () => {
  const mockBlindedStatus = {
    study_id: 'study-tag-01',
    study_code: 'FLUENTT-EXP-TAG-2026',
    study_title: 'FLUENTT Adaptive Learning Study',
    target_language: 'tagalog',
    protocol_version: 'thesis-protocol-tag-v1.0',
    participant_id: 'part-001',
    participant_code: 'P-TAG-A4F82C',
    is_enrolled: true,
    is_allocated: true,
    is_withdrawn: false,
    condition_blinded: 'standard_research_track',
    current_level_number: 1,
    next_activity: 'Pre-Intervention Baseline Assessment',
    pre_test_completed: false,
    levels_completed: [],
    post_test_completed: false,
    delayed_retention_completed: false,
    pronunciation_completed: false,
    ethics_disclaimer: 'Ethics notice...',
  };

  assert.equal(mockBlindedStatus.condition_blinded, 'standard_research_track');
  // Blinded status must never reveal sm2_control or esr_experimental
  assert(!JSON.stringify(mockBlindedStatus).includes('sm2_control'));
  assert(!JSON.stringify(mockBlindedStatus).includes('esr_experimental'));
  assert.equal(mockBlindedStatus.current_level_number, 1);
  assert.equal(mockBlindedStatus.next_activity, 'Pre-Intervention Baseline Assessment');
});

test('assessment items strip expected answers from student presentation', () => {
  const studentAssessment = {
    assessment_id: 'asm-pre-01',
    study_id: 'study-tag-01',
    kind: 'pre_test',
    instrument_version: 'tagalog-pretest-v1',
    title: 'Pre-Test',
    instructions: 'Complete all questions.',
    total_points: 10,
    attempt_status: 'not_started',
    items: [
      {
        item_id: 'item-1',
        prompt: 'What is "book"?',
        item_type: 'multiple_choice',
        options: ['aklat', 'mesa', 'pluma'],
        points: 2,
      },
    ],
  };

  // Ensure no expected_answer or scoring key leaked to client
  assert(!('expected_answer' in studentAssessment.items[0]));
  assert(!('accepted_answers' in studentAssessment.items[0]));
  assert(!('rubric' in studentAssessment.items[0]));
});
