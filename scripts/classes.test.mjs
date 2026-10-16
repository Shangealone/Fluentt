import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassSubmission,classFormError,copyClassCode,shareClassCode} from '../apps/mobile/src/features/classes/state.ts';
import {classApi} from '../apps/mobile/src/services/api/classes.ts';
import {ApiError} from '../apps/mobile/src/services/api/client.ts';
import {destination} from '../apps/mobile/src/session/routing.ts';
const draft={class_name:'Grade 5 English A',grade_level:5,language:'english',description:null};
const row={...draft,id:'synthetic-class',join_code:'000042',status:'active',created_at:'2026-10-17T00:00:00Z',updated_at:'2026-10-17T00:00:00Z'};
test('class form requires valid trimmed name, grade and language',()=>{
 assert.equal(classFormError(' A ',1,'english',''),null);assert.equal(classFormError('A',12,'tagalog','x'.repeat(500)),null);
 for(const [name,grade,language,description] of [[' ',1,'english',''],['a'.repeat(151),1,'english',''],['A',0,'english',''],['A',13,'english',''],['A',null,'english',''],['A',1,null,''],['A',1,'filipino',''],['A',1,'english','x'.repeat(501)]])assert.ok(classFormError(name,grade,language,description));
});
test('successful class issuance and repeated taps share one in-flight request',async()=>{
 const state=new ClassSubmission();let resolve;let requests=0;const request=async(value,key)=>{requests++;assert.deepEqual(value,draft);assert.equal(key,'request-1');return new Promise(r=>{resolve=r;});};
 const first=state.submit(draft,request,()=> 'request-1');assert.equal(state.busy,true);
 await assert.rejects(state.submit(draft,request,()=> 'request-2'),/wait/);assert.equal(requests,1);
 resolve(row);assert.equal(await first,row);assert.equal(state.busy,false);assert.equal(state.pending,null);
});
test('lost response retries same request and body; definitive validation allows correction',async()=>{
 const state=new ClassSubmission();let issuedKey;let attempt=0;
 const request=async(value,key)=>{assert.deepEqual(value,draft);issuedKey??=key;assert.equal(key,issuedKey);if(++attempt===1)throw new ApiError(0,'timeout');return row;};
 await assert.rejects(state.submit(draft,request,()=> 'first-key'),/timeout/);assert.ok(state.pending);
 await assert.rejects(state.submit({...draft,class_name:'Changed'},request,()=> 'new-key'),/original details/);
 assert.equal(await state.submit(draft,request,()=> 'new-key'),row);
 await assert.rejects(state.submit(draft,async()=>{throw new ApiError(422,'invalid');},()=> 'third-key'));
 assert.equal(state.pending,null);
});
test('instructor resume uses backend completion and does not generate another class',()=>{
 const pending={role:'instructor',profile_status:'onboarding',onboarding_step:'first_class'};
 assert.equal(destination(pending),'/first-class');assert.equal(destination({...pending,profile_status:'active',onboarding_step:null}),'/instructor');
});
test('copy preserves leading zeros and share contains only invitation data',async()=>{
 let copied;assert.equal(await copyClassCode('000042',async value=>{copied=value;return true;}),'Class code copied.');assert.equal(copied,'000042');
 let message;assert.equal(await shareClassCode('000042',row.class_name,async value=>{message=value;return true;}),'Share sheet opened.');
 assert.match(message,/000042/);assert.match(message,/intended students/);assert.doesNotMatch(message,/Bearer|flt_/);
 assert.equal(await shareClassCode('000042','A',async()=>false),'Sharing cancelled.');
 await assert.rejects(copyClassCode('000042',async()=>false),/Clipboard/);await assert.rejects(copyClassCode('42',async()=>true),/six-digit/);await assert.rejects(shareClassCode('42','A',async()=>true),/six-digit/);
});
test('class API create/list/details/edit uses authenticated centralized contracts',async()=>{
 const old=globalThis.fetch;const previous=process.env.EXPO_PUBLIC_API_URL;process.env.EXPO_PUBLIC_API_URL='http://localhost:8000/';const calls=[];
 try{
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json(url.includes('/mine')?[row]:row);};
 assert.equal((await classApi.create('test-secret',draft,'request-key')).join_code,'000042');assert.equal(calls.at(-1).options.headers['Idempotency-Key'],'request-key');assert.equal(calls.at(-1).options.headers.Authorization,'Bearer test-secret');assert.deepEqual(JSON.parse(calls.at(-1).options.body),draft);
 assert.deepEqual(await classApi.mine('test-secret'),[row]);assert.match(calls.at(-1).url,/limit=50&offset=0/);
 await classApi.mine('test-secret',50);assert.match(calls.at(-1).url,/offset=50/);
 assert.deepEqual(await classApi.get('test-secret',row.id),row);assert.match(calls.at(-1).url,/classes\/synthetic-class$/);
 await classApi.update('test-secret',row.id,{class_name:'Updated'});assert.equal(calls.at(-1).options.method,'PATCH');assert.deepEqual(JSON.parse(calls.at(-1).options.body),{class_name:'Updated'});
 for(const status of [401,403,404,409,422,429,503]){globalThis.fetch=async()=>Response.json({error:{code:'class_context_locked',message:'untrusted'}},{status});await assert.rejects(classApi.create('test-secret',draft,'request-key'),error=>error.status===status&&!error.message.includes('untrusted'));}
 globalThis.fetch=async()=>Response.json({...row,join_code:42});await assert.rejects(classApi.get('test-secret',row.id),/Unexpected class/);
 globalThis.fetch=async()=>Response.json({items:[]});await assert.rejects(classApi.mine('test-secret'),/Unexpected class list/);
 }finally{globalThis.fetch=old;if(previous===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=previous;}
});
