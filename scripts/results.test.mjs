import test from 'node:test';
import assert from 'node:assert/strict';
import { validateResult, resultsApi, resultsAccess } from '../apps/mobile/src/services/api/results.ts';
import { routeAllowed } from '../apps/mobile/src/session/routing.ts';
const base={assignment_id:'assignment',class_id:'class',version_id:'version',title:'Synthetic fixture',attempt_id:'attempt',
 student_id:null,student_username:null,submitted_at:'2026-10-19T00:00:00Z',submission_status:'submitted',state:'withheld',released:false,
 revision:'a'.repeat(64),pinned_run_id:null,evaluation:{id:'run',status:'COMPLETE',engine_version:'fixture-v1',policy_version:'objective-exact-v1',evaluated_at:'now'},
 earned_points:null,possible_points:null,items:[]};
const released={...base,state:'released',released:true,pinned_run_id:'run',earned_points:'6.00',possible_points:'9.00'};
test('result DTO rejects premature scores, malformed decimals and unsafe review content',()=>{
 assert.equal(validateResult(base),base);assert.equal(validateResult(released),released);
 assert.throws(()=>validateResult({...base,earned_points:'6.00'}));
 assert.throws(()=>validateResult({...released,earned_points:6}));
 assert.throws(()=>validateResult({...released,possible_points:null}));
 assert.throws(()=>validateResult({...released,evaluation:{...released.evaluation,status:'REVIEW_REQUIRED'}}));
 const question={id:'qrev',question_id:'q',version:1,eligible:true,definition:{method:'true_false',lesson_id:'lesson',prompt:'Fixture',instructions:null,content:{}}};
 const item={result_id:'r',question_revision_id:'qrev',response_id:'response',assignment_question_id:'aq',position:1,question,answer:{value:false},state:'AUTO_GRADABLE',correct:true,awarded_points:'1.00',max_points:'1.00'};
 assert.equal(validateResult({...released,items:[item]}).items[0].answer.value,false);
 assert.throws(()=>validateResult({...base,items:[item]}));
 assert.throws(()=>validateResult({...released,items:[{...item,question:{...question,definition:{...question.definition,answer_key:'PRIVATE'}}}]}));
 assert.throws(()=>validateResult({...released,items:[{...item,question_revision_id:'wrong'}]}));
});
test('results use secure session wrapper, fixed encoded paths and retry identity/freshness',async()=>{
 const original=globalThis.fetch,previous=process.env.EXPO_PUBLIC_API_URL;process.env.EXPO_PUBLIC_API_URL='http://localhost:8000';const calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json(released);};
 try{
  const api=resultsAccess(async operation=>operation('fixture-secret'));
  await api.student('assignment/foreign');assert(calls[0].url.includes('assignment%2Fforeign/result'));
  assert.equal(calls[0].options.headers.Authorization,'Bearer fixture-secret');
  await api.release(base,true,'fixture-retry-key');await api.release(base,true,'fixture-retry-key');
  assert.deepEqual(calls.at(-1),calls.at(-2));assert.equal(calls.at(-1).options.headers['If-Match'],base.revision);
  assert.equal(calls.at(-1).options.headers['Idempotency-Key'],'fixture-retry-key');
  assert.deepEqual(JSON.parse(calls.at(-1).options.body),{run_id:'run',released:true,confirm:true});
  await api.owner('attempt','run/a');assert(calls.at(-1).url.endsWith('?run_id=run%2Fa'));
  globalThis.fetch=async()=>new Response('',{status:401});await assert.rejects(resultsApi.student('fixture','assignment'),error=>error.status===401);
 }finally{globalThis.fetch=original;if(previous===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=previous;}
});
test('results route guards preserve school/instructor separation and onboarding boundary',()=>{
 for(const role of ['school_student','instructor','personal_student']){
  const profile={role,profile_status:'active'};
  assert.equal(routeAllowed(profile,'assessment-results'),role==='school_student');
  assert.equal(routeAllowed(profile,'assignment-results'),role==='instructor');
 }
 assert(!routeAllowed(null,'assessment-results'));assert(!routeAllowed(null,'assignment-results'));
 assert(!routeAllowed({role:'school_student',profile_status:'onboarding'},'assessment-results'));
});
