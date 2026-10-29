import test from 'node:test';
import assert from 'node:assert/strict';
import {wholePhraseApi,validateWholePhraseScore} from '../apps/mobile/src/services/api/wholePhrase.ts';
const activity={id:'synthetic-phrase',version:3,language:'english',target_text:'Synthetic sentence.'};
const score={status:'scored',activity_id:activity.id,activity_version:3,overall_score:37.5,accuracy_score:91,fluency_score:82,completeness_score:75,duration_ms:1000,provider:'azure-speech',locale:'en-US',contract_version:'whole-phrase-azure-rest-v1',model_version:null,simulated:false};

test('score contract rejects simulated, stale, partial and nonfinite results',()=>{
  assert.equal(validateWholePhraseScore(score,activity).overall_score,37.5);
  for(const patch of [{simulated:true},{activity_id:'another'},{activity_version:4},{overall_score:NaN},{overall_score:101},{fluency_score:null},{duration_ms:30001},{model_version:'invented'}])
    assert.throws(()=>validateWholePhraseScore({...score,...patch},activity),/No verified/);
});

test('whole-phrase client sends one WAV and exact activity/permission, never a client score or transcript',async()=>{
  const previous=global.fetch,base=process.env.EXPO_PUBLIC_API_URL,calls=[];
  process.env.EXPO_PUBLIC_API_URL='http://synthetic-api.invalid';
  global.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>score};};
  try{
    const audio=new Blob(['SYNTHETIC-QA-AUDIO'],{type:'audio/wav'});
    await wholePhraseApi.assess('SYNTHETIC-DEVICE-CREDENTIAL',activity,audio);
    assert.equal(calls.length,1);const {url,options}=calls[0];
    assert.equal(url,'http://synthetic-api.invalid/api/v1/me/pronunciation/whole-phrase/assess');
    assert.equal(options.headers.Authorization,'Bearer SYNTHETIC-DEVICE-CREDENTIAL');
    assert.equal(options.body.get('activity_version'),'3');assert.equal(options.body.get('cloud_consent_version'),'azure-whole-phrase-audio-v1');
    assert.equal(await options.body.get('audio_file').text(),'SYNTHETIC-QA-AUDIO');
    assert.equal(options.body.has('score'),false);assert.equal(options.body.has('transcript'),false);assert.equal(options.body.has('duration_ms'),false);
  }finally{global.fetch=previous;if(base===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=base;}
});

test('network errors are not automatically retried or converted into grades',async()=>{
  const previous=global.fetch,base=process.env.EXPO_PUBLIC_API_URL;let calls=0;
  process.env.EXPO_PUBLIC_API_URL='http://synthetic-api.invalid';global.fetch=async()=>{calls++;throw new Error('synthetic offline');};
  try{await assert.rejects(wholePhraseApi.assess('synthetic',activity,new Blob(['qa'])));assert.equal(calls,1);}
  finally{global.fetch=previous;if(base===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=base;}
});
