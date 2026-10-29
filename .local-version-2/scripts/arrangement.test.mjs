// Synthetic unscored sequences. No grader, delivery API or runtime curriculum fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft, definitionFromDraft, draftFromDefinition, validateDraft, publicDefinition, isRevision, moveOption, removeOption, moveIds, validOrder } from '../apps/admin/src/services/questions-contract.ts';
import { arrangementItemFromRevision, appendUnit, moveUnit, removeUnit, validSequence, arrangementResponse } from '../apps/mobile/src/features/questions/arrangement.ts';
const id = '00000000-0000-0000-0000-000000000001';
const rows = [{ id: 'a', text: 'ñ😀 e\u0301!' }, { id: 'b', text: 'ñ😀 e\u0301!' }, { id: 'c', text: 'Synthetic sentence. Another clause?' }];
function draft(method = 'word_arrangement') { return { ...newDraft(method), lesson_id: id, language: 'tagalog', prompt: 'Synthetic arrangement fixture', options: rows, order: ['c', 'b', 'a'], explanation: 'PRIVATE-EXPLANATION' }; }
const revision = definition => ({ id, question_id: id, version: 1, status: 'draft', locked_at: null, revision: 'a'.repeat(64), competency_ids: [], definition });
test('arrangement editors restore repeated labels and keep presentation order independent of the private key', () => {
  for (const method of ['word_arrangement', 'sentence_arrangement']) {
    const d = definitionFromDraft(draft(method));
    assert.deepEqual(definitionFromDraft(draftFromDefinition(d)), d);
    assert.deepEqual(d.content.items.map(row => row.id), ['a', 'b', 'c']); assert.deepEqual(d.answer_key.ordered_ids, ['c', 'b', 'a']);
    assert.deepEqual(definitionFromDraft(moveOption(draft(method), 0, 1)).answer_key.ordered_ids, ['c', 'b', 'a']);
    assert.deepEqual(removeOption(draft(method), 'b').order, ['c', 'a']);
    assert.equal(definitionFromDraft(draft(method)).content.items[0].text, rows[0].text);
    assert(isRevision(revision(publicDefinition(d))));
  }
});
test('authoring rejects missing/unknown/duplicate keys and malformed units', () => {
  for (const method of ['word_arrangement', 'sentence_arrangement']) {
    for (const order of [[], ['a'], ['a', 'b', 'b'], ['a', 'b', 'unknown']]) assert(validateDraft({ ...draft(method), order }).order);
    for (const options of [[], [rows[0]], [rows[0], rows[0]], [{ id: 'a', text: ' ' }, rows[1]], [{ id: 'a\n', text: 'bad' }, rows[1]]])
      assert(Object.keys(validateDraft({ ...draft(method), options })).length);
  }
});
test('public projection preserves authored unit order and never includes expected sequence or explanation', () => {
  for (const method of ['word_arrangement', 'sentence_arrangement']) {
    const d = definitionFromDraft(draft(method));
    for (const safe of [publicDefinition(d), arrangementItemFromRevision(revision(d))]) {
      assert(safe); const json = JSON.stringify(safe);
      assert(!json.includes('ordered_ids') && !json.includes('answer_key') && !json.includes('PRIVATE'));
      assert.deepEqual(safe.content.items.map(row => row.id), ['a', 'b', 'c']);
    }
  }
});
test('tap-to-append ignores repeated/unknown taps; remove/move/reset preserve distinct repeated units', () => {
  const item = arrangementItemFromRevision(revision(definitionFromDraft(draft())));
  let ids = []; ids = appendUnit(item, ids, 'b'); assert.equal(appendUnit(item, ids, 'b'), ids); assert.equal(appendUnit(item, ids, 'unknown'), ids);
  ids = appendUnit(item, ids, 'a'); ids = appendUnit(item, ids, 'c'); assert.deepEqual(ids, ['b', 'a', 'c']);
  for (const move of [moveUnit, moveIds]) {
    assert.deepEqual(move(ids, 2, -1), ['b', 'c', 'a']); assert.equal(move(ids, 0, -1), ids); assert.equal(move(ids, 1.5, 1), ids);
  }
  assert.deepEqual(removeUnit(ids, 'a'), ['b', 'c']); assert.equal(removeUnit(ids, 'unknown'), ids);
  assert.deepEqual(appendUnit(item, [], 'a'), ['a']); assert.deepEqual(ids, ['b', 'a', 'c']);
});
test('ready means every ID exactly once, not an expected-order comparison; response arrays are copied', () => {
  for (const method of ['word_arrangement', 'sentence_arrangement']) {
    const item = arrangementItemFromRevision(revision(definitionFromDraft(draft(method))));
    for (const ids of [[], ['a'], ['a', 'a', 'b'], ['unknown', 'a', 'b']]) assert.equal(arrangementResponse(item, ids), null);
    assert.equal(validSequence(item, 'bad'), false); assert.equal(validOrder(rows, ['a'], true), false);
    for (const ids of [['a', 'b', 'c'], ['c', 'b', 'a']]) {
      const response = arrangementResponse(item, ids); assert(response);
      const actual = method === 'word_arrangement' ? response.answer.ordered_token_ids : response.answer.ordered_sentence_ids;
      assert.deepEqual(actual, ids); assert.notEqual(actual, ids); assert(!('correct' in response));
    }
  }
});
test('malformed item shapes are rejected while long Unicode sentence units remain intact', () => {
  const d = definitionFromDraft(draft('sentence_arrangement'));
  for (const items of [[], [rows[0]], [rows[0], rows[0]], [{ id: 'a', text: ' ' }, rows[1]], [{ id: 'a', text: 2 }, rows[1]]])
    assert.equal(arrangementItemFromRevision(revision({ ...d, content: { items } })), null);
  const raw = 'ñ😀 e\u0301 — punctuation! '.repeat(1000);
  assert.equal(arrangementItemFromRevision(revision({ ...d, content: { items: [{ id: 'a', text: raw }, rows[1]] } })).content.items[0].text, raw);
});
