// Synthetic Section 14 contracts only. No grading or real educational content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft, validateDraft, definitionFromDraft, draftFromDefinition, publicDefinition, isRevision, moveOption, toggleTarget, removeOption } from '../apps/admin/src/services/questions-contract.ts';
import { multiItemFromRevision, selectedIds, toggleSelection } from '../apps/mobile/src/features/questions/multi.ts';
const id = '00000000-0000-0000-0000-000000000001';
function draft(method = 'multiple_select') {
  return { ...newDraft(method), lesson_id: id, language: 'tagalog', prompt: 'Synthetic select fixture',
    options: [{ id: 'a', text: 'Fixture ñ e\u0301 😀' }, { id: 'b', text: 'Synthetic B' }, { id: 'c', text: 'Synthetic C' }], targets: ['b', 'a'],
    corrections: '{"a":["PRIVATE-CORRECTION"],"c":[]}', explanation: 'PRIVATE-EXPLANATION' };
}
const row = definition => ({ id, question_id: id, version: 1, status: 'draft', locked_at: null, revision: 'a'.repeat(64), competency_ids: [], definition });
test('both authoring methods roundtrip existing payloads and canonicalize target sets in content order', () => {
  for (const method of ['multiple_select', 'error_identification']) {
    const d = definitionFromDraft(draft(method));
    assert.deepEqual(definitionFromDraft(draftFromDefinition(d)), d);
    assert.deepEqual(method === 'multiple_select' ? d.answer_key.correct_option_ids : d.answer_key.error_token_ids, ['a', 'b']);
    const moved = definitionFromDraft(moveOption(draft(method), 1, -1));
    assert.deepEqual(method === 'multiple_select' ? moved.answer_key.correct_option_ids : moved.answer_key.error_token_ids, ['b', 'a']);
    assert(isRevision(row(publicDefinition(d))));
  }
  const single = definitionFromDraft({ ...draft(), targets: ['a'] }); assert.deepEqual(single.answer_key.correct_option_ids, ['a']);
  const oneToken = definitionFromDraft({ ...draft('error_identification'), options: [draft().options[0]], targets: ['a'], corrections: '{}' });
  assert.equal(oneToken.content.tokens.length, 1);
});
test('author validation rejects missing/duplicate/unknown targets, invalid text and unsupported correction references', () => {
  for (const method of ['multiple_select', 'error_identification']) {
    for (const targets of [[], ['a', 'a'], ['missing']]) assert(validateDraft({ ...draft(method), targets }).correct);
    for (const options of [[], [{ id: 'a', text: ' ' }], [draft().options[0], draft().options[0]], [{ id: 'a\n', text: 'bad ID' }]])
      assert(Object.keys(validateDraft({ ...draft(method), options })).length);
  }
  for (const corrections of ['{', '[]', '{"unknown":["text"]}', '{"a":"string"}', '{"a":[""]}', '{"a":[2]}'])
    assert(validateDraft({ ...draft('error_identification'), corrections }).corrections);
  assert(!validateDraft(draft('error_identification')).corrections); // Existing non-target c/empty metadata is legal.
});
test('stable ID edits/removal preserve associations and clear removed references', () => {
  const d = draft('error_identification');
  const next = removeOption(d, 'a');
  assert.deepEqual(next.targets, ['b']); assert.deepEqual(JSON.parse(next.corrections), { c: [] });
  assert.deepEqual(d.targets, ['b', 'a']);
  assert.deepEqual(toggleTarget(d, 'c').targets, ['a', 'b', 'c']);
  assert.deepEqual(toggleTarget(d, 'a').targets, ['b']); assert.equal(toggleTarget(d, 'missing'), d);
  assert.equal(removeOption({ ...d, options: [d.options[0]] }, 'a').options.length, 1);
});
test('safe projections omit private targets/corrections/explanations and preserve long Unicode segments', () => {
  for (const method of ['multiple_select', 'error_identification']) {
    const d = definitionFromDraft(draft(method));
    const item = multiItemFromRevision(row(d));
    for (const safe of [publicDefinition(d), item]) {
      assert(safe); const json = JSON.stringify(safe);
      for (const privateField of ['PRIVATE-', 'correct_option_ids', 'error_token_ids', 'accepted_corrections', 'answer_key']) assert(!json.includes(privateField));
    }
  }
  const d = definitionFromDraft({ ...draft('error_identification'), options: [{ id: 'same', text: 'ñ😀e\u0301'.repeat(1000) }], targets: ['same'], corrections: '{}' });
  assert.equal(multiItemFromRevision(row(d)).content.tokens[0].text, d.content.tokens[0].text);
});
test('multi-select toggles deterministically, permits unfinished empty sets and rejects unknown/cross-method IDs', () => {
  for (const method of ['multiple_select', 'error_identification']) {
    const item = multiItemFromRevision(row(definitionFromDraft(draft(method))));
    let value = toggleSelection(item, null, 'c'); value = toggleSelection(item, value, 'a');
    assert.deepEqual(selectedIds(item, value), ['a', 'c']);
    value = toggleSelection(item, value, 'c'); assert.deepEqual(selectedIds(item, value), ['a']);
    value = toggleSelection(item, value, 'a'); assert.deepEqual(selectedIds(item, value), []);
    assert.equal(toggleSelection(item, value, 'unknown'), value);
    const malformed = { method, answer: method === 'multiple_select' ? { option_ids: ['a', 'a'] } : { selected_token_ids: ['unknown'] } };
    assert.deepEqual(selectedIds(item, malformed), []);
    assert.deepEqual(selectedIds(item, { method: 'true_false', answer: { value: false } }), []);
  }
});
test('malformed content and offset/span alternatives cannot become selectable segments', () => {
  const d = definitionFromDraft(draft('error_identification'));
  for (const tokens of [[], [{ id: 'a', text: 'A', start: 0, end: 1 }], [{ id: 'a', text: 'A', span: [0, 1] }], [{ id: 'a', text: '' }], [{ id: 'a', text: 'A' }, { id: 'a', text: 'Duplicate' }]])
    assert.equal(multiItemFromRevision(row({ ...d, content: { tokens } })), null);
  assert.equal(multiItemFromRevision(row({ ...d, content: { spans: [{ start: 0, end: 2 }, { start: 1, end: 3 }] } })), null);
});
