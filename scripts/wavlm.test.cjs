// Synthetic model/API fixtures only. No microphone, trained-model inference or human results.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../apps/mobile'),local=Module.createRequire(path.join(root,'package.json'));
const React=local('react'),babel=local('@babel/core'),original=Module._load;
Module._load=function(name,parent,main){
  if(name==='react-native')return {...local('react-native-web'),AppState:{addEventListener(){return{remove(){}};}}};
  if(name==='react-native-safe-area-context')return{SafeAreaView:local('react-native-web').View};
  if(name==='expo-router')return{useFocusEffect(){}};
  if(name==='expo-crypto')return{randomUUID:()=> '00000000-0000-0000-0000-000000000001'};
  if(name==='./useAudioRecorder')return{useAudioRecorder(){throw Error('A renderer must never start recording');}};
  if(name==='../learning/useLessonSpeech')return{useLessonSpeech(){return{};}};
  return original.call(this,name,parent,main);
};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(module,file)=>module._compile(babel.transformSync(fs.readFileSync(file,'utf8'),{filename:file,babelrc:false,configFile:false,plugins:[
  [local.resolve('@babel/plugin-transform-typescript'),{isTSX:ext==='.tsx',allExtensions:true}],[local.resolve('@babel/plugin-transform-react-jsx'),{runtime:'automatic'}],local.resolve('@babel/plugin-transform-modules-commonjs')]}).code,file);
const {validateWavLM,wavlmAccess,WAVLM_MODEL,WAVLM_REVISION}=local(path.join(root,'src/services/api/wavlm.ts'));
const {WavLMResult,WavLMPracticeOption}=local(path.join(root,'src/features/pronunciation/WavLMPractice.tsx'));
const {ClassPronunciationSummary}=local(path.join(root,'src/features/pronunciation/ClassPronunciationSummary.tsx'));
const {renderToStaticMarkup:render}=local('react-dom/server');
const id='00000000-0000-0000-0000-000000000001';
function fixture(){return{status:'scored',contract_version:'wavlm-english-read-aloud-v1',assessment_id:id,activity_id:id,activity_version:1,expected_text:'The.',assessed_language:'english',attempted_at:'2026-10-28T00:00:00Z',attempt_number:1,overall_score:24.5,n_errors:1,
  words:[{word:'The',score:24.5,phonemes:[{phone:'dh',score:24.5,pherr_prob:.8,error:true,tip:'Practise voiced TH.'}]}],duration_ms:1000,processing_duration_ms:123,initialization_ms:456,model_id:WAVLM_MODEL,model_version:WAVLM_REVISION,simulated:false,validation_status:'unvalidated_model_prediction',feedback:'Unvalidated model feedback.'};}
test('client rejects fabricated provenance, invalid numbers and partial phone feedback',()=>{
  assert.equal(validateWavLM(fixture()).overall_score,24.5);
  for(const change of [{simulated:true},{model_version:'unknown'},{overall_score:NaN},{overall_score:101},{words:[]},{n_errors:0},{assessed_language:'tagalog'}])assert.throws(()=>validateWavLM({...fixture(),...change}));
});
test('actual result UI preserves low scores and labels uncertainty rather than inventing fluency',()=>{
  const html=render(React.createElement(WavLMResult,{result:fixture()}));
  assert(html.includes('24.5')&&html.includes('Possible difficulty')&&html.includes('not calibrated certainty'));
  assert(!html.includes('Fluency score')&&!html.includes('75 / 100'));
});
test('preview and Tagalog have no live assessment or hidden recording',()=>{
  for(const language of ['english','tagalog']){
    const html=render(React.createElement(WavLMPracticeOption,{activity:{id,language,version:1,target_text:'The.'},api:{}},React.createElement('p',null,'Existing practice')));
    assert(html.includes('Existing practice'));
    assert(html.includes(language==='english'?'Demo mode has no live model':'Tagalog acoustic scoring is unsupported'));
    assert(!html.includes('Use WavLM assessment'));
  }
  const teacher=render(React.createElement(ClassPronunciationSummary,{classId:id}));assert(teacher.includes('not connected in demo mode'));
});
test('authenticated upload uses the existing endpoint, exact retry identity and trusted activity reference',async()=>{
  process.env.EXPO_PUBLIC_API_URL='http://synthetic.invalid';const calls=[];
  global.fetch=async(url,options)=>{calls.push({url,options});return Response.json(fixture());};
  const api=wavlmAccess(operation=>operation('SYNTHETIC-SESSION'));
  await api.assess({id,version:1,target_text:'Client reference must not be sent'},new Blob(['synthetic bytes']),id,999,id);
  assert.equal(calls.length,1);assert(calls[0].url.endsWith('/api/v1/me/pronunciation/attempts'));
  const form=calls[0].options.body;assert.equal(form.get('request_id'),id);assert.equal(form.get('activity_id'),id);assert.equal(form.get('assessment_engine'),'wavlm');assert.equal(form.get('expected_text'),null);assert.equal(form.get('class_id'),id);
});

