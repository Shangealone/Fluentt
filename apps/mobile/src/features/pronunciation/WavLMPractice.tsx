import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {AppState,Pressable,Text,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {randomUUID} from 'expo-crypto';
import {Button,ErrorMessage} from '../../components/ui';
import {p,pc} from '../../theme/personal';
import type {PronunciationAccess,PronunciationActivityView} from '../../services/api/pronunciation';
import type {EnrollmentAccess,Membership} from '../../services/api/enrollment';
import type {WavLMCapability,WavLMScore} from '../../services/api/wavlm';
import {selectSpeechAccess,type SpeechAccess,type SpeechResult,type MMSCapability,type MMSResult} from '../../services/api/mms';
import {useAudioRecorder} from './useAudioRecorder';
import {AutomaticAssessment} from './automaticAssessment';
import {pronunciationFeedback} from './feedback';
import {useLessonSpeech} from '../learning/useLessonSpeech';

export function WavLMResult({result}:{result:WavLMScore}){
  const practice=pronunciationFeedback(result);
  return <View style={p.card} accessibilityLiveRegion="polite"><Text style={p.eyebrow}>WavLM · English · Model prediction</Text>
    <Text accessibilityRole="header" style={p.heading}>Pronunciation practice feedback</Text><Text style={p.metricValue}>{result.overall_score.toFixed(1)} / 100</Text>
    <Text style={p.body}>{result.feedback}</Text>
    <View style={p.note}><Text accessibilityRole="header" style={p.heading}>What to practise next</Text><Text style={p.body}>{practice.summary}</Text>
      {practice.tips.map(phone=><Text key={phone.phone} style={p.body}>/{phone.phone}/ in “{phone.word}”: {phone.tip??'Listen to the reference and practise this sound slowly.'}</Text>)}
    </View>
    {result.words.map((word,i)=><View key={i} style={[p.note,{backgroundColor:word.phonemes.some(phone=>phone.error)?pc.rose:pc.background}]}>
      <Text style={p.heading}>{word.word} · {word.score.toFixed(1)}</Text>
      <Text style={p.caption}>{word.phonemes.map(phone=>`/${phone.phone}/ ${phone.score.toFixed(1)}${phone.error?' · practise':''}`).join('   ')}</Text>
      {word.phonemes.filter(phone=>phone.error).map((phone,j)=><Text key={j} style={p.body}>Possible difficulty with /{phone.phone}/ · {phone.tip} Model error output: {phone.pherr_prob.toFixed(2)}; this is not calibrated certainty for your accent.</Text>)}
    </View>)}
    <Text style={p.caption}>Attempt {result.attempt_number} · {new Date(result.attempted_at).toLocaleString()} · Inference {result.processing_duration_ms} ms · Initialization {result.initialization_ms} ms. Trained on children’s English; not validated for Filipino-accented English. Not a grade, diagnosis or research outcome.</Text>
    <Text style={p.caption}>Model {result.model_id} · {result.model_version.slice(0,12)}</Text>
  </View>;
}

export function MMSResultView({result}:{result:MMSResult}){
  return <View style={p.card} accessibilityLiveRegion="polite">
    <Text style={p.eyebrow}>MMS · Tagalog transcription · Not a pronunciation score</Text>
    <Text accessibilityRole="header" style={p.heading}>Recognized speech</Text><Text style={p.body}>{result.transcript}</Text>
    <Text style={p.heading}>Reference</Text><Text style={p.body}>{result.expected_text}</Text>
    <Text style={p.body}>{result.comparison.exact_match?'The normalized words match. This does not prove correct pronunciation.':'The recognized words differ. This may reflect recognition errors or different spoken words.'}</Text>
    {result.comparison.differences.filter(row=>row.kind!=='equal').map((row,index)=><View key={index} style={p.note}>
      <Text style={p.body}>Reference: {row.reference.join(' ')||'(no word)'}</Text>
      <Text style={p.body}>Recognized: {row.recognized.join(' ')||'(not recognized)'}</Text>
    </View>)}
    <Text style={p.body}>{result.feedback}</Text>
    <Text style={p.caption}>Tagalog phoneme scoring is unavailable. Confidence is unavailable and uncalibrated; review the transcript yourself. No stress, fluency or pronunciation accuracy percentage is calculated.</Text>
    <Text style={p.caption}>Attempt {result.attempt_number} · {new Date(result.attempted_at).toLocaleString()} · Inference {result.processing_duration_ms} ms · Initialization {result.initialization_ms} ms · Model {result.model_id} · {result.model_version.slice(0,12)} · tgl adapter</Text>
  </View>;
}

function SpeechResultView({result}:{result:SpeechResult}){
  return result.status==='transcribed'?<MMSResultView result={result}/>:<WavLMResult result={result}/>;
}

function Recording({activity,api,classId}:{activity:PronunciationActivityView;api:SpeechAccess;classId?:string}){
  const recorder=useAudioRecorder({privateTemporary:true,maximumDurationMs:29000});
  const speech=useLessonSpeech(activity.language,activity.id);
  const tagalog=activity.language==='tagalog';
  const [automatic]=useState(()=>new AutomaticAssessment());
  const {audioPayload,durationMs,discardRecording}=recorder;
  const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retrying,setRetrying]=useState(false);
  const [result,setResult]=useState<SpeechResult|null>(null),[history,setHistory]=useState<SpeechResult[]>([]),[offset,setOffset]=useState(0),[more,setMore]=useState(true);
  const alive=useRef(true),generation=useRef(0),sending=useRef(false),pending=useRef<{audio:NonNullable<typeof recorder.audioPayload>;duration:number;key:string}|null>(null);
  const invalidate=useCallback(()=>{alive.current=false;generation.current++;pending.current=null;automatic.cancel();},[automatic]);
  useEffect(()=>{alive.current=true;return invalidate;},[invalidate]);
  const loadHistory=async(reset=false)=>{
    const run=generation.current;setError('');setBusy(true);
    try{const rows=await api.history(activity.id,reset?0:offset,classId);if(alive.current&&run===generation.current){setHistory(old=>reset?rows:[...old,...rows]);setOffset((reset?0:offset)+rows.length);setMore(rows.length===20);}}
    catch{if(alive.current&&run===generation.current){setHistory([]);setError('Previous attempts could not be verified. Try refreshing history.');}}
    finally{if(alive.current&&run===generation.current)setBusy(false);}
  };
  const submit=useCallback(async()=>{
    if(!alive.current||sending.current||!consent||!audioPayload)return;
    const run=generation.current;
    const item=pending.current??{audio:audioPayload,duration:durationMs,key:randomUUID()};
    pending.current=item;sending.current=true;setBusy(true);setResult(null);setError('');setRetrying(false);
    try{const value=await api.assess(activity,item.audio,item.key,item.duration,classId);if(alive.current&&run===generation.current){setResult(value);pending.current=null;setHistory([]);setOffset(0);setMore(true);await discardRecording();}}
    catch(cause){if(alive.current&&run===generation.current){setRetrying(true);setError(cause instanceof Error?cause.message:'Speech processing did not finish. No result is confirmed. Retry the original request or refresh history.');}}
    finally{sending.current=false;if(alive.current&&run===generation.current)setBusy(false);}
  },[activity,api,classId,consent,audioPayload,durationMs,discardRecording]);
  useEffect(()=>{if(automatic.consume(recorder.status,recorder.audioPayload,consent))void submit();},[automatic,recorder.status,recorder.audioPayload,consent,submit]);
  const start=async()=>{automatic.cancel();pending.current=null;const run=++generation.current;setRetrying(false);setResult(null);setError('');if(await speech.stop()){await recorder.startRecording();if(alive.current&&run===generation.current)automatic.arm();}};
  const recording=recorder.status==='recording',reviewing=['recorded','playing'].includes(recorder.status);
  return <View style={{gap:16}}><View style={p.card}>
    <Text style={p.eyebrow}>{tagalog?'Tagalog transcription and word comparison':'English acoustic assessment'} · Server connection required</Text><Text style={p.heading}>{activity.target_text}</Text>
    <Text style={p.body}>{tagalog?'The server saves the recognized speech and reference-text comparison, with no pronunciation score.':'The server processes the finished recording and saves the score and phoneme feedback to your account.'} Temporary server audio is removed after processing; device cache cleanup is best effort. This does not change your learning schedule.</Text>
    <Pressable accessibilityRole="checkbox" accessibilityLabel={tagalog?"Allow local server transcription and saved text comparison":"Allow local server audio assessment and saved feedback"} accessibilityState={{checked:consent}} disabled={busy||recording} onPress={()=>setConsent(v=>!v)} style={p.note}><Text style={p.body}>{consent?'☑':'☐'} {tagalog?"I allow local-server transcription and saving recognized speech and text comparison.":"I allow local-server audio assessment and saving the model feedback."}</Text></Pressable>
    <Button label="Listen to reference" disabled={busy||recording} onPress={()=>void speech.play(activity.target_text)}/>
    <Text style={p.caption}>Read the whole sentence, then tap {tagalog?'Stop and transcribe':'Stop and evaluate'}. Your finished recording is processed automatically; there is no score while you are still speaking.</Text>
    <Text style={p.caption}>{(recorder.durationMs/1000).toFixed(1)} / 30 seconds</Text>
    <Button label={recording?(tagalog?'Stop and transcribe':'Stop and evaluate'):'Record full sentence'} disabled={busy||speech.speaking||!consent||reviewing} onPress={()=>{if(recording)void recorder.stopRecording();else void start();}}/>
    {reviewing&&<><Button label={recorder.status==='playing'?'Pause recording':'Play recording'} disabled={busy} onPress={()=>{if(recorder.status==='playing')void recorder.pausePlayback();else void recorder.playRecording();}}/>
      {retrying&&<Button label={tagalog?"Retry original transcription":"Retry original assessment"} disabled={busy||!consent||recorder.status==='playing'} onPress={()=>void submit()}/>}
      <Button label="Discard and try again" secondary disabled={busy} onPress={()=>{automatic.cancel();pending.current=null;generation.current++;setResult(null);setError('');setRetrying(false);void recorder.discardRecording();}}/></>}
    {busy&&<Text accessibilityLiveRegion="polite" style={p.body}>Processing… First use may include model initialization. No interim-word score is calculated.</Text>}
    {!!(error||recorder.error||speech.error)&&<ErrorMessage message={error||recorder.error||speech.error}/>}
  </View>{result&&<SpeechResultView result={result}/>}
  <View style={p.card}><Text style={p.heading}>{tagalog?"Previous transcriptions":"Previous model assessments"}</Text><Button label="Refresh previous attempts" disabled={busy||recording} onPress={()=>void loadHistory(true)}/>
    {history.map(row=><SpeechResultView key={row.assessment_id} result={row}/>)}
    {history.length>0&&more&&<Button label="Load older attempts" disabled={busy} onPress={()=>void loadHistory()}/>}
    {history.length===0&&<Text style={p.caption}>Use Refresh to load saved results. A lost response may follow a saved result; retry the original request or refresh history to confirm it. No improvement is inferred without comparable real attempts.</Text>}
  </View></View>;
}

