import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {AppState,Pressable,Text,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {randomUUID} from 'expo-crypto';
import {Button,ErrorMessage} from '../../components/ui';
import {p,pc} from '../../theme/personal';
import type {PronunciationAccess,PronunciationActivityView} from '../../services/api/pronunciation';
import type {EnrollmentAccess,Membership} from '../../services/api/enrollment';
import type {WavLMAccess,WavLMCapability,WavLMScore} from '../../services/api/wavlm';
import {useAudioRecorder} from './useAudioRecorder';
import {useLessonSpeech} from '../learning/useLessonSpeech';

export function WavLMResult({result}:{result:WavLMScore}){
  return <View style={p.card} accessibilityLiveRegion="polite"><Text style={p.eyebrow}>WavLM · English · Model prediction</Text>
    <Text accessibilityRole="header" style={p.heading}>Pronunciation practice feedback</Text><Text style={p.metricValue}>{result.overall_score.toFixed(1)} / 100</Text>
    <Text style={p.body}>{result.feedback}</Text>
    {result.words.map((word,i)=><View key={i} style={[p.note,{backgroundColor:word.phonemes.some(phone=>phone.error)?pc.rose:pc.background}]}>
      <Text style={p.heading}>{word.word} · {word.score.toFixed(1)}</Text>
      <Text style={p.caption}>{word.phonemes.map(phone=>`/${phone.phone}/ ${phone.score.toFixed(1)}${phone.error?' · practise':''}`).join('   ')}</Text>
      {word.phonemes.filter(phone=>phone.error).map((phone,j)=><Text key={j} style={p.body}>Possible difficulty with /{phone.phone}/ · {phone.tip} Model error output: {phone.pherr_prob.toFixed(2)}; this is not calibrated certainty for your accent.</Text>)}
    </View>)}
    <Text style={p.caption}>Attempt {result.attempt_number} · {new Date(result.attempted_at).toLocaleString()} · Inference {result.processing_duration_ms} ms · Initialization {result.initialization_ms} ms. Trained on children’s English; not validated for Filipino-accented English. Not a grade, diagnosis or research outcome.</Text>
    <Text style={p.caption}>Model {result.model_id} · {result.model_version.slice(0,12)}</Text>
  </View>;
}

function Recording({activity,api,classId}:{activity:PronunciationActivityView;api:WavLMAccess;classId?:string}){
  const recorder=useAudioRecorder({privateTemporary:true,maximumDurationMs:29000});
  const speech=useLessonSpeech('english',activity.id);
  const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retrying,setRetrying]=useState(false);
  const [result,setResult]=useState<WavLMScore|null>(null),[history,setHistory]=useState<WavLMScore[]>([]),[offset,setOffset]=useState(0),[more,setMore]=useState(true);
  const alive=useRef(true),generation=useRef(0),sending=useRef(false),pending=useRef<{audio:NonNullable<typeof recorder.audioPayload>;duration:number;key:string}|null>(null);
  const invalidate=useCallback(()=>{alive.current=false;generation.current++;pending.current=null;},[]);
  useEffect(()=>{alive.current=true;return invalidate;},[invalidate]);
  const loadHistory=async(reset=false)=>{
    const run=generation.current;setError('');setBusy(true);
    try{const rows=await api.history(activity.id,reset?0:offset,classId);if(alive.current&&run===generation.current){setHistory(old=>reset?rows:[...old,...rows]);setOffset((reset?0:offset)+rows.length);setMore(rows.length===20);}}
    catch{if(alive.current&&run===generation.current){setHistory([]);setError('Previous attempts could not be verified. Try refreshing history.');}}
    finally{if(alive.current&&run===generation.current)setBusy(false);}
  };
  const submit=async()=>{
    if(sending.current||!consent||!recorder.audioPayload)return;
    const run=generation.current;
    const item=pending.current??{audio:recorder.audioPayload,duration:recorder.durationMs,key:randomUUID()};
    pending.current=item;sending.current=true;setBusy(true);setResult(null);setError('');setRetrying(false);
    try{const value=await api.assess(activity,item.audio,item.key,item.duration,classId);if(alive.current&&run===generation.current){setResult(value);pending.current=null;setHistory([]);setOffset(0);setMore(true);await recorder.discardRecording();}}
    catch(cause){if(alive.current&&run===generation.current){setRetrying(true);setError(cause instanceof Error?cause.message:'Scoring did not finish. No result is confirmed.');}}
    finally{sending.current=false;if(alive.current&&run===generation.current)setBusy(false);}
  };
  const start=async()=>{pending.current=null;generation.current++;setRetrying(false);setResult(null);setError('');if(await speech.stop())await recorder.startRecording();};
  const recording=recorder.status==='recording',reviewing=['recorded','playing'].includes(recorder.status);
  return <View style={{gap:16}}><View style={p.card}>
    <Text style={p.eyebrow}>English acoustic assessment · Server connection required</Text><Text style={p.heading}>{activity.target_text}</Text>
    <Text style={p.body}>The server processes the finished recording and saves the score and phoneme feedback to your account. Raw audio is deleted after processing. This does not change your learning schedule.</Text>
    <Pressable accessibilityRole="checkbox" accessibilityLabel="Allow local server audio assessment and saved feedback" accessibilityState={{checked:consent}} disabled={busy||recording} onPress={()=>setConsent(v=>!v)} style={p.note}><Text style={p.body}>{consent?'☑':'☐'} I allow local-server audio assessment and saving the model feedback.</Text></Pressable>
    <Button label="Listen to reference" disabled={busy||recording} onPress={()=>void speech.play(activity.target_text)}/>
    <Text style={p.caption}>{(recorder.durationMs/1000).toFixed(1)} / 30 seconds</Text>
    <Button label={recording?'Stop recording':'Record full sentence'} disabled={busy||speech.speaking||!consent||reviewing} onPress={()=>{if(recording)void recorder.stopRecording();else void start();}}/>
    {reviewing&&<><Button label={recorder.status==='playing'?'Pause recording':'Play recording'} disabled={busy} onPress={()=>{if(recorder.status==='playing')void recorder.pausePlayback();else void recorder.playRecording();}}/>
      <Button label={busy?'Assessing full recording…':retrying?'Retry original assessment':'Assess recording'} disabled={busy||!consent||recorder.status==='playing'} onPress={()=>void submit()}/>
      <Button label="Discard and try again" secondary disabled={busy} onPress={()=>{pending.current=null;generation.current++;setResult(null);setError('');void recorder.discardRecording();}}/></>}
    {busy&&<Text accessibilityLiveRegion="polite" style={p.body}>Processing… First use may include model initialization. No interim-word score is calculated.</Text>}
    {!!(error||recorder.error||speech.error)&&<ErrorMessage message={error||recorder.error||speech.error}/>}
  </View>{result&&<WavLMResult result={result}/>}
  <View style={p.card}><Text style={p.heading}>Previous actual assessments</Text><Button label="Refresh previous attempts" disabled={busy||recording} onPress={()=>void loadHistory(true)}/>
    {history.map(row=><WavLMResult key={row.assessment_id} result={row}/>)}
    {history.length>0&&more&&<Button label="Load older attempts" disabled={busy} onPress={()=>void loadHistory()}/>}
    {history.length===0&&<Text style={p.caption}>Use Refresh to load saved assessments. Failed requests do not create completed records. No improvement is inferred without comparable real attempts.</Text>}
  </View></View>;
}

