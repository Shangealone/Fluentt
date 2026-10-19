// Synthetic fixtures; no persisted content or grader.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft, validateDraft, definitionFromDraft, draftFromDefinition, publicDefinition, isRevision, assignPair, editMatchSide } from '../apps/admin/src/services/questions-contract.ts';
import { matchingItemFromRevision, validMatches, assignMatch, matchingResponse } from '../apps/mobile/src/features/questions/matching.ts';
const id = '00000000-0000-0000-0000-000000000001';
const rows = [{ id: 'a', text: 'Repeated ñ😀 e\u0301!' }, { id: 'b', text: 'Repeated ñ😀 e\u0301!' }];
const pairs = [{ left_id: 'a', right_id: 'b' }, { left_id: 'b', right_id: 'a' }];
const draft = () => ({ ...newDraft('matching_type'), lesson_id: id, language: 'tagalog', prompt: 'Synthetic fixture', left: rows, right: rows, pairs, explanation: 'PRIVATE' });
const revision = definition => ({ id, question_id: id, version: 1, status: 'draft', locked_at: null, revision: 'a'.repeat(64), competency_ids: [], definition });
const item = () => matchingItemFromRevision(revision(definitionFromDraft(draft())));
test('matching author round trip retains separate side namespaces, repeated labels and private bijection', () => {
  const d = definitionFromDraft(draft()); assert.deepEqual(definitionFromDraft(draftFromDefinition(d)), d);
  assert.deepEqual(d.answer_key.pairs, pairs); assert(isRevision(revision(publicDefinition(d))));
  const changed = editMatchSide(draft(), 'right', [...rows].reverse()); assert.deepEqual(changed.pairs, pairs);
  assert.deepEqual(definitionFromDraft(changed).content.right, [...rows].reverse());
  assert.deepEqual(editMatchSide(draft(), 'left', [rows[1]]).pairs, [pairs[1]]);
  assert.deepEqual(editMatchSide(draft(), 'right', [rows[1]]).pairs, [pairs[0]]);
});
test('author validation rejects incomplete, duplicate, unknown or reused mappings and malformed side IDs/labels', () => {
  for (const bad of [[], pairs.slice(0,1), [pairs[0], pairs[0]], [pairs[0], { left_id: 'b', right_id: 'b' }], [{left_id:'a',right_id:'unknown'},pairs[1]]])
    assert(validateDraft({ ...draft(), pairs: bad }).pairs);
  for (const side of ['left','right']) for (const bad of [[], rows.slice(0,1), [rows[0],rows[0]], [{id:'a\n',text:'x'},rows[1]], [{id:'a',text:' '},rows[1]]])
    assert(Object.keys(validateDraft({ ...draft(), [side]: bad })).length);
  assert(validateDraft({ ...draft(), right: [...rows,{id:'c',text:'Extra'}] }).pairs);
});
test('safe projections drop every private field and reject malformed content', () => {
  const d = definitionFromDraft(draft());
  for (const safe of [publicDefinition(d), matchingItemFromRevision(revision(d))]) {
    assert(safe); assert(!/answer_key|pairs|PRIVATE|grading_version/.test(JSON.stringify(safe))); assert.deepEqual(safe.content.left, rows);
  }
  for (const side of ['left','right']) for (const bad of [null, [], rows.slice(0,1), [rows[0],rows[0]], [{id:'bad id',text:'x'},rows[1]], [{id:'a',text:5},rows[1]]])
    assert.equal(matchingItemFromRevision(revision({ ...d, content:{ ...d.content,[side]:bad }})),null);
  const long = 'ñ😀 e\u0301 — punctuation! '.repeat(500);
  assert.equal(matchingItemFromRevision(revision({...d,content:{...d.content,left:[{id:'a',text:long},rows[1]]}})).content.left[0].text,long);
});
test('assignment is deterministic, repeat-safe, revisable and evicts an already-owned target', () => {
  const model = item(); let state = [];
  state = assignMatch(model,state,'b','a'); state = assignMatch(model,state,'a','b'); assert.deepEqual(state,pairs);
  assert.equal(assignMatch(model,state,'a','b'),state); assert.equal(assignMatch(model,state,'unknown','a'),state);
  state = assignMatch(model,state,'a','a'); assert.deepEqual(state,[{left_id:'a',right_id:'a'}]);
  assert.deepEqual(assignPair(rows,rows,pairs,'a','a'),state);
  assert.deepEqual(assignMatch(model,state,'b','b'),[{left_id:'a',right_id:'a'},{left_id:'b',right_id:'b'}]);
  assert.deepEqual(assignMatch(model,[],'b','b'),[{left_id:'b',right_id:'b'}]);
});
test('partial drafts are valid but only complete bijections are ready, without comparison to a key', () => {
  const model = item(); assert(validMatches(model,[])); assert.equal(matchingResponse(model,[]),null);
  assert.equal(matchingResponse(model,pairs.slice(0,1)),null);
  for (const bad of [null,[null],[{left_id:'a',right_id:'unknown'}],[pairs[0],pairs[0]],[pairs[0],{left_id:'b',right_id:'b'}]]) assert(!validMatches(model,bad));
  for (const complete of [pairs,[{left_id:'a',right_id:'a'},{left_id:'b',right_id:'b'}]]) {
    const response = matchingResponse(model,[...complete].reverse()); assert.deepEqual(response.answer.pairs,complete);
    assert.notEqual(response.answer.pairs[0],complete[0]); assert(!('correct' in response));
  }
});
