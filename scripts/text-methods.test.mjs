// Synthetic text contracts and raw buffers; no scoring or runtime fixture records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft, validateDraft, definitionFromDraft, draftFromDefinition, publicDefinition, isRevision, templateIds as adminIds } from '../apps/admin/src/services/questions-contract.ts';
import { textItemFromRevision, textResponse, textErrors, textPrompt, templateIds as mobileIds, codepoints } from '../apps/mobile/src/features/questions/text.ts';
const id = '00000000-0000-0000-0000-000000000001';
function draft(method = 'identification') {
  return { ...newDraft(method), lesson_id: id, language: 'tagalog', prompt: method === 'identification' ? 'Synthetic prompt' : 'Synthetic {{gap_1}}.',
    acceptedAnswers: 'ñ\nfixture', blanks: [{ id: 'gap_1', answers: 'ñ\nfixture' }], explanation: 'PRIVATE-EXPLANATION' };
}
const row = definition => ({ id, question_id: id, version: 1, status: 'draft', locked_at: null, revision: 'a'.repeat(64), competency_ids: [], definition });
test('text authoring restores limits/metadata and omits absent legacy additions', () => {
  for (const method of ['identification', 'fill_in_the_blank']) {
    const d = definitionFromDraft(draft(method));
    assert.equal(d.content.input_max_length, 500);
    assert.deepEqual(definitionFromDraft(draftFromDefinition(d)), d);
    const old = { ...d, content: method === 'identification' ? {} : { blank_ids: ['gap_1'] } };
    const restored = draftFromDefinition(old);
    assert.equal(restored.inputLimit, ''); assert.equal(restored.templateSyntax, false);
    assert.deepEqual(definitionFromDraft(restored).content, old.content);
    assert(isRevision(row(publicDefinition(d))));
  }
  assert(validateDraft({ ...draft(), acceptedAnswers: '' }).acceptedAnswers);
  for (const inputLimit of ['0', '2001', '1.5', '-1', 'abc']) assert(validateDraft({ ...draft(), inputLimit }).inputLimit);
  assert(validateDraft({ ...draft(), inputLimit: '1', acceptedAnswers: 'long' }).acceptedAnswers);
});
test('template syntax is identical on both clients, exact and opt-in', () => {
  for (const parse of [adminIds, mobileIds]) {
    assert.deepEqual(parse('Synthetic {{b}} {{a}}'), ['b', 'a']);
    for (const prompt of ['{{{a}}}', '{a}', '{{ a }}', '{{a}', '{{a{{b}}}}', '{{a}} }']) assert.throws(() => parse(prompt));
  }
  const d = { ...draft('fill_in_the_blank'), prompt: '{{b}} then {{gap_1}}', blanks: [...draft('fill_in_the_blank').blanks, { id: 'b', answers: 'fixture' }] };
  assert.deepEqual(definitionFromDraft(d).content.blank_ids, ['b', 'gap_1']);
  for (const prompt of ['{{gap_1}} {{gap_1}}', '{{unknown}}', 'missing']) assert(validateDraft({ ...draft('fill_in_the_blank'), prompt }).prompt);
  const legacy = definitionFromDraft({ ...draft('fill_in_the_blank'), templateSyntax: false, prompt: 'Legacy {literal} {{unknown}}' });
  assert.equal(textPrompt(textItemFromRevision(row(legacy))), legacy.prompt);
});
test('safe projections discard private keys and limits are validated', () => {
  for (const method of ['identification', 'fill_in_the_blank']) {
    const d = definitionFromDraft(draft(method));
    const dirty = { ...d, content: { ...d.content, answer_key: 'PRIVATE-CONTENT' } };
    for (const safe of [publicDefinition(dirty), textItemFromRevision(row(dirty))]) {
      assert(safe); assert(!JSON.stringify(safe).includes('PRIVATE')); assert(!JSON.stringify(safe).includes('accepted_answers'));
    }
    for (const limit of [0, 2001, '500', true]) assert.equal(textItemFromRevision(row({ ...d, content: { ...d.content, input_max_length: limit } })), null);
  }
  const d = definitionFromDraft(draft('fill_in_the_blank'));
  for (const content of [{ ...d.content, blank_ids: ['gap_1', 'gap_1'] }, { ...d.content, template_syntax: 'invented' }, { ...d.content, blank_ids: ['missing'] }])
    assert.equal(textItemFromRevision(row({ ...d, content })), null);
});
test('complete responses preserve whitespace, Unicode, punctuation, case and item order', () => {
  const raw = '  Pag-ibig! e\u0301 ñ 😀\n';
  const item = textItemFromRevision(row(definitionFromDraft(draft())));
  assert.deepEqual(textResponse(item, { text: raw }), { method: 'identification', answer: { text: raw } });
  assert.equal(codepoints('😀e\u0301'), 3);
  assert(textResponse({ ...item, content: { input_max_length: 2 } }, { text: '😀ñ' }));
  assert.equal(textResponse({ ...item, content: { input_max_length: 1 } }, { text: 'e\u0301' }), null);
  assert.equal(textResponse(item, { text: ' ' }), null); assert.equal(textResponse(item, {}), null);
  assert.equal(textResponse(item, { text: 'x', unknown: 'injected' }), null);
  const blanks = textItemFromRevision(row(definitionFromDraft({ ...draft('fill_in_the_blank'), prompt: '{{b}} {{gap_1}}', blanks: [{ id: 'gap_1', answers: 'a' }, { id: 'b', answers: 'b' }] })));
  assert.deepEqual(textResponse(blanks, { gap_1: raw, b: 'B' }).answer.blanks, [{ blank_id: 'b', text: 'B' }, { blank_id: 'gap_1', text: raw }]);
  assert.equal(textResponse(blanks, { b: 'B' }), null);
  assert.equal(textPrompt(blanks), '[Gap 1] [Gap 2]');
  const long = { text: 'x'.repeat(501) }; assert(textErrors(item, long).text); assert.equal(long.text.length, 501);
  assert(textResponse({ ...item, content: {} }, { text: 'x'.repeat(2001) }));
});
test('valid identifier names cannot collide with object prototypes', () => {
  const item = { id, method: 'fill_in_the_blank', prompt: 'Legacy fixture', instructions: null, content: { blank_ids: ['__proto__', 'constructor'] } };
  assert.equal(textResponse(item, {}), null);
  assert.deepEqual(textResponse(item, JSON.parse('{"__proto__":"raw","constructor":"answer"}')).answer.blanks,
    [{ blank_id: '__proto__', text: 'raw' }, { blank_id: 'constructor', text: 'answer' }]);
});
