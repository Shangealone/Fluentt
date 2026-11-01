"""Frozen SpeechOcean762 pilot and safe execution of the actual local WavLM code.

No download, training, production writes, score calibration or fallback predictions.
Run from services/api; see README.md. Audio/annotations stay in ignored storage.
"""
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import random
import statistics
import subprocess
import sys
import tempfile
import time
import wave

REVISION = "613968e3b0b789fc33936fb5eba1973176ba7d11"
MODEL_REVISION = "19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da"
SEED = 20261031
API = Path(__file__).resolve().parents[2]
ROOT = API.parents[1]
MIN_FREE = 5 * 1024**3  # Same current production/benchmark gate, never relaxed.
PROTOCOL = {
    "version": "speechocean-pilot-v1", "seed": SEED,
    "selection": "10 seeded test speakers, 3 seeded utterances each; no score filtering",
    "primary": "Association only: unchanged overall mean-phone score versus official sentence accuracy",
    "model_scale": [0, 100], "human_sentence_accuracy_scale": [0, 10],
    "transformation": "None for correlation; no fitted conversion or thresholds",
    "mae_rmse": "Not estimated: common calibrated score meaning not established",
    "secondary": "Exact word/phone-position matches only, strip ARPABET stress digits; no dynamic label alignment",
    "stress": "Not evaluated; production G2P strips stress",
    "calibration_samples": [], "evaluation_only": True,
    "uncertainty": "2000 paired speaker-cluster bootstrap draws, seed 20261031, percentile 95%",
    "independence": "UNVERIFIED", "local_filipino_validation": "NOT PERFORMED",
    "limits": {"seconds": 600, "per_sample_seconds": 45, "emergency_free_bytes": int(1.5*1024**3),
               "tree_rss_bytes": int(6.5*1024**3)},
}


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024**2), b""):
            digest.update(block)
    return digest.hexdigest()


def dump(path, data):
    Path(path).write_text(json.dumps(data, indent=2, allow_nan=False)+"\n", encoding="utf-8")


def keyed(path, remainder=False):
    return dict(line.split(maxsplit=1) if remainder else line.split() for line in Path(path).read_text().splitlines())


def select(test, train, seed=SEED):
    if set(test) & set(train) or set(test.values()) & set(train.values()):
        raise ValueError("Train/test identity overlap")
    groups = defaultdict(list)
    for sample, speaker in test.items():
        groups[speaker].append(sample)
    eligible = sorted(s for s, ids in groups.items() if len(ids) >= 3)
    rng = random.Random(seed)
    speakers = sorted(rng.sample(eligible, 10))
    return [(u, s) for s in speakers for u in sorted(rng.sample(sorted(groups[s]), 3))]


