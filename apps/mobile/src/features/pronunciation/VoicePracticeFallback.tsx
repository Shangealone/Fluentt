import {useCallback,useState} from 'react';
import {Text,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {Button,ErrorMessage} from '../../components/ui';
import {p} from '../../theme/personal';
import type {PronunciationAccess,PronunciationActivityView,PronunciationAttemptHistoryItem} from '../../services/api/pronunciation';
import {LocalRecordingPractice} from './LocalRecordingPractice';

/** Existing playback and retained history without issuing legacy simulated scores. */
export function VoicePracticeFallback({activity,api}:{activity:PronunciationActivityView;api:PronunciationAccess}){
  const [rows,setRows]=useState<PronunciationAttemptHistoryItem[]>([]),[error,setError]=useState(''),[reload,setReload]=useState(0);
  useFocusEffect(useCallback(()=>{
    let active=true;setRows([]);setError('');
    void api.attempts(activity.id).then(items=>{if(active)setRows(items);}).catch(()=>{if(active){setRows([]);setError('Previous practice could not be verified.');}});
    return()=>{active=false;setRows([]);setError('');};
  // The counter deliberately repeats a focused read after an explicit refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activity.id,api,reload]));
  return <View style={{gap:16}}>
    <LocalRecordingPractice activity={activity} explanation="Choose an available local speech model above for server processing."/>
    <View style={p.card}><Text style={p.heading}>Retained practice history</Text>
      <Text style={p.caption}>Earlier records may include simulated practice. This list is not evidence of pronunciation quality. Use the model-specific history for verified output provenance.</Text>
      {!!error&&<ErrorMessage message={error}/>}
      {rows.map(row=><View key={row.attempt_id} style={p.note}><Text style={p.body}>{new Date(row.attempted_at).toLocaleString()} · {row.scoring_status}</Text>
        {!!row.transcription&&<Text style={p.caption}>Stored transcript (provenance not verified here): {row.transcription}</Text>}
      </View>)}
      <Button label="Refresh retained practice" secondary onPress={()=>setReload(value=>value+1)}/>
    </View>
  </View>;
}
