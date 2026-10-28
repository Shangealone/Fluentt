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
