import test from 'node:test';
import assert from 'node:assert/strict';
import { updateSections, sectionIssue } from '../apps/mobile/src/features/teacher-lessons/sectionEditing.ts';

const sections = [{ heading: 'First', body: 'First text' }, { heading: 'Second', body: 'Second text' }];
test('reordering follows the selected section without mutating the draft', () => {
  const result = updateSections(sections, 0, 'down');
  assert.equal(result.active, 1);
  assert.deepEqual(result.sections.map(s => s.heading), ['Second', 'First']);
  assert.equal(sections[0].heading, 'First');
});
test('duplicate keeps text and selects the independent copy', () => {
  const result = updateSections(sections, 0, 'duplicate');
  assert.equal(result.active, 1);
  assert.deepEqual(result.sections[1], sections[0]);
  assert.notEqual(result.sections[1], sections[0]);
});
test('starter appends empty sections and preserves existing content', () => {
  const result = updateSections(sections, null, 'starter');
  assert.equal(result.active, 2);
  assert.deepEqual(result.sections.slice(0, 2), sections);
  assert.deepEqual(result.sections.slice(2).map(s => s.heading), ['Introduction', 'Explanation', 'Examples', 'Practice']);
  assert.ok(result.sections.slice(2).every(s => s.body === ''));
});
test('section cap applies to add, duplicate and whole starter structure', () => {
  const full = Array.from({ length: 50 }, () => ({ ...sections[0] }));
  for (const action of ['add', 'duplicate', 'starter']) assert.equal(updateSections(full, 0, action).sections.length, 50);
  assert.equal(updateSections(full.slice(0, 47), null, 'starter').sections.length, 47);
});
test('removing selects a surviving neighbour, or none for an empty lesson', () => {
  assert.equal(updateSections(sections, 1, 'remove').active, 0);
  assert.equal(updateSections(sections.slice(0, 1), 0, 'remove').active, null);
});
test('empty and oversized sections are invalid; Unicode limits count characters', () => {
  assert.ok(sectionIssue({ heading: 'Introduction', body: '  ' }));
  assert.ok(sectionIssue({ heading: 'a'.repeat(201), body: 'Text' }));
  assert.ok(sectionIssue({ heading: 'Heading', body: 'x'.repeat(20001) }));
  assert.equal(sectionIssue({ heading: '😀'.repeat(200), body: 'Text\n\nSecond paragraph' }), null);
});
