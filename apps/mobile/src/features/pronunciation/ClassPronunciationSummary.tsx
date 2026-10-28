import {useEffect,useRef,useState} from 'react';
import {AppState,Text,View} from 'react-native';
import {Button,ErrorMessage} from '../../components/ui';
import {p} from '../../theme/personal';
import type {WavLMAccess,WavLMClassPage} from '../../services/api/wavlm';

export function ClassPronunciationSummary({api,classId}:{api?:WavLMAccess;classId:string}){
  const [page,setPage]=useState<WavLMClassPage|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const alive=useRef(true),generation=useRef(0);
  useEffect(()=>{
    alive.current=true;
    const hide=()=>{generation.current++;setPage(null);setError('');setBusy(false);};
    const listener=AppState.addEventListener('change',state=>{if(state!=='active')hide();});
    const visible=()=>{if(document.hidden)hide();};
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',visible);
    if(typeof window!=='undefined')window.addEventListener('blur',hide);
    return()=>{alive.current=false;hide();listener.remove();if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visible);if(typeof window!=='undefined')window.removeEventListener('blur',hide);};
  },[]);
  const load=async(offset=0)=>{if(!api||busy)return;const run=generation.current;setBusy(true);setPage(null);setError('');try{const value=await api.classAttempts(classId,offset);if(alive.current&&run===generation.current)setPage(value);}catch{if(alive.current&&run===generation.current){setPage(null);setError('Class pronunciation records are unavailable. Refresh to verify ownership and current membership.');}}finally{if(alive.current&&run===generation.current)setBusy(false);}};
  return <View style={p.card}><Text style={p.heading}>English pronunciation · WavLM feedback</Text><Text style={p.caption}>Current eligible students in this owned ordinary class only. Unvalidated model predictions are separate from academic grades, mastery and research outcomes. Independent and personal practice stay private.</Text>
    {api?<Button label={busy?'Checking class access…':'Load class pronunciation attempts'} disabled={busy} onPress={()=>void load()}/>:<Text style={p.caption}>Live WavLM records are not connected in demo mode.</Text>}
    {!!error&&<ErrorMessage message={error}/>}
    {page?.items.map(row=><View key={row.assessment_id} style={p.note}><Text style={p.body}>{row.username} · Model prediction {row.overall_score.toFixed(1)} / 100</Text><Text style={p.caption}>{new Date(row.attempted_at).toLocaleString()} · {row.model_version.slice(0,12)}</Text></View>)}
    {page?.items.length===0&&<Text style={p.caption}>No actual WavLM attempts are available in this class.</Text>}
    {page&&<View style={p.row}><Button label="Previous" secondary disabled={busy||page.offset===0} onPress={()=>void load(Math.max(0,page.offset-20))}/><Button label="Next" secondary disabled={busy||!page.has_more} onPress={()=>void load(page.offset+20)}/></View>}
  </View>;
}
