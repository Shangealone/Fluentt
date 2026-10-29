// Actual TS/TSX contracts + BFF handler with synthetic upstream responses, no auth bypass.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const admin = path.join(root, 'apps/admin');
const local = Module.createRequire(path.join(admin, 'package.json'));
const ts = local('typescript');
const React = local('react');
const {renderToStaticMarkup} = local('react-dom/server');
const cache = new Map();
function load(name) {
  const file = ['.ts', '.tsx', ''].map(ext => name + ext).find(file => fs.existsSync(file));
  if (cache.has(file)) return cache.get(file).exports;
  const mod = new Module(file); cache.set(file, mod);
  mod.require = name => {
    if (name.endsWith('.module.css')) return new Proxy({}, {get: (_, key) => String(key)});
    if (name === 'next/link') return {__esModule: true, default: ({children, ...props}) => React.createElement('a', props, children)};
    if (name.startsWith('@/')) return load(path.join(admin, 'src', name.slice(2)));
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
    return local(name);
  };
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}}).outputText;
  mod._compile(output, file); return mod.exports;
}
const contract = load(path.join(admin, 'src/services/research-classroom-contract'));
const {researchRoute} = load(path.join(admin, 'src/services/research-routing'));
const {proxyResearchSetup} = load(path.join(admin, 'src/services/research-proxy'));
const {ResearchProtocolForm} = load(path.join(admin, 'src/components/research-protocol-form'));
const {AdminNav} = load(path.join(admin, 'src/components/admin-nav'));
const reportingContract = load(path.join(admin, 'src/services/research-reporting-contract'));
const {ResearchReportingPanel} = load(path.join(admin, 'src/components/research-reporting-panel'));
const id = '6bbd7d97-caa0-4fd0-9000-0121bfdc83a0';
const csrf = 'c'.repeat(43);
const profile = {username: 'SyntheticResearcher', role: 'administrator', permissions: ['dashboard.view','research.read','research.manage'], csrf_token: csrf, expires_at: '2029-01-01T00:00:00Z', absolute_expires_at: '2029-01-02T00:00:00Z'};
const config = {starts_at: null, ends_at: null, timezone: null, active_weekdays: null, protocol_reference: null, consent_document_version: null, consent_requirements: null, allocation_unit: null, allocation_policy: null, due_date_policy: null, conditions: [], assessments: [], declared_evidence: {}};
const study = {id, study_id: id, code:'SYNTHETIC-ONLY', title:'Synthetic test draft', language:'english', protocol_version:'synthetic-v1', target_participants:7, status:'DRAFT', revision:`"${id}:1"`, protocol_id:id, configuration_version:1, configuration_fingerprint:'a'.repeat(64), configuration:config, activation_blockers:['verified_authorization_missing:ethics']};
const url = '/research-classrooms/studies';
function request(method='GET', suffix='', options={}) {
  const value = new Request(`http://localhost:3000/api/admin/research/classrooms/studies${suffix}`, {method, ...options});
  Object.defineProperty(value, 'cookies', {value: {get: name => options.demo && name === 'fluentt_demo_admin' ? {value:'1'} : undefined}});
  return value;
}
function fixture(permissions=profile.permissions, upstreamStatus=200) {
  const calls=[];
  const deps={webOrigin:()=> 'http://localhost:3000', adminCookieNames:()=> ['fluentt_admin'], backend:async (path, init) => {
    calls.push({path, init});
    return Response.json(path === '/me' ? {...profile, permissions} : {items:[study], offset:0, limit:25, has_more:false}, {status:path === '/me' ? 200 : upstreamStatus});
  }};
  return {deps,calls};
}
test('fixed routes exclude legacy datasets, private keys, traversal, unknown queries and methods', () => {
  assert.equal(researchRoute(['studies'], 'GET', new URLSearchParams('limit=25&offset=0')), `${url}?limit=25&offset=0`);
  assert.equal(researchRoute(['studies',id,'choices'], 'GET', new URLSearchParams('kind=classrooms')), `${url}/${id}/choices?kind=classrooms`);
  for (const segments of [['studies','../users'],['studies',id,'key'],['studies',id,'analytics'],['studies',id,'exports'],['users']]) assert.equal(researchRoute(segments,'GET',new URLSearchParams()),null);
  assert.equal(researchRoute(['studies',id,'choices'],'POST',new URLSearchParams('kind=instruments')),null);
  for (const q of ['limit=101','offset=10001','kind=classrooms','limit=1&limit=2','q=private']) assert.equal(researchRoute(['studies'],'GET',new URLSearchParams(q)),null);
  assert.equal(researchRoute(['studies'],'DELETE',new URLSearchParams()),null);
});
test('demo flag denies access, and new research setup has no fabricated fallback', async () => {
  const {deps,calls}=fixture();
  const response=await proxyResearchSetup(request('GET','',{demo:true}),['studies'],deps);
  assert.equal(response.status,403); assert.equal(calls.length,0);
  assert.match(await response.text(),/Demo access cannot/);
});
test('BFF rechecks live research privileges and never forwards bearer or unrelated headers',async()=>{
  const noAccess=fixture(['dashboard.view']);
  assert.equal((await proxyResearchSetup(request(),['studies'],noAccess.deps)).status,403);
  const {deps,calls}=fixture();
  const response=await proxyResearchSetup(request('GET','',{headers:{Authorization:'Bearer personal-token',Cookie:'unrelated=secret'}}),['studies'],deps);
  assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(calls[0].path,'/me'); assert.equal(calls[1].path,url);
  assert.equal(calls[1].init.headers.get('Authorization'),null); assert.equal(calls[1].init.headers.get('Cookie'),null);
});
const mutationHeaders={'Content-Type':'application/json',Origin:'http://localhost:3000','X-CSRF-Token':csrf,'Idempotency-Key':id,'If-Match':study.revision};
test('writes require same origin, CSRF, UUID retry, exact revision and bounded JSON',async()=>{
  for (const [change,status] of [[{Origin:'https://foreign.example'},403],[{'X-CSRF-Token':''},403],[{'Idempotency-Key':'bad'},422],[{'If-Match':''},428]]) {
    const {deps,calls}=fixture();
    const response=await proxyResearchSetup(request('POST',`/${id}/protocols`,{headers:{...mutationHeaders,...change},body:'{}'}),['studies',id,'protocols'],deps);
    assert.equal(response.status,status); assert.equal(calls.length,0);
  }
  const {deps}=fixture();
  assert.equal((await proxyResearchSetup(request('POST','',{headers:mutationHeaders,body:'a'.repeat(131073)}),['studies'],deps)).status,413);
  assert.equal((await proxyResearchSetup(request('POST','',{headers:mutationHeaders,body:'bad json'}),['studies'],deps)).status,422);
});
test('write headers/body preserve exact request identity and backend validation responses',async()=>{
  const {deps,calls}=fixture(undefined,412); const body=JSON.stringify({timezone:'Asia/Manila'});
  const response=await proxyResearchSetup(request('POST',`/${id}/protocols`,{headers:mutationHeaders,body}),['studies',id,'protocols'],deps);
  assert.equal(response.status,412);
  assert.equal(calls[1].init.body,body); assert.equal(calls[1].init.headers.get('Idempotency-Key'),id); assert.equal(calls[1].init.headers.get('If-Match'),study.revision);
  const readOnly=fixture(['dashboard.view','research.read']);
  assert.equal((await proxyResearchSetup(request('POST','',{headers:mutationHeaders,body:'{}'}),['studies'],readOnly.deps)).status,403);
});
test('session loss expires only dedicated admin cookie; unknown upstream outcome is explicit',async()=>{
  const {deps}=fixture(); deps.backend=async()=>Response.json({error:{}},{status:401});
  const expired=await proxyResearchSetup(request(),['studies'],deps);
  assert.equal(expired.status,401); assert.match(expired.headers.get('set-cookie'),/^fluentt_admin=;/);
  deps.backend=async()=>{throw new Error('offline');};
  const offline=await proxyResearchSetup(request(),['studies'],deps);
  assert.equal(offline.status,503); assert.match(await offline.text(),/may have committed/);
});
test('form builder preserves proposals without defaulting weekdays, duration or attempts',()=>{
  const data=new FormData(); data.set('weeks','3'); data.set('timezone','Asia/Manila');
  const built=contract.buildConfiguration(data,config,[]);
  assert.equal(built.administrator_setup.proposed_intervention_weeks,3);
  assert.equal(built.active_weekdays,null); assert.equal(built.starts_at,null); assert.equal(built.administrator_setup.assessment_attempt_limit,null);
  assert.deepEqual(built.conditions,[]);
  for (const [key,value] of [['weeks','0'],['attempts','1.2'],['timezone','Invented/Zone']]) {
    const invalid=new FormData(); invalid.set(key,value); assert.throws(()=>contract.buildConfiguration(invalid,config,[]));
  }
  const invalid=new FormData(); invalid.set('pre_test.opens','2027-01-03T00:00:00'); invalid.set('pre_test.closes','2027-01-02T00:00:00');
  assert.throws(()=>contract.buildConfiguration(invalid,config,[]),/end after/);
});
test('activation requires backend gates, supported state edge and manage permission',()=>{
  assert.equal(contract.allowedTransition(study,'READY',true),false);
  const clear={...study,activation_blockers:[]};
  assert.equal(contract.allowedTransition(clear,'READY',true),true);
  assert.equal(contract.allowedTransition(clear,'ACTIVE',true),false);
  assert.equal(contract.allowedTransition(clear,'READY',false),false);
  assert.equal(contract.allowedTransition({...clear,status:'COMPLETED'},'ACTIVE',true),false);
});
test('actual form has native labels, legends, approval disclosure, no assumed weekdays and frozen read-only state',()=>{
  const props={study,conditions:[],instruments:[],disabled:false,onSave:async()=>{},onDirty:()=>{}};
  const html=renderToStaticMarkup(React.createElement(ResearchProtocolForm,props));
  for(const text of ['<legend>1. Study calendar','Study starts (UTC)','Daily opens','Questionnaire','Timer','Required evidence kinds','cannot verify ethics approval']) {
    if(text !== 'Timer') assert.ok(html.includes(text),text);
  }
  assert.equal((html.match(/name="weekday"/g)||[]).length,7);
  assert.ok(!/name="weekday"[^>]*checked/.test(html));
  assert.ok(html.includes('placeholder="3 (proposal; approval required)"'));
  assert.ok(!html.includes('ethics_approved')); assert.ok(html.includes('ESR is unavailable'));
  const frozen=renderToStaticMarkup(React.createElement(ResearchProtocolForm,{...props,study:{...study,status:'ACTIVE'}}));
  assert.match(frozen,/<fieldset disabled=""/); assert.ok(!frozen.includes('Save draft revision'));
});
test('current admin navigation keeps one research page and enforces research read visibility',()=>{
  const visible=renderToStaticMarkup(React.createElement(AdminNav,{profile,current:'research'}));
  assert.equal((visible.match(/href="\/research"/g)||[]).length,1); assert.ok(visible.includes('Research Management'));
  const hidden=renderToStaticMarkup(React.createElement(AdminNav,{profile:{...profile,permissions:['dashboard.view']},current:'dashboard'}));
  assert.ok(!hidden.includes('href="/research"'));
});