const {AutomaticAssessment}=local(path.join(root,'src/features/pronunciation/automaticAssessment.ts'));
const {pronunciationFeedback}=local(path.join(root,'src/features/pronunciation/feedback.ts'));
const {validateMMS,mmsAccess,selectSpeechAccess,MMS_MODEL,MMS_REVISION}=local(path.join(root,'src/services/api/mms.ts'));
const {MMSResultView}=local(path.join(root,'src/features/pronunciation/WavLMPractice.tsx'));
function mmsFixture(){return{status:'transcribed',contract_version:'mms-tgl-transcription-comparison-v1',assessment_id:id,activity_id:id,
  activity_version:1,expected_text:'Magandang umaga!',assessed_language:'tagalog',attempted_at:'2026-10-30T00:00:00Z',attempt_number:1,
  transcript:'magandang umaga',confidence:null,confidence_status:'unavailable_uncalibrated',pronunciation_scoring:'unavailable',overall_score:null,
  comparison:{normalization_version:'tagalog-nfc-casefold-punctuation-v1',normalized_reference:'magandang umaga',normalized_transcript:'magandang umaga',exact_match:true,
    differences:[{kind:'equal',reference:['magandang','umaga'],recognized:['magandang','umaga']}]},
  duration_ms:1000,processing_duration_ms:123,initialization_ms:456,model_id:MMS_MODEL,model_version:MMS_REVISION,adapter:'tgl',simulated:false,
  validation_status:'unvalidated_asr_prediction',feedback:'Synthetic ASR fixture only.'};}
test('language selection routes English and Tagalog to distinct actual model adapters',()=>{
 const english={},tagalog={};assert.equal(selectSpeechAccess({wavlm:english,mms:tagalog},'english'),english);
 assert.equal(selectSpeechAccess({wavlm:english,mms:tagalog},'tagalog'),tagalog);
 assert.equal(selectSpeechAccess({wavlm:english,mms:tagalog},'unsupported'),undefined);
 assert.equal(selectSpeechAccess({},'tagalog'),undefined);
});
test('Tagalog rejects fabricated pronunciation scores and confidence',()=>{
 assert.equal(validateMMS(mmsFixture()).overall_score,null);
 for(const change of [{overall_score:100},{confidence:.9},{simulated:true},{adapter:'eng'},{status:'scored'},{pronunciation_scoring:'validated'},{transcript:''}]){
  assert.throws(()=>validateMMS({...mmsFixture(),...change}));
 }
 assert.throws(()=>validateMMS({...mmsFixture(),comparison:{...mmsFixture().comparison,differences:[]}}));
});
test('Tagalog UI presents recognized words and uncertainty without a percentage',()=>{
 const html=render(React.createElement(MMSResultView,{result:mmsFixture()}));
 assert(html.includes('Recognized speech')&&html.includes('Not a pronunciation score')&&html.includes('Confidence is unavailable'));
 assert(!html.includes('/ 100')&&!html.includes('100%')&&!html.includes('Possible difficulty'));
});
test('MMS upload uses trusted phrase ID, exact retry key and no client reference or score',async()=>{
 const calls=[];global.fetch=async(url,options)=>{calls.push({url,options});return Response.json(mmsFixture());};
 const api=mmsAccess(operation=>operation('SYNTHETIC-SESSION'));
 await api.assess({id,version:1,language:'tagalog',target_text:'Untrusted reference'},new Blob(['synthetic']),id,999);
 assert.equal(calls.length,1);const form=calls[0].options.body;
 assert.equal(form.get('assessment_engine'),'mms');assert.equal(form.get('request_id'),id);
 assert.equal(form.get('expected_text'),null);assert.equal(form.get('score'),null);
 await assert.rejects(()=>api.assess({id,version:1,language:'english'},new Blob(['synthetic']),id,999));
 assert.equal(calls.length,1);
});
test('MMS history preserves transcript-only contract and rejects cross-language responses',async()=>{
 const api=mmsAccess(operation=>operation('SYNTHETIC-SESSION'));
 global.fetch=async()=>Response.json([mmsFixture()]);
 assert.equal((await api.history(id))[0].overall_score,null);
 global.fetch=async()=>Response.json([fixture()]);
 await assert.rejects(()=>api.history(id));
});
test('finished recording triggers one consented assessment; errors never auto-retry',()=>{
 const coordinator=new AutomaticAssessment(),audio={synthetic:true};
 assert.equal(coordinator.consume('recorded',audio,true),false);
 coordinator.arm();assert.equal(coordinator.consume('recording',null,true),false);
 assert.equal(coordinator.consume('recorded',audio,false),false);
 assert.equal(coordinator.consume('recorded',audio,true),true);
 assert.equal(coordinator.consume('recorded',audio,true),false);
 assert.equal(coordinator.consume('playing',audio,true),false);
 coordinator.arm();coordinator.cancel();assert.equal(coordinator.consume('recorded',audio,true),false);
 coordinator.arm();assert.equal(coordinator.consume('recorded',audio,true),true);
});
test('feedback uses only model-flagged phonemes and does not promise perfect speech',()=>{
 const result=fixture();const advice=pronunciationFeedback(result);
 assert.equal(advice.tips[0].phone,'dh');assert.match(advice.summary,/1 sound occurrence/);
 result.words[0].phonemes[0].error=false;result.n_errors=0;
 const clear=pronunciationFeedback(result);assert.equal(clear.tips.length,0);assert.match(clear.summary,/does not prove perfect/);
 const html=render(React.createElement(WavLMResult,{result:fixture()}));assert(html.includes('What to practise next'));
});