export function WavLMPracticeOption({activity,api,enrollment,children}:{activity:PronunciationActivityView;api:PronunciationAccess;enrollment?:EnrollmentAccess;children:ReactNode}){
  const [capability,setCapability]=useState<WavLMCapability|null>(null),[open,setOpen]=useState(false),[reload,setReload]=useState(0),[error,setError]=useState('');
  const [classes,setClasses]=useState<Membership[]>([]),[classId,setClassId]=useState(''),[classOffset,setClassOffset]=useState(0),[moreClasses,setMoreClasses]=useState(false);
  const generation=useRef(0),active=useRef(false);
  useFocusEffect(useCallback(()=>{
    active.current=true;const run=++generation.current;setCapability(null);setOpen(false);setClasses([]);setClassId('');setError('');setClassOffset(0);setMoreClasses(false);
    if(activity.language==='english'&&api.wavlm)void api.wavlm.capabilities(activity.language).then(value=>{if(active.current&&run===generation.current)setCapability(value);}).catch(()=>{if(active.current&&run===generation.current)setError('Scoring availability could not be verified. Standard practice is still available.');});
    const background=(state:string)=>{if(state!=='active'){generation.current++;setOpen(false);setCapability(null);setClasses([]);}else setReload(v=>v+1);};
    const listener=AppState.addEventListener('change',background);
    const visible=()=>background(document.hidden?'background':'active');
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',visible);
    return()=>{active.current=false;generation.current++;listener.remove();if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visible);};
  // The reload counter deliberately rechecks service readiness after an explicit refresh or foreground event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[api,activity,reload]));
  const loadClasses=async()=>{if(!enrollment)return;const run=generation.current;try{const rows=await enrollment.mine(classOffset);if(active.current&&run===generation.current){setClasses(old=>[...old,...rows.filter(row=>row.language==='english')]);setClassOffset(v=>v+rows.length);setMoreClasses(rows.length===50);}}catch{if(active.current&&run===generation.current){setClasses([]);setError('Class access could not be verified.');}}};
  return <View style={{gap:16}}><View style={p.note}><Text style={p.heading}>Optional WavLM pronunciation scoring</Text>
    <Text style={p.caption}>{activity.language!=='english'?'Tagalog acoustic scoring is unsupported by this model.':!api.wavlm?'Demo mode has no live model assessment. No acoustic score is generated.':capability?.available?'Ready to request server-side model assessment; weights load on first use.':'Unavailable · '+(capability?.reason.replaceAll('_',' ')??'checking service')+'. Standard practice remains available.'}</Text>
    <Text style={p.caption}>Model predictions from children’s English training; not validated for Filipino-accented English. Scores are not certified grades or vocabulary-retention measures.</Text>
    {!!error&&<ErrorMessage message={error}/>}
    {capability?.available&&<Button label={open?'Return to standard practice':'Use WavLM assessment'} secondary onPress={()=>{setOpen(v=>!v);}}/>}
    {!api.wavlm&&<Text style={p.caption}>Scoring requires an authenticated live backend connection and a running model. The browser demo supports word practice only; completing its highlights does not run WavLM.</Text>}
    {!capability?.available&&api.wavlm&&activity.language==='english'&&<Button label="Recheck scoring availability" secondary onPress={()=>setReload(v=>v+1)}/>}
  </View>{open&&api.wavlm?<>
    {enrollment&&<View style={p.card}><Text style={p.heading}>Save this practice to</Text><Pressable accessibilityRole="radio" accessibilityState={{selected:classId===''}} onPress={()=>setClassId('')}><Text style={p.body}>{classId===''?'●':'○'} Independent practice · only you can view it</Text></Pressable>
      {classes.map(row=><Pressable key={row.id} accessibilityRole="radio" accessibilityState={{selected:classId===row.class_id}} onPress={()=>setClassId(row.class_id)}><Text style={p.body}>{classId===row.class_id?'●':'○'} {row.class_name} · visible to your instructor</Text></Pressable>)}
      {(classOffset===0||moreClasses)&&<Button label={classOffset?'Load more classrooms':'Load my English classrooms'} secondary onPress={()=>void loadClasses()}/>}
      <Text style={p.caption}>Choose an ordinary classroom explicitly. Research Classrooms refuse this scoring flow.</Text>
    </View>}
    <Recording key={`${activity.id}:${classId}`} activity={activity} api={api.wavlm} classId={classId||undefined}/>
  </>:children}</View>;
}