test('assessment draft fields have no default limits or delayed interval and preserve older form payloads',()=>{
  const data=new FormData();data.set('delivery.present','1');data.set('delivery.enabled','on');data.set('delivery.version','synthetic-v1');
  const built=contract.buildConfiguration(data,config,[]), draft=built.assessment_delivery_draft;
  assert.equal(draft.version,'synthetic-v1');assert.equal(draft.delayed_follow_up,null);
  assert.deepEqual(Object.keys(draft.stages),['pre_test','immediate_post_test','delayed_retention_test']);
  for(const stage of Object.values(draft.stages)){assert.equal(stage.maximum_attempts,null);assert.equal(stage.timeout_policy,null);assert.equal(stage.assessment_id,null);}
  const retained={...config,assessment_delivery_draft:draft};
  assert.deepEqual(contract.buildConfiguration(new FormData(),retained,[]).assessment_delivery_draft,draft);
  data.delete('delivery.enabled');assert.equal(contract.buildConfiguration(data,retained,[]).assessment_delivery_draft,null);
});

test('assessment draft rejects invalid caps, unpinned references, blank versions and incomplete delay policy',()=>{
  function draft(){const d=new FormData();d.set('delivery.present','1');d.set('delivery.enabled','on');d.set('delivery.version','synthetic-v1');return d;}
  for(const [key,value] of [['delivery.version',' '],['delivery.pre_test.attempts','0'],['delivery.pre_test.attempts','1.2'],['delivery.pre_test.instrument',id],['delivery.delay','1']]){
    const data=draft();data.set(key,value);assert.throws(()=>contract.buildConfiguration(data,config,[]));
  }
  const data=draft();data.set('delivery.follow_up.version','synthetic-v1');data.set('delivery.follow_up.reference','Not approved, test fixture');data.set('delivery.delay','12345');
  const result=contract.buildConfiguration(data,config,[]).assessment_delivery_draft;
  assert.equal(result.delayed_follow_up.minimum_delay_seconds,12345);assert.equal(result.delayed_follow_up.anchor,'immediate_post_test_completion');
});

