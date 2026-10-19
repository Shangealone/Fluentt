import test from 'node:test';
import assert from 'node:assert/strict';
import { monitoringApi, monitoringAccess, validateMean, validateOverview } from '../apps/mobile/src/services/api/monitoring.ts';
import { routeAllowed } from '../apps/mobile/src/session/routing.ts';
const counts={available:2,not_started:1,in_progress:0,submitted:1,pending:1};
const results={awaiting_evaluation:0,awaiting_manual_review:0,withheld:0,released:1,not_applicable:0};
const overview={classroom:{id:'class',class_name:'Synthetic class',grade:5,language:'tagalog'},as_of:'2026-10-19T00:00:00Z',available_assignments:1,eligible_students:2,counts,results,progress_policy:'submission-counts-v1'};
const mean={status:'available',eligible_results:1,mean_points:'0.00',max_points:'9.00',engine_version:'v1',policy_version:'p1',mean_policy:'released-assignment-mean-v1'};
test('monitoring counts validate denominators and means preserve zero/unknown states',()=>{
 assert.equal(validateOverview(overview),overview);
 assert.throws(()=>validateOverview({...overview,eligible_students:3}));
 assert.throws(()=>validateOverview({...overview,counts:{...counts,submitted:3}}));
 assert.equal(validateMean(mean).mean_points,'0.00');
 assert.throws(()=>validateMean({...mean,status:'not_comparable'}));
 assert.throws(()=>validateMean({...mean,mean_points:0}));
 assert.throws(()=>validateMean({...mean,eligible_results:0}));
 assert.equal(validateMean({...mean,status:'unavailable',eligible_results:0,mean_points:null,max_points:null}).status,'unavailable');
});
test('monitoring wrapper sends authenticated read-only bounded encoded requests',async()=>{
 const previous=process.env.EXPO_PUBLIC_API_URL, original=globalThis.fetch;process.env.EXPO_PUBLIC_API_URL='http://localhost:8000';const seen=[];
 const page={items:[],offset:0,limit:20,has_more:false};
 globalThis.fetch=async(url,options)=>{seen.push({url,options});return Response.json(url.includes('/monitoring?')?overview:url.includes('/students/student%2Fid')?{...page,summary:{},overview}:url.includes('/assignments/assignment%2Fid')?{...page,summary:{mean},overview}:page);};
 try{
 const api=monitoringAccess(operation=>operation('fixture-secret'));
 await api.classes('a%_',20); await api.overview('class/id');await api.contexts('class/id','edition',20);
 await api.students('class/id',{q:'%_',lesson_id:'lesson'},20);await api.assignments('class/id',{});
 await api.student('class/id','student/id',{status:'submitted'});await api.assignment('class/id','assignment/id',{});
 assert(seen.every(({options})=>options.method==='GET'&&options.body===undefined&&options.headers.Authorization==='Bearer fixture-secret'));
 assert.equal(new URL(seen[0].url).searchParams.get('offset'),'20');assert.equal(new URL(seen[0].url).searchParams.get('q'),'a%_');
 assert(seen[1].url.includes('class%2Fid'));assert.equal(new URL(seen[2].url).searchParams.get('kind'),'edition');
 assert.equal(new URL(seen[3].url).searchParams.get('lesson_id'),'lesson');
 globalThis.fetch=async()=>new Response('',{status:401});await assert.rejects(monitoringApi.classes('x'),e=>e.status===401);
 }finally{globalThis.fetch=original;if(previous===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=previous;}
});
test('monitoring route is restricted to instructor identities',()=>{
 assert(routeAllowed({role:'instructor',profile_status:'active'},'instructor-monitoring'));
 for(const profile of [null,{role:'personal_student',grade:5,language:'tagalog'},{role:'school_student',profile_status:'active'}]) assert(!routeAllowed(profile,'instructor-monitoring'));
});