export function WavLMPracticeOption({activity,api,enrollment,children}:{activity:PronunciationActivityView;api:PronunciationAccess;enrollment?:EnrollmentAccess;children:ReactNode}){
  const [capability,setCapability]=useState<WavLMCapability|MMSCapability|null>(null),[open,setOpen]=useState(false),[reload,setReload]=useState(0),[error,setError]=useState('');
  const speechApi=selectSpeechAccess(api,activity.language),tagalog=activity.language==='tagalog';
  const [classes,setClasses]=useState<Membership[]>([]),[classId,setClassId]=useState(''),[classOffset,setClassOffset]=useState(0),[moreClasses,setMoreClasses]=useState(false);
  const generation=useRef(0),active=useRef(false);
  useFocusEffect(useCallback(()=>{
    active.current=true;const run=++generation.current;setCapability(null);setOpen(false);setClasses([]);setClassId('');setError('');setClassOffset(0);setMoreClasses(false);
    if(speechApi)void speechApi.capabilities(activity.language).then(value=>{if(active.current&&run===generation.current)setCapability(value);}).catch(()=>{if(active.current&&run===generation.current)setError('Speech model availability could not be verified. Standard practice is still available.');});
    const background=(state:string)=>{if(state!=='active'){generation.current++;setOpen(false);setCapability(null);setClasses([]);}else setReload(v=>v+1);};
    const listener=AppState.addEventListener('change',background);
    const visible=()=>background(document.hidden?'background':'active');
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',visible);
    return()=>{active.current=false;generation.current++;listener.remove();if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visible);};
  // The reload counter deliberately rechecks service readiness after an explicit refresh or foreground event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[api,activity,reload,speechApi]));
  const loadClasses=async()=>{if(!enrollment)return;const run=generation.current;try{const rows=await enrollment.mine(classOffset);if(active.current&&run===generation.current){setClasses(old=>[...old,...rows.filter(row=>row.language===activity.language)]);setClassOffset(v=>v+rows.length);setMoreClasses(rows.length===50);}}catch{if(active.current&&run===generation.current){setClasses([]);setError('Class access could not be verified.');}}};
  return <View style={{gap:16}}><View style={p.note}><Text style={p.heading}>{tagalog?'Optional MMS Tagalog transcription':'Optional WavLM pronunciation scoring'}</Text>
    {tagalog&&<Text style={p.caption}>Tagalog acoustic scoring is unsupported by this model. MMS recognizes words and compares text; phoneme-level scoring is unavailable.</Text>}
    <Text style={p.caption}>{!speechApi?'Demo mode has no live model assessment. No acoustic score is generated.':capability?.available?'Ready to request server-side speech processing; weights load on first use.':'Unavailable · '+(capability?.reason==='insufficient_memory'?(tagalog?'the server needs at least 8 GiB available RAM before loading MMS; installed RAM is not available RAM':'the server needs at least 5 GiB available RAM before loading WavLM'):(capability?.reason.replaceAll('_',' ')??'checking service'))+'. Standard practice remains available.'}</Text>
    <Text style={p.caption}>{tagalog?'Transcription confidence is uncalibrated. Word agreement is not pronunciation quality.':'Model predictions from children’s English training; not validated for Filipino-accented English. Scores are not certified grades or vocabulary-retention measures.'}</Text>
    {!!error&&<ErrorMessage message={error}/>}
    {capability?.available&&<Button label={open?'Return to standard practice':tagalog?'Use MMS transcription':'Use WavLM assessment'} secondary onPress={()=>{setOpen(v=>!v);}}/>}
    {!speechApi&&<Text style={p.caption}>Speech processing requires an authenticated live backend connection and a running model. The browser demo supports word practice only; completing its highlights does not run WavLM or MMS.</Text>}
    {!capability?.available&&speechApi&&<Button label="Recheck speech model availability" secondary onPress={()=>setReload(v=>v+1)}/>}
  </View>{open&&speechApi?<>
    {enrollment&&<View style={p.card}><Text style={p.heading}>Save this practice to</Text><Pressable accessibilityRole="radio" accessibilityState={{selected:classId===''}} onPress={()=>setClassId('')}><Text style={p.body}>{classId===''?'●':'○'} Independent practice · only you can view it</Text></Pressable>
      {classes.map(row=><Pressable key={row.id} accessibilityRole="radio" accessibilityState={{selected:classId===row.class_id}} onPress={()=>setClassId(row.class_id)}><Text style={p.body}>{classId===row.class_id?'●':'○'} {row.class_name} · {tagalog?'saved in this class context':'visible to your instructor'}</Text></Pressable>)}
      {(classOffset===0||moreClasses)&&<Button label={classOffset?'Load more classrooms':`Load my ${tagalog?'Tagalog':'English'} classrooms`} secondary onPress={()=>void loadClasses()}/>}
      <Text style={p.caption}>Choose an ordinary classroom explicitly. Research Classrooms refuse this scoring flow.</Text>
    </View>}
    <Recording key={`${activity.id}:${classId}`} activity={activity} api={speechApi} classId={classId||undefined}/>
  </>:children}</View>;
}
