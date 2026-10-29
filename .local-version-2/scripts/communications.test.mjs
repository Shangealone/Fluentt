import test from 'node:test';
import assert from 'node:assert/strict';
import { communicationApi, communicationAccess, messageError, validateMessage } from '../apps/mobile/src/services/api/communications.ts';
import { MessageSubmission } from '../apps/mobile/src/features/communications/state.ts';
import { routeAllowed } from '../apps/mobile/src/session/routing.ts';
const message={id:'message',class_id:'class',kind:'direct',sender:{id:'sender',username:'Synthetic'},recipient_id:'recipient',content:' ñ😀 ',sent_at:'2026-10-19T00:00:00Z',read:false};
test('plain-text validation preserves raw Unicode and rejects blank, oversized, null and malformed text',()=>{
 assert.equal(messageError(' ñ😀\n<script>literal</script> '),null);assert.equal(messageError('😀'.repeat(4000)),null);
 for(const value of ['', '\t\n\u2003','x'.repeat(4001),'\0','\ud800'])assert(messageError(value));
 assert.equal(validateMessage(message),message);assert.throws(()=>validateMessage({...message,read_by:['other']}));
});
test('interrupted send keeps the original key/text and duplicate taps cannot race',async()=>{
 const submission=new MessageSubmission(),seen=[];
 await assert.rejects(submission.send('raw',async(body,key)=>{seen.push([body,key]);throw Error('offline');},()=> 'key'));
 assert.deepEqual(submission.pending,{content:'raw',key:'key'});
 let finish;const running=submission.send('changed',async(body,key)=>{seen.push([body,key]);return new Promise(done=>{finish=done;});},()=> 'new-key');
 await assert.rejects(submission.send('duplicate',async()=>{},()=> 'wrong'));
 finish(message);assert.equal(await running,message);assert.deepEqual(seen,[['raw','key'],['raw','key']]);assert.equal(submission.pending,null);
 await assert.rejects(submission.send('invalid',async()=>{throw {status:422};},()=> 'rejected'));assert.equal(submission.pending,null);
 submission.pending={content:'uncertain',key:'same'};submission.discard();assert.equal(submission.pending,null);
});
test('communication wrappers use bounded encoded paths, keys and explicit own read marks',async()=>{
 const previous=process.env.EXPO_PUBLIC_API_URL,original=globalThis.fetch;process.env.EXPO_PUBLIC_API_URL='http://localhost:8000';const seen=[];
 globalThis.fetch=async(url,options)=>{seen.push({url,options});return Response.json(url.includes('/read')||options.method==='POST'||url.includes('/communication/messages/')?message:url.includes('/communication?')?{viewer:{id:'viewer'}}:{items:[],as_of:message.sent_at,offset:0,limit:20,has_more:false});};
 try{
 const api=communicationAccess(operation=>operation('fixture-secret'));
 await api.classes('literal%_',20);await api.context('class/id','student/id');await api.participants('class/id','name',20);
 await api.history('class/id','student/id',20,message.sent_at);await api.send('class/id','student/id','raw','uuid');await api.detail('class/id','message/id');await api.read('class/id','message/id');
 assert(seen.every(({options})=>options.headers.Authorization==='Bearer fixture-secret'));
 assert.equal(new URL(seen[3].url).searchParams.get('before'),message.sent_at);assert(seen[3].url.includes('student%2Fid'));
 assert.equal(seen[4].options.headers['Idempotency-Key'],'uuid');assert.deepEqual(JSON.parse(seen[4].options.body),{content:'raw'});
 assert.deepEqual(JSON.parse(seen[6].options.body),{});assert.equal(new URL(seen[1].url).searchParams.get('student_id'),'student/id');
 globalThis.fetch=async()=>new Response('',{status:401});await assert.rejects(communicationApi.classes('x'),e=>e.status===401);
 }finally{globalThis.fetch=original;if(previous===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=previous;}
});
test('communication excludes personal/anonymous and unjoined school pathways',()=>{
 assert(routeAllowed({role:'instructor'},'communication'));assert(routeAllowed({role:'school_student',profile_status:'active'},'communication'));
 for(const profile of [null,{role:'personal_student',grade:5,language:'tagalog'},{role:'school_student',profile_status:'onboarding'}])assert(!routeAllowed(profile,'communication'));
});
