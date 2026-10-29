// Synthetic method contracts/state only: no credentials, scoring or runtime sample records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { definitionFromDraft, newDraft, validateDraft, publicDefinition, moveOption, isRevision, saveNeedsReconciliation } from '../apps/admin/src/services/questions-contract.ts';
import { choiceItemFromRevision, selectedChoice, selectChoice } from '../apps/mobile/src/features/questions/choice.ts';

const id = '00000000-0000-0000-0000-000000000001';
function draft(method = 'multiple_choice') {
  return { ...newDraft(method), lesson_id: id, language: 'tagalog', prompt: 'Synthetic test prompt',
    options: [{ id: 'a', text: 'Synthetic A' }, { id: 'b', text: 'Synthetic B' }], correct: 'b', boolean: 'false',
    explanation: 'PRIVATE-KEY-EXPLANATION' };
}
function revision(method = 'multiple_choice') {
  return { id, question_id: id, version: 1, status: 'draft', locked_at: null, revision: 'a'.repeat(64), competency_ids: [],
    definition: publicDefinition(definitionFromDraft(draft(method))) };
}
test('MC authoring requires one correct stable ID and preserves explicit presentation order', () => {
  const original = draft(); const moved = moveOption(original, 1, -1);
  const definition = definitionFromDraft(moved);
  assert.deepEqual(definition.content.options.map(row => row.id), ['b', 'a']);
  assert.equal(definition.answer_key.correct_option_id, 'b');
  assert.deepEqual(original.options.map(row => row.id), ['a', 'b']);
  assert.equal(moveOption(original, 0, -1), original);
  assert(validateDraft({ ...original, correct: '' }).correct);
  assert(validateDraft({ ...original, correct: 'unknown' }).correct);
  assert(validateDraft({ ...original, options: [original.options[0], original.options[0]] }).options);
  assert(validateDraft({ ...original, options: [original.options[0]] }).options);
  assert(validateDraft({ ...original, options: [{ id: 'a', text: ' ' }, original.options[1]] }).option_0);
});
test('TF authoring preserves strict false, has no free-form options and requires a defined boolean', () => {
  const definition = definitionFromDraft(draft('true_false'));
  assert.deepEqual(definition.content, {}); assert.deepEqual(definition.answer_key, { value: false });
  for (const boolean of ['', '0', 'False']) assert(validateDraft({ ...draft('true_false'), boolean }).boolean);
});
test('authoring validates relationships, prompt, metadata and same-lesson competency ID syntax', () => {
  for (const [change, field] of [[{ lesson_id: 'invalid' }, 'lesson_id'], [{ prompt: ' ' }, 'prompt'],
    [{ language: 'filipino' }, 'language'], [{ points: '1.001' }, 'points'], [{ points: '-1' }, 'points'],
    [{ competencies: `${id},${id}` }, 'competencies'], [{ competencies: 'invalid' }, 'competencies']]) {
    assert(validateDraft({ ...draft(), ...change })[field]);
    assert.throws(() => definitionFromDraft({ ...draft(), ...change }));
  }
});
test('preview DTO and mobile projection omit keys/explanations even with editor input', () => {
  for (const method of ['multiple_choice', 'true_false']) {
    const d = definitionFromDraft(draft(method));
    const safe = publicDefinition(d);
    assert(!JSON.stringify(safe).includes('PRIVATE-KEY')); assert(!('answer_key' in safe));
    const item = choiceItemFromRevision({ id, definition: d, correct: true, feedback: 'SECRET' });
    assert(item); assert(!JSON.stringify(item).includes('answer_key')); assert(!JSON.stringify(item).includes('SECRET'));
    assert(!('points' in item)); assert(isRevision(revision(method)));
  }
});
test('single-choice selection replaces instead of toggling; repeated taps and unknown IDs are inert', () => {
  const item = choiceItemFromRevision(revision());
  const first = selectChoice(item, null, 'a');
  assert.deepEqual(first, { method: 'multiple_choice', answer: { option_id: 'a' } });
  assert.equal(selectChoice(item, first, 'a'), first);
  assert.equal(selectChoice(item, first, 'missing'), first);
  const second = selectChoice(item, first, 'b'); assert.equal(selectedChoice(item, second), 'b');
  assert.equal(selectedChoice(item, null), null); // Explicit reset has no hidden persisted value.
  assert.equal(selectedChoice(item, { method: 'true_false', answer: { value: true } }), null);
});
test('boolean selection treats false as selected and rejects string-shaped malformed responses', () => {
  const item = choiceItemFromRevision(revision('true_false'));
  const answer = selectChoice(item, null, false);
  assert.deepEqual(answer, { method: 'true_false', answer: { value: false } });
  assert.equal(selectedChoice(item, answer), false); assert.equal(selectChoice(item, answer, false), answer);
  assert.equal(selectChoice(item, answer, 'false'), answer);
  assert.equal(selectedChoice(item, { method: 'true_false', answer: { value: 'false' } }), null);
});
test('malformed or unsupported public items never become renderable questions', () => {
  const row = revision();
  for (const definition of [{ ...row.definition, prompt: ' ' }, { ...row.definition, method: 'identification' },
    { ...row.definition, content: { options: [{ id: 'a', text: 'A' }, { id: 'a', text: 'Duplicate' }] } },
    { ...row.definition, content: { options: [{ id: 'a', text: 'A' }] } }])
    assert.equal(choiceItemFromRevision({ id, definition }), null);
  assert.equal(choiceItemFromRevision({ id, definition: { ...revision('true_false').definition, content: { options: [] } } }), null);
});
test('interrupted creation requires reconciliation even when a gateway returns a structured server error', () => {
  for (const status of [undefined, 408, 500, 502, 503, 504]) assert.equal(saveNeedsReconciliation(status), true);
  for (const status of [401, 403, 409, 422, 428, 429]) assert.equal(saveNeedsReconciliation(status), false);
});