def prepare(folder, output):
    source = folder / "source"
    test, train = keyed(source/"test/utt2spk"), keyed(source/"train/utt2spk")
    texts, wavs = keyed(source/"test/text", True), keyed(source/"test/wav.scp", True)
    scores = json.loads((source/"resource/scores.json").read_text())
    details = json.loads((source/"resource/scores-detail.json").read_text())
    ledger = json.loads((folder/"acquisition.json").read_text())
    if ledger['revision'] != REVISION:
        raise ValueError('Unexpected dataset revision')
    hashes = {f['path']: f for f in ledger['files']}
    for name, entry in hashes.items():
        if sha(source/name) != entry['sha256']:
            raise ValueError('Source hash mismatch')
    rows = []
    for sample, speaker in select(test, train):
        a, detail = scores[sample], details[sample]
        path = f"WAVE/SPEAKER{speaker}/{sample}.WAV"
        if a['text'] != texts[sample] or detail['text'] != texts[sample] or not wavs[sample].endswith(path):
            raise ValueError('Mismatched audio/text/speaker')
        if a['accuracy'] != statistics.median(detail['accuracy']) or len(detail['accuracy']) != 5:
            raise ValueError('Unexpected human accuracy aggregation')
        if not 0 <= a['accuracy'] <= 10:
            raise ValueError('Invalid human label')
        for word in a['words']:
            if len(word['phones']) != len(word['phones-accuracy']) or any(not 0<=n<=2 for n in word['phones-accuracy']):
                raise ValueError('Invalid phone labels')
        # Preflight marks failures; it never replaces difficult/invalid selected recordings.
        status = 'valid'
        try:
            import array
            with wave.open(str(source/path)) as audio:
                rate, channels, width, frames = audio.getframerate(),audio.getnchannels(),audio.getsampwidth(),audio.getnframes()
                pcm = audio.readframes(frames)
            duration = frames/rate
            if (rate, channels, width) != (16000,1,2) or not .5<=duration<=30:
                status = 'invalid_audio'
            elif statistics.pstdev(array.array('h',pcm))/32768 < .0005:
                status = 'silent_audio'
        except (OSError, EOFError, wave.Error):
            rate, duration, status = None, None, 'corrupt_audio'
        rows.append({"sample_id":sample,"speaker_id":speaker,"split":"test", "dataset_revision":REVISION,
                     "audio_path":path,"audio_sha256":hashes[path]['sha256'],"reference_text":texts[sample],
                     "reference_sha256":hashlib.sha256(texts[sample].encode()).hexdigest(),
                     "human_sentence_accuracy":a['accuracy'],"human_expert_accuracy":detail['accuracy'],
                     "human_words":a['words'],"duration_seconds":duration,"sample_rate":rate,"audio_check":status})
    counts=Counter(r['audio_sha256'] for r in rows)
    if max(counts.values()) != 1:
        raise ValueError('Duplicate pilot audio')
    dump(output/'protocol.json', PROTOCOL)
    dump(output/'manifest.json', {"protocol":PROTOCOL['version'],"rows":rows,
         "train_test_speaker_overlap":0,"train_test_utterance_overlap":0,"duplicate_selected_audio":0,
         "duplicate_reference_texts":len(rows)-len({r['reference_text'] for r in rows}),
         "selection_seed":SEED,"dataset_license":"CC BY 4.0 (OpenSLR)","dataset_independence":"UNVERIFIED"})


def blocked_rows(manifest, reason):
    return [{"sample_id":r['sample_id'],"speaker_id":r['speaker_id'],"reference_sha256":r['reference_sha256'],
             "human_accuracy":r['human_sentence_accuracy'],"model_score":None,
             "status":"not_run", "reason":reason,"dataset_revision":REVISION,"model_revision":MODEL_REVISION}
            for r in manifest['rows']]


def rank(values):
    order=sorted(range(len(values)),key=values.__getitem__); result=[0.]*len(values); i=0
    while i<len(order):
        j=i+1
        while j<len(order) and values[order[j]]==values[order[i]]: j+=1
        for k in range(i,j): result[order[k]]=(i+j-1)/2+1
        i=j
    return result


def pearson(x,y):
    if len(x)!=len(y) or len(x)<3: return None
    mx,my=statistics.mean(x),statistics.mean(y)
    a=sum((v-mx)**2 for v in x); b=sum((v-my)**2 for v in y)
    return sum((u-mx)*(v-my) for u,v in zip(x,y))/math.sqrt(a*b) if a and b else None


def association(rows):
    x=[r['human_accuracy'] for r in rows]; y=[r['model_score'] for r in rows]
    return {'pearson':pearson(x,y),'spearman':pearson(rank(x),rank(y))}


def analyze(rows):
    good=[r for r in rows if r['status']=='scored']
    for r in good:
        if r['model_score'] is None or not math.isfinite(r['model_score']) or not 0<=r['model_score']<=100:
            raise ValueError('Invalid successful prediction')
    result={'selected':len(rows),'scored':len(good),'not_scored':len(rows)-len(good),
            'coverage':len(good)/len(rows) if rows else 0,'statuses':dict(Counter(r['status'] for r in rows)),
            'speakers_selected':len({r['speaker_id'] for r in rows}),
            'mae':None,'rmse':None,'reason_mae_rmse':PROTOCOL['mae_rmse'],
            'association':association(good),'independence':'UNVERIFIED'}
    for field in ['human_accuracy','model_score']:
        vals=[r[field] for r in good]
        result[field+'_distribution']=dict(min=min(vals),max=max(vals),mean=statistics.mean(vals),median=statistics.median(vals)) if vals else None
    clusters=defaultdict(list)
    for r in good:clusters[r['speaker_id']].append(r)
    if len(clusters)>=8:
        rng=random.Random(SEED);speakers=sorted(clusters); draws=defaultdict(list)
        for _ in range(2000):
            sample=[r for s in rng.choices(speakers,k=len(speakers)) for r in clusters[s]]
            for k,v in association(sample).items():
                if v is not None:draws[k].append(v)
        result['speaker_bootstrap_95_percent']={k:{'low':sorted(v)[int(.025*(len(v)-1))],
            'high':sorted(v)[int(.975*(len(v)-1))],'valid_draws':len(v)} for k,v in draws.items()}
    else:result['speaker_bootstrap_95_percent']=None
    return result


