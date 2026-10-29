import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentApi, validateAssignment, validateItem } from '../apps/mobile/src/services/api/assignments.ts';
import { DraftSubmission, addItem, moveItem, draftError } from '../apps/mobile/src/features/assignments/state.ts';
import { routeAllowed } from '../apps/mobile/src/session/routing.ts';
const item={id:'revision-a',question_id:'question-a',version:1,eligible:true,definition:{lesson_id:'lesson-a',method:'true_false',prompt:'Synthetic',instructions:null,content:{}}};
const body={title:'Draft',instructions:null,lesson_id:'lesson-a',question_revision_ids:[item.id]};
const row={id:'draft-a',class_id:'class-a',version_id:'version-a',revision:'a'.repeat(64),status:'draft',title:'Draft',instructions:null,context:{lesson_id:'lesson-a'},questions:[item],editable:true,eligible:true,requires_subject:true};
test('stable identities prevent duplicate versions and retain selected order without scoring',()=>{
  assert.equal(addItem([item],{...item,id:'revision-b',version:2})[0],item);assert.equal(addItem([item],{...item,id:'revision-b',version:2}).length,1);
  const other={...item,id:'b',question_id:'question-b'};assert.deepEqual(moveItem([item,other],1,-1),[other,item]);
  assert.equal(draftError(body,[item]),null);assert(draftError(body,[item,{...item,id:'another'}]));assert(draftError(body,[{...item,eligible:false}]));
  assert(draftError({...body,title:' '},[item]));assert(draftError({...body,instructions:'x'.repeat(8001)},[item]));
  assert(draftError({...body,lesson_id:'another'},[item]));assert.equal(draftError({...body,question_revision_ids:[]},[]),null);
});
test('interrupted creation freezes original body/key; single flight and explicit retry prevent duplication',async()=>{
  const submission=new DraftSubmission();let calls=0,keys=[];const original={...body,question_revision_ids:[...body.question_revision_ids]};
  const issue=async(data,key)=>{calls++;keys.push(key);assert.deepEqual(data,original);if(calls===1)throw Object.assign(new Error('timeout'),{status:408});return row;};
  await assert.rejects(submission.create(body,issue,()=> 'fixed-key'));assert(submission.pending);
  await assert.rejects(submission.create({...body,title:'Changed'},issue,()=> 'wrong-key'),/original/);
  assert.equal(await submission.create(body,issue,()=> 'wrong-key'),row);assert.deepEqual(keys,['fixed-key','fixed-key']);assert.equal(submission.pending,null);
  let release;const pending=submission.create(body,()=>new Promise(resolve=>{release=resolve;}),()=> 'next');
  await assert.rejects(submission.create(body,issue,()=> 'third'),/wait/);release(row);await pending;
});
test('malformed or private previews are rejected and only instructors reach draft routes',()=>{
  assert.equal(validateAssignment(row),row);
  for(const bad of [{...item,definition:{...item.definition,answer_key:{back:'PRIVATE'}}},{...item,definition:{...item.definition,content:{back:'PRIVATE'}}},{...item,definition:{...item.definition,content:[]}}])assert.throws(()=>validateItem(bad));
  for(const role of ['personal_student','school_student','instructor'])for(const route of ['assignments','assignment-builder'])assert.equal(routeAllowed({role,profile_status:'active'},route),role==='instructor');
  assert(!routeAllowed(null,'assignment-builder'));
});
test('typed assignment client sends device authentication, exact retry/freshness headers and safe filters',async()=>{
  const savedFetch=globalThis.fetch,previous=process.env.EXPO_PUBLIC_API_URL;process.env.EXPO_PUBLIC_API_URL='http://localhost:8000';let seen=[];
  globalThis.fetch=async(url,options)=>{seen.push({url,options});return Response.json(row);};
  try{
    await assignmentApi.create('device-secret','class-a',body,'creation-key');assert.equal(seen[0].options.headers.Authorization,'Bearer device-secret');assert.equal(seen[0].options.headers['Idempotency-Key'],'creation-key');
    await assignmentApi.save('device-secret',row,body);assert.equal(seen[1].options.headers['If-Match'],row.revision);assert.equal(seen[1].options.method,'PATCH');
    globalThis.fetch=async(url,options)=>{seen.push({url,options});return Response.json({items:[],has_more:false,offset:0,limit:20});};
    await assignmentApi.questions('device-secret','class-a','lesson-a','ñ & ?','flashcards',0);assert(seen.at(-1).url.includes('method=flashcards')&&seen.at(-1).url.includes('lesson_id=lesson-a'));
    globalThis.fetch=async()=>new Response('',{status:401});await assert.rejects(assignmentApi.get('expired','draft-a'),error=>error.status===401);
  }finally{globalThis.fetch=savedFetch;if(previous===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=previous;}
});
test('published navigation is school-student-only; clients preserve publish retry headers and reject content leakage',async()=>{
  for(const role of ['personal_student','school_student','instructor'])assert.equal(routeAllowed({role,profile_status:'active'},'published-assignments'),role==='school_student');
  assert(!routeAllowed({role:'school_student',profile_status:'onboarding'},'published-assignments'));assert(!routeAllowed(null,'published-assignments'));
  const savedFetch=globalThis.fetch, previous=process.env.EXPO_PUBLIC_API_URL;process.env.EXPO_PUBLIC_API_URL='http://localhost:8000';let seen;
  globalThis.fetch=async(url,options)=>{seen={url,options};return Response.json({...row,status:'published',editable:false});};
  try{
    await assignmentApi.publish('device-secret',{...row,context:{...row.context,subject_id:'subject-a'}},'publish-key');
    assert.equal(seen.options.headers['Idempotency-Key'],'publish-key');assert.equal(seen.options.headers['If-Match'],row.revision);
    assert.deepEqual(JSON.parse(seen.options.body),{confirm:true,bind_subject_id:'subject-a'});
    const published={id:row.id,class_id:row.class_id,version_id:row.version_id,status:'published',title:'Fixture',instructions:null,context:{...row.context,lesson_name:'Fixture'},published_at:'2026-10-19T00:00:00Z',question_count:1,methods:['true_false']};
    globalThis.fetch=async()=>Response.json(published);assert.equal((await assignmentApi.publishedDetail('device-secret',row.id)).id,row.id);
    globalThis.fetch=async()=>Response.json({...published,questions:[item]});await assert.rejects(assignmentApi.publishedDetail('device-secret',row.id));
    globalThis.fetch=async()=>new Response('',{status:404});await assert.rejects(assignmentApi.publishedDetail('device-secret',row.id),e=>e.status===404);
  }finally{globalThis.fetch=savedFetch;if(previous===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=previous;}
});
