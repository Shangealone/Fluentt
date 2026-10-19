import test from 'node:test';
import assert from 'node:assert/strict';
import { captureApi, validateAttempt } from '../apps/mobile/src/services/api/capture.ts';
import { progress, savedBuffers, responseComplete } from '../apps/mobile/src/features/assignments/captureState.ts';
import { routeAllowed } from '../apps/mobile/src/session/routing.ts';
const items=[
 ['multiple_choice',{options:[{id:'a',text:'A'},{id:'b',text:'B'}]},{option_id:'a'}],['true_false',{}, {value:false}],
 ['identification',{}, {text:'  ñ😀 e\u0301  '}],['fill_in_the_blank',{blank_ids:['gap']},{blanks:[{blank_id:'gap',text:' raw '}]}],
 ['multiple_select',{options:[{id:'a',text:'A'},{id:'b',text:'B'}]},{option_ids:['a','b']}],['flashcards',{cue:'Cue'},{recall:'hard'}],
 ['error_identification',{tokens:[{id:'a',text:'A'},{id:'b',text:'B'}]},{selected_token_ids:['a']}],
 ['word_arrangement',{items:[{id:'a',text:'A'},{id:'b',text:'B'}]},{ordered_token_ids:['b','a']}],
 ['sentence_arrangement',{items:[{id:'a',text:'A'},{id:'b',text:'B'}]},{ordered_sentence_ids:['a','b']}],
 ['matching_type',{left:[{id:'a',text:'A'},{id:'b',text:'B'}],right:[{id:'a',text:'A'},{id:'b',text:'B'}]},{pairs:[{left_id:'a',right_id:'b'},{left_id:'b',right_id:'a'}]}]
];
const questions=items.map(([method,content],i)=>({id:`revision-${i}`,question_id:`question-${i}`,assignment_question_id:`item-${i}`,version:1,eligible:true,definition:{lesson_id:'lesson',method,prompt:'Synthetic prompt',instructions:null,content}}));
const row={id:'attempt',assignment_id:'assignment',class_id:'class',version_id:'version',title:'Synthetic',instructions:null,status:'in_progress',revision:'a'.repeat(64),started_at:'2026-10-19T00:00:00Z',submitted_at:null,position:1,question_count:10,completed_count:0,questions,responses:[],revealed_item_ids:[]};
test('all ten capture shapes retain pinned IDs, raw Unicode and deterministic question order',()=>{
 const buffers=Object.fromEntries(questions.map((item,i)=>[item.assignment_question_id,items[i][2]]));
 const body=progress(row,buffers,7);assert.equal(body.responses.length,10);assert.equal(body.position,7);
 assert.equal(body.responses[1].answer.value,false);assert.equal(body.responses[2].answer.text,'  ñ😀 e\u0301  ');
 questions.forEach((item,i)=>assert(responseComplete(item,items[i][2])));
 assert(!responseComplete(questions[2],{text:'   '}));assert(!responseComplete(questions[7],{ordered_token_ids:['a']}));
 assert(!responseComplete(questions[3],{blanks:[]}));assert(!responseComplete(questions[0],undefined));
 assert.deepEqual(savedBuffers({...row,responses:body.responses}),buffers);
 assert.equal(progress(row,{...buffers,foreign:{value:true}},1).responses.length,10);
});
test('only eligible school students may enter attempt navigation',()=>{
 for(const role of ['school_student','personal_student','instructor'])assert.equal(routeAllowed({role,profile_status:'active'},'assignment-attempt'),role==='school_student');
 assert(!routeAllowed(null,'assignment-attempt'));assert(!routeAllowed({role:'school_student',profile_status:'onboarding'},'assignment-attempt'));
});
test('capture client verifies public payloads, versions, freshness and idempotent finalization headers',async()=>{
 const original=globalThis.fetch,previous=process.env.EXPO_PUBLIC_API_URL;process.env.EXPO_PUBLIC_API_URL='http://localhost:8000';let seen=[];
 globalThis.fetch=async(url,options)=>{seen.push({url,options});return Response.json(row);};
 try{
  assert.equal(validateAttempt(row),row);
  await captureApi.start('secret','assignment');assert.equal(seen.at(-1).options.method,'POST');assert.equal(seen.at(-1).options.headers.Authorization,'Bearer secret');
  await captureApi.save('secret',row,{position:1,responses:[]});assert.equal(seen.at(-1).options.headers['If-Match'],row.revision);
  await captureApi.submit('secret',row,{position:1,responses:[]},'submission-key');assert.equal(seen.at(-1).options.headers['Idempotency-Key'],'submission-key');assert.equal(JSON.parse(seen.at(-1).options.body).confirm,true);
  globalThis.fetch=async()=>Response.json({revision_id:'foreign',back:'PRIVATE',attempt_revision:row.revision});await assert.rejects(captureApi.reveal('secret',row,questions[5]));
  assert.throws(()=>validateAttempt({...row,questions:[{...questions[0],definition:{...questions[0].definition,answer_key:'PRIVATE'}}]}));
  assert.throws(()=>validateAttempt({...row,status:'submitted',submitted_at:'now'}));
  globalThis.fetch=async()=>new Response('',{status:401});await assert.rejects(captureApi.read('secret','attempt'),e=>e.status===401);
 }finally{globalThis.fetch=original;if(previous===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=previous;}
});
