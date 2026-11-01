import {ApiError, request} from './client.ts';
import type {AudioUploadPayload, PronunciationActivityView} from './pronunciation';
import type {WavLMAccess, WavLMCapability, WavLMScore} from './wavlm';

export const MMS_MODEL='facebook/mms-1b-all';
export const MMS_REVISION='3d33597edbdaaba14a8e858e2c8caa76e3cec0cd';
export const MMS_CONSENT='local-mms-audio-and-transcript-v1';
export type MMSCapability=Omit<WavLMCapability,'validation_status'> & {
  validation_status:'unvalidated_asr_prediction';adapter:'tgl';pronunciation_scoring:'unavailable';
};
export type MMSResult={
  status:'transcribed';contract_version:'mms-tgl-transcription-comparison-v1';assessment_id:string;activity_id:string;
  activity_version:number;expected_text:string;assessed_language:'tagalog';attempted_at:string;attempt_number:number;
  transcript:string;confidence:null;confidence_status:'unavailable_uncalibrated';pronunciation_scoring:'unavailable';overall_score:null;
  comparison:{normalization_version:'tagalog-nfc-casefold-punctuation-v1';normalized_reference:string;normalized_transcript:string;
    exact_match:boolean;differences:{kind:'equal'|'replace'|'delete'|'insert';reference:string[];recognized:string[]}[]};
  duration_ms:number;processing_duration_ms:number;initialization_ms:number;model_id:string;model_version:string;
  adapter:'tgl';simulated:false;validation_status:'unvalidated_asr_prediction';feedback:string;
};
export type SpeechResult=WavLMScore|MMSResult;
export type SpeechAccess={
  capabilities:(language:string)=>Promise<WavLMCapability|MMSCapability>;
  assess:(activity:PronunciationActivityView,audio:AudioUploadPayload,key:string,duration:number,classId?:string)=>Promise<SpeechResult>;
  history:(activityId:string,offset?:number,classId?:string)=>Promise<SpeechResult[]>;
};
export function selectSpeechAccess(api:{wavlm?:WavLMAccess;mms?:SpeechAccess},language:string):SpeechAccess|undefined{
  return language==='english'?api.wavlm:language==='tagalog'?api.mms:undefined;
}
const finite=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
export function validateMMS(value:MMSResult,activityId?:string):MMSResult{
  if(!value||value.status!=='transcribed'||value.contract_version!=='mms-tgl-transcription-comparison-v1'
    ||value.model_id!==MMS_MODEL||value.model_version!==MMS_REVISION||value.adapter!=='tgl'||value.assessed_language!=='tagalog'
    ||value.simulated!==false||value.validation_status!=='unvalidated_asr_prediction'||value.pronunciation_scoring!=='unavailable'
    ||value.overall_score!==null||value.confidence!==null||value.confidence_status!=='unavailable_uncalibrated'
    ||typeof value.assessment_id!=='string'||typeof value.activity_id!=='string'||(activityId&&activityId!==value.activity_id)
    ||!Number.isInteger(value.activity_version)||value.activity_version<1||!Number.isInteger(value.attempt_number)||value.attempt_number<1
    ||!Number.isFinite(Date.parse(value.attempted_at))||typeof value.expected_text!=='string'||!value.expected_text||value.expected_text.length>500
    ||typeof value.transcript!=='string'||!value.transcript.trim()||value.transcript.length>2000||typeof value.feedback!=='string'
    ||!finite(value.duration_ms,500,30000)||!finite(value.initialization_ms,0,300000)||!finite(value.processing_duration_ms,0,300000)){
    throw new ApiError(0,'No complete Tagalog transcription was returned. No pronunciation score is available.');
  }
  const comparison=value.comparison;
  if(!comparison||comparison.normalization_version!=='tagalog-nfc-casefold-punctuation-v1'
    ||typeof comparison.normalized_reference!=='string'||!comparison.normalized_reference||comparison.normalized_reference.length>1000
    ||typeof comparison.normalized_transcript!=='string'||!comparison.normalized_transcript||comparison.normalized_transcript.length>4000
    ||comparison.exact_match!==(comparison.normalized_reference===comparison.normalized_transcript)
    ||!Array.isArray(comparison.differences)||!comparison.differences.length||comparison.differences.length>400
    ||comparison.differences.some(row=>!row||!['equal','replace','delete','insert'].includes(row.kind)
      ||!Array.isArray(row.reference)||!Array.isArray(row.recognized)
      ||[...row.reference,...row.recognized].some(word=>typeof word!=='string'||!word||word.length>2000))
    ||comparison.differences.flatMap(row=>row.reference).join(' ')!==comparison.normalized_reference
    ||comparison.differences.flatMap(row=>row.recognized).join(' ')!==comparison.normalized_transcript){
    throw new ApiError(0,'The Tagalog word comparison could not be verified.');
  }
  return value;
}
export function mmsAccess(run:<T>(operation:(secret:string)=>Promise<T>)=>Promise<T>):SpeechAccess{
  return {
    capabilities:language=>run(async secret=>{
      const value=await request<MMSCapability>(`/me/pronunciation/capabilities?assessment_engine=mms&language=${encodeURIComponent(language)}`,'GET',undefined,secret);
      if(!value||typeof value.available!=='boolean'||value.available!==(value.reason==='ready')||value.model_id!==MMS_MODEL
        ||value.model_version!==MMS_REVISION||value.consent_version!==MMS_CONSENT||value.maximum_duration_ms!==30000
        ||value.server_side!==true||typeof value.loaded!=='boolean'||value.validation_status!=='unvalidated_asr_prediction'
        ||value.adapter!=='tgl'||value.pronunciation_scoring!=='unavailable')throw new ApiError(0,'Unable to verify Tagalog transcription availability.');
      return value;
    }),
    assess:(activity,audio,key,duration,classId)=>run(async secret=>{
      if(activity.language!=='tagalog')throw new ApiError(0,'Use the English WavLM assessment for this phrase.');
      const form=new FormData();
      form.append('activity_id',activity.id);form.append('activity_version',String(activity.version));form.append('assessment_engine','mms');
      form.append('request_id',key);form.append('consent_version',MMS_CONSENT);form.append('duration_ms',String(Math.round(duration)));
      if(classId){form.append('class_id',classId);form.append('context_type','classroom');}
      if(typeof Blob!=='undefined'&&audio instanceof Blob)form.append('audio_file',audio,'recording.audio');else form.append('audio_file',audio as unknown as Blob);
      const value=validateMMS(await request<MMSResult>('/me/pronunciation/attempts','POST',form,secret,{},310000),activity.id);
      if(value.activity_version!==activity.version)throw new ApiError(0,'The phrase changed. Refresh before recording again.');
      return value;
    }),
    history:(activityId,offset=0,classId)=>run(async secret=>{
      const query=new URLSearchParams({assessment_engine:'mms',activity_id:activityId,offset:String(offset),limit:'20'});
      if(classId){query.set('class_id',classId);query.set('context_type','classroom');}
      const values=await request<MMSResult[]>(`/me/pronunciation/attempts?${query}`,'GET',undefined,secret);
      if(!Array.isArray(values)||values.length>20)throw new ApiError(0,'Tagalog transcription history is unavailable.');
      return values.map(value=>validateMMS(value,activityId));
    }),
  };
}