test('assessment publication stays blocked in actual form with labelled three-stage draft inputs',()=>{
  const html=renderToStaticMarkup(React.createElement(ResearchProtocolForm,{study,conditions:[],instruments:[],disabled:false,onSave:async()=>{},onDirty:()=>{}}));
  for(const label of ['Assessment publication: BLOCKED','Immediate post-test','Delayed retention test','Common blueprint policy','Common difficulty policy','Common scoring policy','Proposed minimum delay (seconds)'])assert.ok(html.includes(label),label);
  assert.match(html,/<button[^>]*disabled=""[^>]*>Publish assessments \(unavailable\)<\/button>/);
  for(const stage of contract.assessmentStages)assert.ok(html.includes(`name="delivery.${stage}.attempts"`));
  assert.ok(!/name="delivery\.delay"[^>]*value="\d/.test(html));
  assert.equal(researchRoute(['studies',id,'publish'],'POST',new URLSearchParams()),null);
  assert.equal(contract.isStudy({...study,assessment_publication:{status:'READY',execution_available:true,blockers:[]}}),false);
});

function reportingFixture(){return {contract_version:'research-reporting-readiness-v1',observed_results_available:false,inferential_statistics_available:false,
  export_status:'BLOCKED',blockers:['approved_questionnaire_missing'],questionnaire:{publication_status:'UNPUBLISHED',collection_available:false,instrument_version:null,response_count:null},
  metrics:Object.keys(reportingContract.metricLabels).map(key=>({key,status:'UNAVAILABLE',value:null,sample_size:null,denominator:null,observation_window:null,instrument_version:null,algorithm_version:null,metric_version:null,reason:'authorized_measurement_unavailable'}))};}

test('reporting readiness rejects invented zeros, target denominators, published instruments and predictions',()=>{
  const good=reportingFixture();assert.equal(reportingContract.isReportingReadiness(good),true);
  assert.equal(contract.isStudy({...study,reporting:good}),true);
  for(const key of ['value','sample_size','denominator','algorithm_version']){
    const invalid=structuredClone(good);invalid.metrics[0][key]=key==='denominator'?30:0;
    assert.equal(reportingContract.isReportingReadiness(invalid),false,key);
  }
  assert.equal(reportingContract.isReportingReadiness({...good,observed_results_available:true}),false);
  assert.equal(reportingContract.isReportingReadiness({...good,questionnaire:{...good.questionnaire,publication_status:'PUBLISHED'}}),false);
});

test('actual monitoring panel discloses unavailable n/denominators/windows and has no active export or response form',()=>{
  const html=renderToStaticMarkup(React.createElement(ResearchReportingPanel,{study:{...study,reporting:reportingFixture()}}));
  for(const text of ['UNPUBLISHED','BLOCKED','N/A means unavailable','Sample size: N/A','Denominator: N/A','Observation window: N/A','not a validated metric'])assert.ok(html.includes(text),text);
  assert.equal((html.match(/Sample size: N\/A/g)||[]).length,18);
  assert.match(html,/<button[^>]*disabled=""[^>]*>Export thesis data \(blocked\)<\/button>/);
  assert.ok(!html.includes('<form'));assert.ok(!html.includes('href='));assert.ok(!html.includes('100%'));
});

test('export allowlist, explicit permission and blocked JSON prevent CSV or formula-payload disclosure',async()=>{
  const params=new URLSearchParams('dataset=reviews');
  assert.equal(researchRoute(['studies',id,'exports'],'GET',params),`${url}/${id}/exports?dataset=reviews`);
  for(const q of ['dataset=raw-voice','dataset=reviews&limit=2','dataset=reviews&dataset=participants',''])assert.equal(researchRoute(['studies',id,'exports'],'GET',new URLSearchParams(q)),null);
  assert.equal(researchRoute(['studies',id,'exports'],'POST',params),null);
  const denied=fixture();assert.equal((await proxyResearchSetup(request('GET',`/${id}/exports?dataset=reviews`),['studies',id,'exports'],denied.deps)).status,403);
  assert.equal(denied.calls.length,1);
  const {deps}=fixture([...profile.permissions,'research.export']);const old=deps.backend;
  deps.backend=async(path,init)=>path==='/me'?old(path,init):Response.json({error:{message:'Dataset blocked'}},{status:409});
  const response=await proxyResearchSetup(request('GET',`/${id}/exports?dataset=reviews`),['studies',id,'exports'],deps);
  assert.equal(response.status,409);assert.equal(response.headers.get('content-disposition'),null);assert.equal(response.headers.get('cache-control'),'no-store');
  deps.backend=async(path,init)=>path==='/me'?old(path,init):new Response('=HYPERLINK("synthetic-only")',{headers:{'Content-Type':'text/csv'}});
  const unsafe=await proxyResearchSetup(request('GET',`/${id}/exports?dataset=reviews`),['studies',id,'exports'],deps);
  assert.equal(unsafe.status,503);assert.ok(!(await unsafe.text()).includes('HYPERLINK'));
});