def save_results(output, rows, resources):
    dump(output/'evaluation.json',rows);dump(output/'analysis.json',analyze(rows));dump(output/'resources.json',resources)
    fields=['sample_id','speaker_id','reference_sha256','human_accuracy','model_score','status','reason','dataset_revision','model_revision']
    with (output/'evaluation.csv').open('w',newline='',encoding='utf-8') as stream:
        writer=csv.DictWriter(stream,fieldnames=fields,extrasaction='ignore');writer.writeheader();writer.writerows(rows)


def other_models(psutil):
    found=[]
    for process in psutil.process_iter(['pid','name','cmdline','memory_info']):
        try:
            if process.pid==os.getpid() or 'python' not in (process.info['name'] or '').lower():continue
            command=' '.join(process.info['cmdline'] or []).replace('\\','/').lower()
            if any(m in command for m in ['ml/wavlm/worker.py','ml/mms/worker.py','ml/wavlm/benchmark.py','run_pilot.py']) or process.info['memory_info'].rss>512*1024**2:
                found.append(process.pid)
        except (psutil.AccessDenied,psutil.NoSuchProcess):pass
    return found


def run(folder, output):
    import psutil
    manifest=json.loads((output/'manifest.json').read_text());rows=blocked_rows(manifest,'not_attempted')
    v=psutil.virtual_memory();others=other_models(psutil)
    metrics={'total_bytes':v.total,'start_available_bytes':v.available,'required_start_bytes':MIN_FREE,
             'disk_free_bytes':__import__('shutil').disk_usage(output).free,'other_model_pids':others,
             'model_loaded':False,'inference_latency_ms':None,'peak_tree_rss_bytes':None}
    if v.available<MIN_FREE or others:
        reason='insufficient_memory' if v.available<MIN_FREE else 'other_model_process'
        for r in rows:r['reason']=reason
        metrics['status']='BLOCKED';save_results(output,rows,metrics);return
    cfg=json.loads((API/'private-data/voice-section8/config-local.json').read_text())
    env=dict(os.environ,HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',PYTHONNOUSERSITE='1',
             OMP_NUM_THREADS='2',MKL_NUM_THREADS='2',PYTHONUTF8='1')
    command=[cfg['ml_python'],str(Path(__file__).resolve()),'child','--folder',str(folder),'--output',str(output)]
    start=time.perf_counter();start_wall=time.time();peak=0;low=v.available;reason=None
    with (output/'inference-stdout.txt').open('w') as stdout,(output/'inference-stderr.txt').open('w') as stderr:
        child=subprocess.Popen(command,env=env,cwd=API,stdout=stdout,stderr=stderr,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        proc=psutil.Process(child.pid)
        while child.poll() is None:
            try:tree=[proc]+proc.children(recursive=True)
            except psutil.NoSuchProcess:tree=[]
            rss=0
            for item in tree:
                try:rss+=item.memory_info().rss
                except psutil.NoSuchProcess:pass
            peak=max(peak,rss);low=min(low,psutil.virtual_memory().available)
            progress=output/'progress.json'
            recent=progress.stat().st_mtime if progress.exists() else start_wall
            if low<PROTOCOL['limits']['emergency_free_bytes']:reason='emergency_memory'
            elif rss>PROTOCOL['limits']['tree_rss_bytes']:reason='tree_memory_limit'
            elif time.perf_counter()-start>600:reason='total_deadline'
            elif progress.exists() and time.time()-recent>45:reason='sample_deadline'
            elif not progress.exists() and time.time()-start_wall>90:reason='initialization_deadline'
            if reason:
                for item in reversed(tree):
                    try:item.kill()
                    except psutil.NoSuchProcess:pass
                break
            time.sleep(.1)
        code=child.wait(timeout=10)
    completed=output/'partial-results.json'
    if completed.exists():
        partial={r['sample_id']:r for r in json.loads(completed.read_text())}
        rows=[partial.get(r['sample_id'],dict(r,reason=reason or 'child_failed')) for r in rows]
    metrics.update(status='PASS' if code==0 else 'PARTIAL',exit_code=code,stop_reason=reason,
                   model_loaded=(output/'loaded.json').exists(),peak_tree_rss_bytes=peak,
                   minimum_available_bytes=low,wall_seconds=time.perf_counter()-start)
    save_results(output,rows,metrics)


def child(folder, output):
    import psutil
    if psutil.virtual_memory().available<MIN_FREE or other_models(psutil):
        raise RuntimeError('Resource gate failed before imports')
    cfg=json.loads((API/'private-data/voice-section8/config-local.json').read_text())
    cache=Path(cfg['wavlm_cache']); pinned=json.loads((cache/'manifest.json').read_text())
    if pinned['revisions']!={'scorer':MODEL_REVISION,'backbone':'c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c','alignment':'2c733782da5604684829819a5eb744c193fe9398'}:
        raise ValueError('Model revision mismatch')
    for path,digest in pinned['files'].items():
        if sha(cache/path)!=digest:raise ValueError('Model hash mismatch')
    sys.path.insert(0,str(API/'ml/wavlm'))
    import torch
    from pipeline import PronunciationAssessorV2
    from worker import decode
    torch.set_num_threads(2)
    if psutil.virtual_memory().available<MIN_FREE:raise RuntimeError('Resource gate failed before loading')
    t=time.perf_counter();assessor=PronunciationAssessorV2(cache,'cpu');assessor._load_models()
    dump(output/'loaded.json',{'initialization_ms':round((time.perf_counter()-t)*1000),
        'pipeline_sha256':sha(API/'ml/wavlm/pipeline.py'),'worker_sha256':sha(API/'ml/wavlm/worker.py'),
        'manifest_sha256':sha(cache/'manifest.json'),'revisions':pinned['revisions']})
    manifest=json.loads((output/'manifest.json').read_text());rows=blocked_rows(manifest,'not_attempted');done=[]
    for record,row in zip(manifest['rows'],rows):
        dump(output/'progress.json',{'sample_id':row['sample_id'],'started_at':time.time()})
        stage='source_validation'
        try:
            if record['audio_check']!='valid':raise ValueError(record['audio_check'])
            path=folder/'source'/record['audio_path']
            if sha(path)!=record['audio_sha256']:raise ValueError('audio_hash_mismatch')
            t=time.perf_counter()
            with tempfile.TemporaryDirectory(prefix='english-validation-') as temporary:
                stage='audio_decode'
                normalized,duration=decode(path,temporary)
                stage='alignment_and_scoring'
                raw=assessor.assess(normalized,record['reference_text'])
            if raw.get('error') or not raw.get('words'):raise ValueError('incomplete_assessment')
            row.update(status='scored',reason=None,model_score=raw['overall_score'],raw_prediction=raw,
                       latency_ms=round((time.perf_counter()-t)*1000),duration_ms=duration)
        except Exception as exc:
            known={'invalid_audio','silent_audio','incomplete_assessment','audio_hash_mismatch',
                   'Incomplete forced alignment','No finite alignment path','Unmapped reference phoneme'}
            code=str(exc) if isinstance(exc,ValueError) and str(exc) in known else type(exc).__name__
            row.update(status='failed',reason=stage+':'+code,model_score=None)
        done.append(row);dump(output/'partial-results.json',done)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['prepare','run','child']);parser.add_argument('--folder',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if args.mode=='prepare':
        args.output.mkdir(parents=True,exist_ok=False);prepare(args.folder,args.output)
    elif args.mode=='run':
        if (args.output/'evaluation.json').exists():raise ValueError('Refusing overwrite of prior evaluation')
        run(args.folder,args.output)
    else:child(args.folder,args.output)


if __name__=='__main__':
    main()
