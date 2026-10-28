import {ApiError,request} from './client';
import type {AudioUploadPayload,PronunciationActivityView} from './pronunciation';
export const WAVLM_CONSENT='local-wavlm-audio-and-results-v1';
export const WAVLM_MODEL='Jianshu001/wavlm-phoneme-scorer';
export const WAVLM_REVISION='19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da';
export type WavLMCapability={available:boolean;reason:string;model_id:string;model_version:string;consent_version:string;maximum_duration_ms:number;loaded:boolean;server_side:true;validation_status:'unvalidated_model_prediction'};
export type WavLMPhone={phone:string;score:number;pherr_prob:number;error:boolean;tip:string|null};
export type WavLMScore={status:'scored';contract_version:'wavlm-english-read-aloud-v1';assessment_id:string;activity_id:string;activity_version:number;expected_text:string;
  assessed_language:'english';attempted_at:string;attempt_number:number;overall_score:number;n_errors:number;words:{word:string;score:number;phonemes:WavLMPhone[]}[];
  duration_ms:number;processing_duration_ms:number;initialization_ms:number;model_id:string;model_version:string;simulated:false;validation_status:'unvalidated_model_prediction';feedback:string};
export type WavLMClassPage={items:{assessment_id:string;student_id:string;username:string;activity_id:string;overall_score:number;attempted_at:string;model_version:string;validation_status:'unvalidated_model_prediction'}[];offset:number;has_more:boolean;scope:'current-eligible-ordinary-classroom';metric_version:'wavlm-english-read-aloud-v1'};
export type WavLMAccess={capabilities:(language:string)=>Promise<WavLMCapability>;assess:(activity:PronunciationActivityView,audio:AudioUploadPayload,key:string,duration:number,classId?:string)=>Promise<WavLMScore>;
  classAttempts:(classId:string,offset?:number)=>Promise<WavLMClassPage>;
  history:(activityId:string,offset?:number,classId?:string)=>Promise<WavLMScore[]>};
const validNumber=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
export function validateWavLM(value:WavLMScore,activityId?:string):WavLMScore{
  if(!value||value.status!=='scored'||value.contract_version!=='wavlm-english-read-aloud-v1'||value.model_id!==WAVLM_MODEL||value.model_version!==WAVLM_REVISION
    ||value.simulated!==false||value.validation_status!=='unvalidated_model_prediction'||value.assessed_language!=='english'
    ||typeof value.assessment_id!=='string'||typeof value.activity_id!=='string'||(activityId&&value.activity_id!==activityId)||typeof value.expected_text!=='string'
    ||!Number.isFinite(Date.parse(value.attempted_at))||!Number.isInteger(value.attempt_number)||value.attempt_number<1
    ||!validNumber(value.overall_score,0,100)||!validNumber(value.duration_ms,500,30000)||!validNumber(value.processing_duration_ms,0,180000)||!validNumber(value.initialization_ms,0,180000)
    ||!Array.isArray(value.words)||value.words.length<1||value.words.length>60)throw new ApiError(0,'No complete WavLM assessment was returned. No score is available.');
  let errors=0,total=0;
  for(const word of value.words){
    if(typeof word.word!=='string'||!word.word||!validNumber(word.score,0,100)||!Array.isArray(word.phonemes)||!word.phonemes.length||word.phonemes.length>100)throw new ApiError(0,'Incomplete word alignment.');
    for(const phone of word.phonemes){total++;if(!/^[a-z]{1,3}$/.test(phone.phone)||!validNumber(phone.score,0,100)||!validNumber(phone.pherr_prob,0,1)||typeof phone.error!=='boolean'||phone.error!==(phone.pherr_prob>=.70)||(phone.tip!==null&&typeof phone.tip!=='string'))throw new ApiError(0,'Incomplete phoneme feedback.');if(phone.error)errors++;}
  }
  if(total>600||value.n_errors!==errors)throw new ApiError(0,'Inconsistent model feedback.');
  return value;
}
export function wavlmAccess(run:<T>(operation:(secret:string)=>Promise<T>)=>Promise<T>):WavLMAccess{
  return {
    classAttempts:(classId,offset=0)=>run(async secret=>{
      const value=await request<WavLMClassPage>(`/me/pronunciation/classes/${encodeURIComponent(classId)}/attempts?offset=${offset}&limit=20`,'GET',undefined,secret);
      if(!value||value.scope!=='current-eligible-ordinary-classroom'||value.metric_version!=='wavlm-english-read-aloud-v1'||!Array.isArray(value.items)||value.items.length>20||typeof value.has_more!=='boolean'||value.offset!==offset||value.items.some(row=>!row||typeof row.username!=='string'||typeof row.student_id!=='string'||!validNumber(row.overall_score,0,100)||row.model_version!==WAVLM_REVISION||row.validation_status!=='unvalidated_model_prediction'||!Number.isFinite(Date.parse(row.attempted_at))))throw new ApiError(0,'Class pronunciation records could not be verified.');
      return value;
    }),
    capabilities:language=>run(async secret=>{
      const value=await request<WavLMCapability>(`/me/pronunciation/capabilities?language=${encodeURIComponent(language)}`,'GET',undefined,secret);
      if(!value||typeof value.available!=='boolean'||value.available!==(value.reason==='ready')||value.model_id!==WAVLM_MODEL||value.model_version!==WAVLM_REVISION||value.consent_version!==WAVLM_CONSENT||value.maximum_duration_ms!==30000||value.server_side!==true||typeof value.loaded!=='boolean'||value.validation_status!=='unvalidated_model_prediction')throw new ApiError(0,'Unable to verify WavLM availability.');
      return value;
    }),
    assess:(activity,audio,key,duration,classId)=>run(async secret=>{
      const form=new FormData();form.append('activity_id',activity.id);form.append('activity_version',String(activity.version));form.append('assessment_engine','wavlm');form.append('request_id',key);form.append('consent_version',WAVLM_CONSENT);form.append('duration_ms',String(Math.round(duration)));
      if(classId){form.append('class_id',classId);form.append('context_type','classroom');}
      if(typeof Blob!=='undefined'&&audio instanceof Blob)form.append('audio_file',audio,'recording.audio');else form.append('audio_file',audio as unknown as Blob);
      const value=validateWavLM(await request<WavLMScore>('/me/pronunciation/attempts','POST',form,secret,{},190000),activity.id);
      if(value.activity_version!==activity.version)throw new ApiError(0,'The phrase changed. Refresh before recording again.');return value;
    }),
    history:(activityId,offset=0,classId)=>run(async secret=>{
      const query=new URLSearchParams({assessment_engine:'wavlm',activity_id:activityId,offset:String(offset),limit:'20'});
      if(classId){query.set('class_id',classId);query.set('context_type','classroom');}
      const values=await request<WavLMScore[]>(`/me/pronunciation/attempts?${query}`,'GET',undefined,secret);
      if(!Array.isArray(values)||values.length>20)throw new ApiError(0,'Pronunciation history is unavailable.');return values.map(value=>validateWavLM(value,activityId));
    })
  };
}
