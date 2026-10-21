// Real Next.js + isolated browser + synthetic HTTP fixtures only. No application DB/session bypass.
const assert = require('node:assert/strict');
const {createServer} = require('node:http');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {resolve} = require('node:path');
const fs = require('node:fs');
const test = require('node:test');
const {randomUUID} = require('node:crypto');
const {chromium} = require(process.env.FLUENTT_PLAYWRIGHT_MODULE || 'playwright');
const token='s'.repeat(43), csrf='c'.repeat(43), id='6bbd7d97-caa0-4fd0-9000-0121bfdc83a0';
const classId='7bbd7d97-caa0-4fd0-9000-0121bfdc83a0', schedulerId='8bbd7d97-caa0-4fd0-9000-0121bfdc83a0';
let readonly=false, revoked=false, study=null, bindings=[], history=[], writes=[], uncertain=false;
const receipts=new Map(), seen=[];
const configuration={starts_at:null,ends_at:null,timezone:null,active_weekdays:null,protocol_reference:null,consent_document_version:null,consent_requirements:null,allocation_unit:null,allocation_policy:null,due_date_policy:null,conditions:[],assessments:[],declared_evidence:{},administrator_setup:null};
const reporting={contract_version:'research-reporting-readiness-v1',observed_results_available:false,inferential_statistics_available:false,export_status:'BLOCKED',
  questionnaire:{publication_status:'UNPUBLISHED',collection_available:false,instrument_version:null,response_count:null},blockers:['approved_questionnaire_missing','approved_disclosure_and_withdrawal_policy_missing'],
  metrics:['participant_flow','assignment_adherence','review_adherence','pre_test_completion','immediate_post_test_completion','delayed_retention_completion','assessment_results','recall_accuracy','review_count','workload','active_study_duration','study_duration','pronunciation_score','questionnaire_responses','questionnaire_distributions','missing_data','learning_gain','retention'].map(key=>({key,status:'UNAVAILABLE',value:null,sample_size:null,denominator:null,observation_window:null,instrument_version:null,algorithm_version:null,metric_version:null,reason:'authorized_measurement_unavailable'}))};
const api=createServer(async(req,res)=>{
  seen.push(req.url); res.setHeader('Content-Type','application/json');
  if(req.url==='/api/v1/admin/auth/config') return res.end('{"enabled":false}');
  if(!String(req.headers.cookie).includes(`fluentt_admin=${token}`)||revoked){res.writeHead(401);return res.end('{"error":{"message":"Session ended"}}');}
  if(req.url==='/api/v1/admin/me') return res.end(JSON.stringify({username:'SyntheticResearcher',role:'administrator',permissions:['dashboard.view','research.read',...(readonly?[]:['research.manage',`research.classroom.${classId}.manage`])],csrf_token:csrf,expires_at:new Date(Date.now()+600000).toISOString(),absolute_expires_at:new Date(Date.now()+1200000).toISOString()}));
  const base='/api/v1/admin/research-classrooms/studies';
  const url=new URL(req.url,'http://fixture');
  const page=items=>res.end(JSON.stringify({items,limit:25,offset:0,has_more:false}));
  if(!url.pathname.startsWith(base)){res.writeHead(404);return res.end('{}');}
  if(req.method==='POST'){
    let body='';for await(const chunk of req)body+=chunk;
    writes.push({path:url.pathname,body,key:req.headers['idempotency-key'],revision:req.headers['if-match'],csrf:req.headers['x-csrf-token'],origin:req.headers.origin,authorization:req.headers.authorization});
    if(readonly||req.headers['x-csrf-token']!==csrf){res.writeHead(403);return res.end('{"error":{"message":"Permission denied"}}');}
    if(receipts.has(req.headers['idempotency-key']))return res.end(JSON.stringify(receipts.get(req.headers['idempotency-key'])));
    const payload=JSON.parse(body);
    if(url.pathname===base){study={...payload,id,study_id:id,status:'DRAFT',revision:`"${id}:1"`,protocol_id:id,configuration_version:1,configuration_fingerprint:'a'.repeat(64),configuration:{...configuration},activation_blockers:['verified_authorization_missing:ethics','designated_classroom_missing'],reporting};}
    else {
      if(req.headers['if-match']!==study.revision){res.writeHead(412);return res.end('{"error":{"message":"Configuration changed. Refresh before editing."}}');}
      const revision=Number(study.revision.split(':')[1].slice(0,-1))+1;
      study={...study,revision:`"${id}:${revision}"`};
      if(url.pathname.endsWith('/protocols'))study={...study,configuration:payload,configuration_version:study.configuration_version+1};
      if(url.pathname.endsWith('/classrooms')){bindings=[{id:classId,class_id:payload.class_id,scope_id:id,study_id:id}];study.activation_blockers=['verified_authorization_missing:ethics'];}
    }
    const result=JSON.parse(JSON.stringify(study));receipts.set(req.headers['idempotency-key'],result);
    if(url.pathname.endsWith('/protocols'))history.unshift({id:`revision-${study.configuration_version}`,version:study.configuration_version,protocol_version:study.protocol_version,fingerprint:study.configuration_fingerprint,configuration:study.configuration});
    if(uncertain&&url.pathname.endsWith('/protocols')){uncertain=false;res.writeHead(503);return res.end('{"error":{"message":"Synthetic uncertain save outcome"}}');}
    res.writeHead(url.pathname===base?201:200);return res.end(JSON.stringify(result));
  }
  if(url.pathname===base)return page(study?[study]:[]);
  if(url.pathname.endsWith('/choices')){
    const kind=url.searchParams.get('kind');
    return page(kind==='classrooms'?[{id:classId,label:'Synthetic authorized class',language:'english'}]:kind==='conditions'?[{id:schedulerId,label:'sm2',condition:'sm2_control',implementation_version:'sm2-classic-v1',configuration_version:1,selectable:true}]:[]);
  }
  if(url.pathname.endsWith('/classrooms'))return page(bindings);
  if(url.pathname.endsWith('/protocols'))return page(history);
  return res.end(JSON.stringify(study));
});

