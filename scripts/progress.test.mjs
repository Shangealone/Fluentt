import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSummary, validateHistory, progressApi, progressAccess } from '../apps/mobile/src/services/api/progress.ts';
import { historyFilters } from '../apps/mobile/src/features/progress/filters.ts';
import { routeAllowed } from '../apps/mobile/src/session/routing.ts';
const stamp='2026-10-19T00:00:00Z';
const summary={availability:'available',as_of:stamp,class_id:null,class_name:null,class_count:2,policy_version:'submission-counts-v1',counts:{available:3,not_started:1,in_progress:1,submitted:1,pending:2}};
const row={id:'assignment',version_id:'version',class_id:'class',class_name:'Fixture class',language:'tagalog',title:'Synthetic assignment',context:{lesson_id:'lesson',lesson_name:'Lesson fixture',curriculum_version_id:'edition',curriculum_name:'Edition fixture',grade:5,subject_id:'subject',subject_name:'Filipino'},submission_status:'submitted',result_state:'withheld',attempt_id:'attempt',published_at:stamp,started_at:stamp,last_activity_at:stamp,submitted_at:stamp,sort_at:stamp,released_run_id:null,policy_version:null,earned_points:null,possible_points:null};
const page={availability:'available',as_of:stamp,items:[row],offset:0,limit:20,has_more:false};
test('progress DTO validates trusted counts and distinguishes unavailable from empty',()=>{
 assert.equal(validateSummary(summary),summary);assert.throws(()=>validateSummary({...summary,counts:{...summary.counts,submitted:2}}));
 assert.throws(()=>validateSummary({...summary,counts:{...summary.counts,pending:-1}}));
 assert.throws(()=>validateSummary({...summary,availability:'unavailable'}));
 assert.equal(validateSummary({...summary,availability:'unavailable',class_count:null,counts:null}).counts,null);
 assert.equal(validateSummary({...summary,counts:{available:0,not_started:0,in_progress:0,submitted:0,pending:0}}).counts.available,0);
});
test('history refuses duplicate inflation, unreleased points and unsupported presentation',()=>{
 assert.equal(validateHistory(page),page);
 assert.throws(()=>validateHistory({...page,items:[row,row]}));
 assert.throws(()=>validateHistory({...page,items:[{...row,earned_points:'1.00'}]}));
 const released={...row,result_state:'released',released_run_id:'run',policy_version:'objective-exact-v1',earned_points:'0.00',possible_points:'9.00'};
 assert.equal(validateHistory({...page,items:[released]}).items[0].earned_points,'0.00');
 assert.throws(()=>validateHistory({...page,items:[{...released,earned_points:0}]}));
 assert.throws(()=>validateHistory({...page,items:[{...row,answer_key:'PRIVATE'}]}));
 assert.throws(()=>validateHistory({...page,availability:'unavailable'}));
});
test('history date filters validate calendar dates and include the full local end date',()=>{
 const values=historyFilters('class','submitted','2026-10-18','2026-10-19');
 assert.equal(values.class_id,'class');assert.equal(new Date(values.since).getDate(),18);assert.equal(new Date(values.before).getDate(),20);
 assert.equal(new Date(values.before).getHours(),0);
 assert.throws(()=>historyFilters(undefined,'all','2026-02-30',''));assert.throws(()=>historyFilters(undefined,'all','2026-10-20','2026-10-19'));
 assert.throws(()=>historyFilters(undefined,'all','2026-1-1',''));assert.deepEqual(historyFilters(undefined,'all','',''),{status:'all'});
 assert.equal(new Date(historyFilters(undefined,'all','2028-02-29','2028-02-29').before).getDate(),1);
});
test('progress uses authenticated wrappers and bounded encoded filter requests',async()=>{
 const previous=process.env.EXPO_PUBLIC_API_URL,original=globalThis.fetch;process.env.EXPO_PUBLIC_API_URL='http://localhost:8000';const seen=[];
 globalThis.fetch=async(url,options)=>{seen.push({url,options});return Response.json(url.includes('learning-history')?page:summary);};
 try{
  const api=progressAccess(async operation=>operation('fixture-secret'));
  await api.summary('class/other');assert(seen[0].url.endsWith('?class_id=class%2Fother'));assert.equal(seen[0].options.headers.Authorization,'Bearer fixture-secret');
  await api.history({class_id:'class',status:'submitted',since:stamp},20);
  const url=new URL(seen.at(-1).url);assert.equal(url.searchParams.get('offset'),'20');assert.equal(url.searchParams.get('since'),stamp);
  assert.equal(seen.at(-1).options.method,'GET');assert.equal(seen.at(-1).options.body,undefined);
  globalThis.fetch=async()=>new Response('',{status:401});await assert.rejects(progressApi.summary('fixture-secret'),error=>error.status===401);
 }finally{globalThis.fetch=original;if(previous===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=previous;}
});
test('history route is available only after student onboarding, never to instructors',()=>{
 assert(routeAllowed({role:'school_student',profile_status:'active'},'learning-history'));
 assert(routeAllowed({role:'personal_student',profile_status:'active',grade:5,language:'tagalog'},'learning-history'));
 assert(!routeAllowed({role:'instructor',profile_status:'active'},'learning-history'));
 assert(!routeAllowed(null,'learning-history'));assert(!routeAllowed({role:'school_student',profile_status:'onboarding'},'learning-history'));
 assert(!routeAllowed({role:'personal_student',profile_status:'onboarding'},'learning-history'));
});
