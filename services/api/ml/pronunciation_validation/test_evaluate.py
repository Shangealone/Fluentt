"""Synthetic validation-code tests. They never load a speech model."""
import json
import math
from pathlib import Path
import wave

import pytest

from ml.pronunciation_validation.evaluate import (
    PROTOCOL, REVISION, analyze, association, blocked_rows, prepare, rank, select, sha,
)
from ml.pronunciation_validation.acquire import Download, LIMIT, verify_blob


def population():
    return {f'{s:04d}{i:03d}':f'{s:04d}' for s in range(20) for i in range(4)}


def test_selection_reproducible_and_speaker_balanced():
    a=select(population(),{'train1':'other'})
    assert a==select(dict(reversed(list(population().items()))),{'train1':'other'})
    assert len(a)==30 and len({s for _,s in a})==10
    assert all(sum(v==s for _,v in a)==3 for _,s in a)
    assert a!=select(population(),{'train1':'other'},seed=1)


@pytest.mark.parametrize('train',[{'train1':'0000'},{'0000000':'other'}])
def test_train_test_overlap_rejected(train):
    with pytest.raises(ValueError,match='overlap'):select(population(),train)


def row(i, score, status='scored'):
    return {'sample_id':str(i),'speaker_id':str(i//3),'human_accuracy':i%10,
            'model_score':score,'status':status}


def test_failures_stay_in_coverage_denominator():
    result=analyze([row(1,20),row(2,None,'failed'),row(3,None,'not_run')])
    assert result['selected']==3 and result['scored']==1 and result['not_scored']==2
    assert result['coverage']==1/3 and result['mae'] is None and result['rmse'] is None


def test_no_inference_produces_no_metrics():
    result=analyze([row(1,None,'not_run')])
    assert result['association']=={'pearson':None,'spearman':None}
    assert result['model_score_distribution'] is None


@pytest.mark.parametrize('score',[None,math.nan,math.inf,-1,101])
def test_invalid_success_cannot_enter_analysis(score):
    with pytest.raises(ValueError):analyze([row(1,score)])


def test_tied_ranks():
    assert rank([4,2,2,9])==[3,1.5,1.5,4]


def test_constant_scores_do_not_invent_correlation():
    assert association([row(i,50) for i in range(10)])=={'pearson':None,'spearman':None}


def test_known_association_and_cluster_uncertainty():
    a=analyze([row(i,(i%10)*10) for i in range(30)])
    assert a['association']=={'pearson':1.,'spearman':1.}
    assert a['speaker_bootstrap_95_percent']['pearson']['valid_draws']==2000
    assert a==analyze([row(i,(i%10)*10) for i in range(30)])


def test_no_calibration_evaluation_reuse():
    assert PROTOCOL['calibration_samples']==[] and PROTOCOL['evaluation_only']
    assert 'None' in PROTOCOL['transformation']


def test_blocked_rows_preserve_all_selected_ids():
    manifest={'rows':[{'sample_id':'a','speaker_id':'b','reference_sha256':'c','human_sentence_accuracy':5}]}
    rows=blocked_rows(manifest,'insufficient_memory')
    assert len(rows)==1 and rows[0]['model_score'] is None and rows[0]['reason']=='insufficient_memory'


def test_download_budget_refuses_network_before_request():
    download=Download();download.used=LIMIT
    with pytest.raises(ValueError,match='budget'):download.get('https://invalid.example',1)


def test_bad_original_blob_rejected():
    with pytest.raises(ValueError,match='verification'):verify_blob(b'wrong',5,'0'*40)


def test_low_memory_gate_never_launches_model(tmp_path,monkeypatch):
    import sys
    from types import SimpleNamespace
    from ml.pronunciation_validation import evaluate
    manifest={'rows':[{'sample_id':'a','speaker_id':'b','reference_sha256':'c','human_sentence_accuracy':5}]}
    (tmp_path/'manifest.json').write_text(json.dumps(manifest))
    monkeypatch.setitem(sys.modules,'psutil',SimpleNamespace(virtual_memory=lambda:SimpleNamespace(total=16*1024**3,available=4*1024**3)))
    monkeypatch.setattr(evaluate,'other_models',lambda _:[])
    def forbidden(*args,**kwargs):raise AssertionError('Model process must not start')
    monkeypatch.setattr(evaluate.subprocess,'Popen',forbidden)
    evaluate.run(tmp_path,tmp_path)
    assert json.loads((tmp_path/'resources.json').read_text())['model_loaded'] is False
    result=json.loads((tmp_path/'evaluation.json').read_text())
    assert result[0]['model_score'] is None and result[0]['reason']=='insufficient_memory'


@pytest.fixture
def source(tmp_path):
    root=tmp_path/'source';scores={};details={};ledger=[];test=population()
    for sub in ['test','train','resource']:(root/sub).mkdir(parents=True,exist_ok=True)
    (root/'test/utt2spk').write_text(''.join(f'{u} {s}\n' for u,s in test.items()))
    (root/'train/utt2spk').write_text('train1 other\n')
    (root/'test/text').write_text(''.join(f'{u} HELLO\n' for u in test))
    (root/'test/wav.scp').write_text(''.join(f'{u} WAVE/SPEAKER{s}/{u}.WAV\n' for u,s in test.items()))
    import struct
    for n,(u,s) in enumerate(test.items()):
        path=f'WAVE/SPEAKER{s}/{u}.WAV';target=root/path;target.parent.mkdir(parents=True,exist_ok=True)
        with wave.open(str(target),'wb') as audio:
            audio.setparams((1,2,16000,0,'NONE','not compressed'))
            audio.writeframes(b''.join(struct.pack('<h',int(3000*math.sin((i+n)*.1))) for i in range(8000)))
        ledger.append({'path':path,'sha256':sha(target)})
        scores[u]={'text':'HELLO','accuracy':8,'words':[{'phones':['HH','AH0'],'phones-accuracy':[2,1.8]}]}
        details[u]={'text':'HELLO','accuracy':[7,8,8,9,8]}
    (root/'resource/scores.json').write_text(json.dumps(scores))
    (root/'resource/scores-detail.json').write_text(json.dumps(details))
    (tmp_path/'acquisition.json').write_text(json.dumps({'revision':REVISION,'files':ledger}))
    output=tmp_path/'output';output.mkdir()
    return tmp_path,output


def test_prepare_matches_audio_text_speaker_labels(source):
    folder,output=source;prepare(folder,output)
    manifest=json.loads((output/'manifest.json').read_text())
    assert len(manifest['rows'])==30 and all(r['audio_check']=='valid' for r in manifest['rows'])


@pytest.mark.parametrize('defect',['text','rating','hash','phone'])
def test_prepare_refuses_mismatched_data(source,defect):
    folder,output=source;selected=select(population(),{'train1':'other'})[0][0]
    path=folder/'source/resource/scores.json';scores=json.loads(path.read_text())
    if defect=='text':scores[selected]['text']='WRONG'
    elif defect=='rating':scores[selected]['accuracy']=3
    elif defect=='phone':scores[selected]['words'][0]['phones-accuracy']=[1]
    else:
        speaker=population()[selected]
        (folder/f'source/WAVE/SPEAKER{speaker}/{selected}.WAV').write_bytes(b'bad')
    path.write_text(json.dumps(scores))
    with pytest.raises(ValueError):prepare(folder,output)