(async()=>{
  api.listen(0,'127.0.0.1');await once(api,'listening');
  const probe=createServer().listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
  const web=`http://localhost:${port}`, admin=resolve('apps/admin');
  const dist=resolve(admin,'.next',`research-test-${randomUUID()}`);
  fs.mkdirSync(dist,{recursive:true});
  fs.cpSync(resolve(admin,'src'),resolve(dist,'src'),{recursive:true});
  for(const name of ['package.json','tsconfig.json'])fs.copyFileSync(resolve(admin,name),resolve(dist,name));
  const isolatedConfig=fs.readFileSync(resolve(admin,'next.config.ts'),'utf8').replace('root: process.cwd()',`root: ${JSON.stringify(admin)}`);
  fs.writeFileSync(resolve(dist,'next.config.ts'),isolatedConfig);
  const dependencyLink=resolve(dist,'node_modules');
  fs.symlinkSync(resolve(admin,'node_modules'),dependencyLink,process.platform==='win32'?'junction':'dir');
  const server=spawn(process.execPath,[resolve(admin,'node_modules/next/dist/bin/next'),'dev','--port',String(port)],{cwd:dist,windowsHide:true,env:{...process.env,NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',FLUENTT_ADMIN_WEB_ORIGIN:web,FLUENTT_API_URL:`http://127.0.0.1:${api.address().port}`},stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [server.stdout,server.stderr])stream.on('data',bytes=>output=(output+bytes).slice(-16000));
  let browser;
  try{
    let ready=false;
    for(let i=0;i<90;i++){try{ready=(await fetch(web+'/api/admin/config')).ok;}catch{}if(ready)break;if(server.exitCode!==null)throw new Error(output);await new Promise(r=>setTimeout(r,500));}
    assert(ready,'Isolated Next server must start');
    const executable=process.env.FLUENTT_TEST_CHROME_EXECUTABLE || (process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
    browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{})});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addCookies([{name:'fluentt_admin',value:token,url:web,httpOnly:true,sameSite:'Lax'}]);
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('dialog',dialog=>dialog.accept());
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const wait=locator=>locator.waitFor({state:'visible',timeout:45000});
    await test('current Research page authenticates, loads genuine empty state and no legacy analytics',async()=>{
      const response=await page.goto(web+'/research');assert.match(response.headers()['cache-control'],/no-store/);
      await wait(page.getByRole('heading',{name:'Your studies'}));
      await wait(page.getByText('No managed studies on this page.',{exact:false}));
      assert.equal(await page.getByRole('link',{name:'Research Management'}).count(),1);
      assert(!seen.some(p=>p.includes('/research/studies')||p.includes('/analytics')));
    });
    await test('create and attach use explicit draft fields, server revision, exact retry and no bearer credential',async()=>{
      await page.getByRole('button',{name:'Create study draft',exact:true}).click();
      await page.getByLabel('Study code',{exact:true}).fill('SYNTHETIC-BROWSER');
      await page.getByLabel('Study title',{exact:true}).fill('Synthetic browser study');
      await page.getByLabel('Learning language',{exact:true}).selectOption('english');
      await page.getByLabel('Protocol version',{exact:true}).fill('synthetic-unapproved-v1');
      await page.getByLabel('Proposed participant target',{exact:true}).fill('7');
      await page.getByRole('button',{name:'Create draft',exact:true}).click();
      await wait(page.getByRole('heading',{name:'Synthetic browser study',exact:true}));
      await page.getByLabel('Eligible classroom',{exact:true}).selectOption(classId);
      await page.getByRole('button',{name:'Attach classroom',exact:true}).click();
      await wait(page.getByText(`Synthetic authorized class / ${classId}`,{exact:false}));
      assert.equal(writes[0].origin,web);assert.equal(writes[0].csrf,csrf);assert.equal(writes[0].authorization,undefined);
      assert.equal(writes[1].revision,`"${id}:1"`);assert.equal(JSON.parse(writes[1].body).class_id,classId);
    });
    await test('keyboard-accessible form stores proposals; uncertain committed save retries identical bytes and identity',async()=>{
      assert.equal(await page.getByRole('checkbox',{name:'Monday',exact:true}).isChecked(),false);
      await page.getByLabel('Proposed intervention weeks',{exact:true}).fill('3');
      await page.getByLabel('Schedule timezone',{exact:true}).fill('Asia/Manila');
      await page.getByLabel('Daily opens (schedule timezone)',{exact:true}).fill('08:00');
      await page.getByLabel('Daily closes (same day)',{exact:true}).fill('16:00');
      await page.getByLabel('Proposed assessment attempt limit',{exact:true}).fill('2');
      await page.getByLabel('SM-2 condition configuration',{exact:true}).selectOption(schedulerId);
      await page.getByRole('checkbox',{name:'I reviewed these proposed changes',exact:false}).check();
      uncertain=true;
      await page.getByRole('button',{name:'Save draft revision',exact:true}).click();
      await wait(page.getByRole('heading',{name:'Confirm the save outcome',exact:true}));
      await page.getByRole('button',{name:'Retry exact request',exact:true}).click();
      await wait(page.getByText('Configuration revision 2',{exact:true}));
      const saves=writes.filter(w=>w.path.endsWith('/protocols'));
      assert.equal(saves.length,2);assert.equal(saves[0].body,saves[1].body);assert.equal(saves[0].key,saves[1].key);assert.equal(saves[0].revision,saves[1].revision);
      assert.equal(study.configuration.administrator_setup.proposed_intervention_weeks,3);assert.equal(study.configuration.active_weekdays,null);
      await page.getByRole('button',{name:'Overview',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Mark ready',exact:true}).isDisabled(),true);
      assert.equal(await page.getByText('N/A',{exact:true}).count(),2);
      await page.getByRole('button',{name:'Classroom setup',exact:true}).click();
      await page.setViewportSize({width:390,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'No horizontal overflow at 390px');
      const timezone=page.getByLabel('Schedule timezone',{exact:true});await timezone.focus();await page.keyboard.press('Tab');
      assert.notEqual(await page.evaluate(()=>document.activeElement?.tagName),'BODY');
    });
    await test('assessment drafts save explicit stage limits without creating a delay or enabling publication',async()=>{
      await page.getByRole('checkbox',{name:'Save an assessment delivery draft in this revision',exact:true}).check();
      await page.getByLabel('Delivery draft version',{exact:true}).fill('synthetic-assessment-v1');
      await page.getByLabel('Pre-test maximum attempts',{exact:true}).fill('2');
      assert.equal(await page.getByLabel('Proposed minimum delay (seconds)',{exact:true}).inputValue(),'');
      assert.equal(await page.getByRole('button',{name:'Publish assessments (unavailable)',exact:true}).isDisabled(),true);
      await page.getByRole('checkbox',{name:'I reviewed these proposed changes',exact:false}).check();
      await page.getByRole('button',{name:'Save draft revision',exact:true}).click();
      await wait(page.getByText('Configuration revision 3',{exact:true}));
      const plan=study.configuration.assessment_delivery_draft;
      assert.equal(plan.version,'synthetic-assessment-v1');assert.equal(plan.stages.pre_test.maximum_attempts,2);
      assert.equal(plan.stages.immediate_post_test.maximum_attempts,null);assert.equal(plan.delayed_follow_up,null);
      await page.getByRole('button',{name:'Revision history',exact:true}).click();
      await wait(page.getByText('Revision 3 / synthetic-unapproved-v1',{exact:true}));
      assert.equal(writes.filter(w=>!w.path.endsWith('/protocols')&&!w.path.endsWith('/classrooms')&&!w.path.endsWith('/studies')).length,0);
      await page.getByRole('button',{name:'Classroom setup',exact:true}).click();
      assert.equal(await page.getByLabel('Delivery draft version',{exact:true}).inputValue(),'synthetic-assessment-v1');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    });
    await test('monitoring shows unpublished questionnaire, unavailable denominators and blocked exports at both sizes',async()=>{
      await page.getByRole('button',{name:'Monitoring',exact:true}).click();
      const panel=page.getByRole('region',{name:'Research monitoring and disclosure readiness'});
      await wait(panel);assert.equal(await panel.getByText('UNPUBLISHED',{exact:true}).count(),1);
      assert.equal(await panel.getByText('Sample size: N/A',{exact:false}).count(),18);
      assert.equal(await panel.getByRole('button',{name:'Export thesis data (blocked)',exact:true}).isDisabled(),true);
      assert(!seen.some(p=>/\/analytics|\.csv|\/questionnaires/.test(p)));
      const folder=resolve(process.env.FLUENTT_RESEARCH_QA_OUTPUT || 'output/research-reporting');fs.mkdirSync(folder,{recursive:true});
      const prefix=process.env.FLUENTT_RESEARCH_QA_PREFIX || 'prompt07';
      await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:resolve(folder,`${prefix}-monitoring-desktop.png`),fullPage:true});
      await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(folder,`${prefix}-monitoring-narrow.png`),fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
      await page.getByRole('button',{name:'Classroom setup',exact:true}).click();
    });
    await test('live privilege changes disable editing, and session revocation clears protected study data',async()=>{
      readonly=true;await page.getByRole('button',{name:'Refresh and verify access',exact:true}).click();
      await wait(page.getByRole('heading',{name:'Synthetic browser study',exact:true}));
      assert.equal(await page.getByRole('button',{name:'Create study draft',exact:true}).count(),0);
      assert.equal(await page.getByLabel('Schedule timezone',{exact:true}).isDisabled(),true);
      revoked=true;await page.getByRole('button',{name:'Refresh and verify access',exact:true}).click();
      await page.waitForURL(/\/login/, {timeout:45000});
      assert.equal(await page.getByText('Synthetic browser study',{exact:true}).count(),0);
      assert.deepEqual(errors,[]);
    });
  }finally{
    await browser?.close();server.kill();await Promise.race([once(server,'exit'),new Promise(r=>setTimeout(r,5000))]);
    await new Promise(r=>api.close(r));
    assert(dist.startsWith(resolve(admin,'.next')+require('node:path').sep) && /^research-test-[0-9a-f-]{36}$/.test(require('node:path').basename(dist)));
    assert(fs.lstatSync(dependencyLink).isSymbolicLink());
    fs.unlinkSync(dependencyLink); // Remove only the junction; never recurse into real dependencies.
    fs.rmSync(dist,{recursive:true,force:true,maxRetries:3,retryDelay:100});
  }
})().catch(error=>{console.error(error);if(api.listening)api.close();process.exitCode=1;});
