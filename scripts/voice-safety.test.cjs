// In-memory demo/client safety fixtures; no microphone, model or real learner data.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../apps/mobile'),local=Module.createRequire(path.join(root,'package.json')),ts=local('typescript');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
const {createDemoPronunciationApi}=local(path.join(root,'src/demo/demoData.ts'));
const {withoutLegacyRating}=local(path.join(root,'src/services/api/pronunciation.ts'));

test('demo English and Tagalog cannot synthesize transcripts or pronunciation ratings',async()=>{
  const api=createDemoPronunciationApi();
  const {activities}=await api.activities();
  for(const activity of activities){
    await assert.rejects(api.submitAttempt(activity.id,new Blob(['invalid']),1000),/cannot transcribe or assess/);
    await assert.rejects(api.transcribe('missing'),/No transcript was generated/);
    for(const result of [await api.evaluate('missing'),await api.getAssessment('missing')]){
      assert.equal(result.score,null);assert.equal(result.assessment,null);
      assert.equal(result.pronunciation_scoring,'unavailable');assert.equal(result.transcription,null);
    }
  }
  assert.deepEqual(await api.attempts(),[]);
});

test('legacy compatibility masks nested ratings, flat aliases and diagnostic feedback',()=>{
  for(const language of ['tagalog','tl','fil','filipino','english']){
    const old={language,score:99,overall_score:98,accuracy_score:97,pronunciation_score:99,
      confidence:.99,phonemes:[{score:98}],words:[{accuracy_score:97}],assessment:{overall_score:99},
      feedback:'99/100 mispronounced phoneme',message:'Score: 99/100',scoring_status:'scored'};
    const value=withoutLegacyRating(old);
    assert.equal(value.score,null);assert.equal(value.assessment,null);
    assert.equal(value.pronunciation_scoring,'unavailable');assert.equal(value.scoring_status,'unsupported');
    for(const key of ['overall_score','accuracy_score','pronunciation_score','phonemes','words','confidence'])assert.equal(value[key],undefined);
    assert(!value.message.includes('99'));assert(!value.feedback.includes('mispronounced'));
    assert.equal(old.score,99); // No mutation of retained evidence.
  }
});
