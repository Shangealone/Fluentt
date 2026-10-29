// Synthetic cards; no event persistence, scorer or scheduler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft, validateDraft, definitionFromDraft, draftFromDefinition, publicDefinition, isRevision, methods } from '../apps/admin/src/services/questions-contract.ts';
import { flashcardFrontFromRevision, initialCardState, usableBack, revealCard, rateCard, flashcardResponse, validDeck } from '../apps/mobile/src/features/questions/flashcards.ts';
const id='00000000-0000-0000-0000-000000000001';
const draft=()=>({...newDraft('flashcards'),lesson_id:id,language:'tagalog',prompt:'Synthetic directions',cue:'Synthetic ñ😀 e\u0301 front',back:'PRIVATE BACK',explanation:'PRIVATE EXPLANATION',rubricVersion:'retained-reference'});
const revision=definition=>({id,question_id:id,version:1,status:'draft',locked_at:null,revision:'a'.repeat(64),competency_ids:[],definition});
test('all ten editors include the unchanged flashcards contract and round-trip private metadata',()=>{
  assert.equal(methods.length,10);assert.equal(new Set(methods).size,10);
  const d=definitionFromDraft(draft());assert.deepEqual(definitionFromDraft(draftFromDefinition(d)),d);
  assert.equal(d.answer_key.scoring_rubric_version,'retained-reference');assert(isRevision(revision(publicDefinition(d))));
  assert.equal(definitionFromDraft({...draft(),rubricVersion:''}).answer_key.scoring_rubric_version,null);
});
test('front and back are independently required; repeated text is valid, not an identity key',()=>{
  for(const key of ['cue','back'])for(const value of ['', ' '])assert(validateDraft({...draft(),[key]:value})[key]);
  const d=definitionFromDraft({...draft(),back:draft().cue});assert.equal(d.content.cue,d.answer_key.back);
});
test('public revision projection never exposes back, rubric or explanation',()=>{
  const d=definitionFromDraft(draft()),safe=publicDefinition(d);
  assert.deepEqual(safe.content,{cue:d.content.cue});assert(!/PRIVATE|answer_key|scoring_rubric_version|explanation/.test(JSON.stringify(safe)));
  for(const content of [{},{cue:''},{cue:5},{cue:'Fixture',back:'LEAK'}])assert(!isRevision(revision({...d,content})));
});
test('mobile front adapter never copies private fields and revision-bound back cannot cross cards',()=>{
  const d=definitionFromDraft(draft()),front=flashcardFrontFromRevision(revision(d));assert(front);
  assert(!/PRIVATE|answer_key|scoring_rubric_version/.test(JSON.stringify(front)));
  assert(!usableBack(front,{revision_id:'another',back:d.answer_key.back}));assert(!usableBack(front,{revision_id:id,back:' '}));
  assert(usableBack(front,{revision_id:id,back:d.answer_key.back}));
  for(const value of [null,{},revision({...d,content:{cue:5}}),revision({...d,content:{cue:''}}),revision({...d,method:'true_false'})])assert.equal(flashcardFrontFromRevision(value),null);
  assert(validDeck([{front,back:null}]));assert(!validDeck([{front,back:null},{front,back:null}]));
  assert(validDeck([{front,back:null},{front:{...front,id:'another'},back:null}])); // repeated labels, distinct versions
});
test('ratings require reveal, reject invalid/repeated actions and never produce scoring or telemetry',()=>{
  const front=flashcardFrontFromRevision(revision(definitionFromDraft(draft()))), back={revision_id:id,back:'Fixture'};
  for(const rating of ['again','hard','good','easy']){
    const initial=initialCardState();assert.equal(rateCard(initial,rating),initial);assert.equal(flashcardResponse(initial),null);
    assert.equal(revealCard(front,null,initial),initial);
    const revealed=revealCard(front,back,initial);assert.equal(revealCard(front,back,revealed),revealed);
    const rated=rateCard(revealed,rating);assert.deepEqual(flashcardResponse(rated),{method:'flashcards',answer:{recall:rating}});
    assert.equal(rateCard(rated,'again'),rated);assert.equal(rateCard(revealed,'unknown'),revealed);assert.equal(rateCard(revealed,'__proto__'),revealed);
    assert.deepEqual(initialCardState(),{revealed:false,recall:null});
  }
});
