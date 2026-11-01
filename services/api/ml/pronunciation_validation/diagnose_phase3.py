"""Exploratory saved-output diagnostics; no inference, calibration or score search.

All numeric output is observational. Audio probes are recording descriptors,
not speech segmentation/SNR/quality labels. Strict phone comparison never edits
or force-aligns a reference label to a different expected phone sequence.
"""
import argparse
import ast
from collections import Counter, defaultdict
import copy
import csv
import json
import math
from pathlib import Path
import re
import statistics as stats
import wave

from .evaluate import API, analyze, association, dump, rank, sha
from .summarize_phase2 import verify


def corr(x,y):
    return association([{'human_accuracy':a,'model_score':b} for a,b in zip(x,y)])


def audio_stats(path):
    import numpy as np
    with wave.open(str(path),'rb') as f:
        rate,channels,width=f.getframerate(),f.getnchannels(),f.getsampwidth()
        if (rate,channels,width)!=(16000,1,2):raise ValueError('Unexpected pilot audio format')
        data=f.readframes(f.getnframes())
    samples=np.frombuffer(data,dtype='<i2');x=samples.astype(np.float64)/32768
    if not len(x):raise ValueError('Empty audio')
    return {'duration_seconds':len(x)/rate,'sample_rate':rate,'channels':channels,'sample_width':width,
            'std_amplitude':float(np.std(x)),'rms_amplitude':float(np.sqrt(np.mean(x*x))),
            'peak_amplitude':float(np.max(np.abs(x))),
            'full_scale_fraction':float(np.mean((samples==-32768)|(samples==32767))),
            'zero_fraction':float(np.mean(samples==0)),
            'below_001_fraction':float(np.mean(np.abs(x)<.01))}


def clean_phone(phone):
    return re.sub(r'\d','',phone).lower()


def match_phones(sample,reference_words,predicted_words):
    matched=[];mismatched=[]
    if len(reference_words)!=len(predicted_words):raise ValueError('Word count mismatch')
    for index,(reference,predicted) in enumerate(zip(reference_words,predicted_words)):
        expected=[clean_phone(p) for p in reference['phones']]
        actual=[p['phone'] for p in predicted['phonemes']]
        word_equal=reference['text'].casefold()==predicted['word'].casefold()
        if not word_equal or expected!=actual:
            mismatched.append({'sample_id':sample['sample_id'],'speaker_id':sample['speaker_id'],
                'word_index':index,'word':reference['text'],'human_expected':' '.join(expected),
                'model_expected':' '.join(actual),'reason':'word_or_phone_sequence_difference'})
            continue
        if len(expected)!=len(reference['phones-accuracy']):raise ValueError('Missing human phone ratings')
        for position,(human,phone) in enumerate(zip(reference['phones-accuracy'],predicted['phonemes'])):
            if not 0<=human<=2:raise ValueError('Human phone score outside native scale')
            matched.append({'sample_id':sample['sample_id'],'speaker_id':sample['speaker_id'],
                'word_index':index,'word':reference['text'],'phone_index':position,'phone':actual[position],
                'human_accuracy':human,'model_score':phone['score'],'pherr_prob':phone['pherr_prob'],
                'model_flag':phone['error'],'gop':phone['gop']})
    return matched,mismatched


def write_csv(path,rows):
    if not rows:
        path.write_text('',encoding='utf-8');return
    with path.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)


def leave_speaker_out(rows):
    return [{'excluded_speaker':speaker,'recordings':len(keep),'speakers':len({r['speaker_id'] for r in keep}),
             **association(keep)} for speaker in sorted({r['speaker_id'] for r in rows})
            for keep in [[r for r in rows if r['speaker_id']!=speaker]]]


def local_pure_aligner():
    """Extract only the existing pure alignment function, not torch/model imports."""
    import numpy as np
    tree=ast.parse((API/'ml/wavlm/pipeline.py').read_text(encoding='utf-8'))
    cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='PronunciationAssessorV2')
    node=copy.deepcopy(next(n for n in cls.body if isinstance(n,ast.FunctionDef) and n.name=='_viterbi_align'))
    node.decorator_list=[];module=ast.fix_missing_locations(ast.Module(body=[node],type_ignores=[]))
    namespace={'np':np};exec(compile(module,'existing-local-pure-aligner','exec'),namespace)
    return namespace['_viterbi_align']


def mapping(path):
    tree=ast.parse(path.read_text(encoding='utf-8'))
    return ast.literal_eval(next(n.value for n in tree.body if isinstance(n,ast.Assign)
        and any(isinstance(t,ast.Name) and t.id=='ARPABET_TO_IPA' for t in n.targets)))


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--phase2',type=Path,required=True)
    parser.add_argument('--source',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();out=args.output
    # The evidence root may already contain preservation metadata; no diagnostic overwrite.
    if (out/'diagnostics.json').exists():raise ValueError('Refusing diagnostic overwrite')
    out.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((args.phase2/'manifest.json').read_text());rows=json.loads((args.phase2/'evaluation.json').read_text())
    verify(manifest,rows);baseline=analyze(rows)
    if baseline!=json.loads((args.phase2/'analysis.json').read_text()):raise ValueError('Baseline not reproduced')
    if any(r['status']!='scored' for r in rows):raise ValueError('This frozen diagnostic expects all 30 real outputs')
    human_rank=rank([r['human_accuracy'] for r in rows]);model_rank=rank([r['model_score'] for r in rows])
    diagnostic=[];phones=[];mismatches=[];aggregation=[]
    for r,m,hr,mr in zip(rows,manifest['rows'],human_rank,model_rank):
        path=args.source/m['audio_path']
        if sha(path)!=m['audio_sha256']:raise ValueError('Frozen audio hash mismatch')
        quality=audio_stats(path);prediction=r['raw_prediction'];words=prediction['words']
        flat=[p for w in words for p in w['phonemes']];scores=[p['score'] for p in flat]
        mean=stats.mean(scores);n=len(scores)
        # Descriptive influence only. No alternative-aggregation performance comparison.
        equal_word_mean=stats.mean(w['score'] for w in words)
        diagnostic.append({'sample_id':r['sample_id'],'speaker_id':r['speaker_id'],'human_accuracy':r['human_accuracy'],
            'model_score':r['model_score'],'human_rank':hr,'model_rank':mr,
            'signed_rank_gap':mr-hr,'absolute_rank_gap':abs(mr-hr),
            'word_count':len(words),'phone_count':n,'minimum_phone_score':min(scores),
            'maximum_phone_score':max(scores),'phone_score_sd':stats.pstdev(scores),
            'model_flags':r['raw_prediction']['n_errors'],**quality})
        aggregation.append({'sample_id':r['sample_id'],'speaker_id':r['speaker_id'],'phone_count':n,
            'baseline_phone_mean_unrounded':mean,'equal_word_mean_diagnostic_only':equal_word_mean,
            'equal_word_minus_phone_mean':equal_word_mean-mean,
            'drop_lowest_phone_mean_shift':(mean-min(scores))/(n-1) if n>1 else None,
            'single_phone_0_to_100_max_shift_bound':100/n})
        matched,unmatched=match_phones(r,m['human_words'],words);phones.extend(matched);mismatches.extend(unmatched)
    loso=leave_speaker_out(rows)
    word_matched=len({(p['sample_id'],p['word_index']) for p in phones})
    # Reuse speaker-cluster resampling without presenting these phone observations as independent.
    phone_stats=analyze([dict(p,status='scored') for p in phones])
    vars=['duration_seconds','phone_count','std_amplitude','below_001_fraction','minimum_phone_score']
    relations={v:{'recordings':30,'speakers':10,'absolute_rank_gap_spearman':corr(
        [r['absolute_rank_gap'] for r in diagnostic],[r[v] for r in diagnostic])['spearman']} for v in vars}
    by_speaker=[]
    for speaker in sorted({r['speaker_id'] for r in rows}):
        ds=[r for r in diagnostic if r['speaker_id']==speaker];ps=[p for p in phones if p['speaker_id']==speaker]
        by_speaker.append({'speaker_id':speaker,'recordings':len(ds),
            'mean_absolute_rank_gap':stats.mean(r['absolute_rank_gap'] for r in ds),
            'strict_matched_phones':len(ps),'words_with_sequence_difference':sum(r['speaker_id']==speaker for r in mismatches)})
    inv=mapping(API/'ml/wavlm/pipeline.py');up=mapping(args.source.parent/'train-source.txt')
    observations={
        'evidence':'EXPLORATORY SAVED-OUTPUT DIAGNOSTICS; not improved or independent validation',
        'recordings':len(rows),'speakers':10,'baseline':baseline,
        'human_score_counts':dict(Counter(r['human_accuracy'] for r in rows)),
        'model_unique_scores':len({r['model_score'] for r in rows}),
        'human_unique_scores':len({r['human_accuracy'] for r in rows}),
        'phone_native_score_counts':dict(Counter(p['human_accuracy'] for p in phones)),
        'phone_clipped_boundary_counts':{str(v):sum(p['score']==v for r in rows for w in r['raw_prediction']['words'] for p in w['phonemes']) for v in [0,100]},
        'loso':loso,'exploratory_rank_gap_relationships':relations,
        'strict_phone_comparison':{'matched_words':word_matched,'mismatched_words':len(mismatches),
            'matched_phones':len(phones),'recordings':len({p['sample_id'] for p in phones}),
            'speakers':len({p['speaker_id'] for p in phones}),'metrics':phone_stats,
            'interpretation':'Native goodness association only; no binary error-label mapping, MAE or precision/recall'},
        'inventory_matches_pinned_training_source':inv==up,
        'unknown_observed_phones':sorted({p['phone'] for r in rows for w in r['raw_prediction']['words'] for p in w['phonemes']}-set(inv)),
        'alignment_boundaries_retained':False,'model_inference_rerun':False,
        'inputs_sha256':{str(p):sha(p) for p in [args.phase2/'evaluation.json',args.phase2/'manifest.json',args.phase2/'protocol.json',API/'ml/wavlm/pipeline.py']},
        'script_sha256':sha(Path(__file__)),
    }
    for name,data in [('diagnostic.csv',diagnostic),('aggregation-influence.csv',aggregation),
                      ('strict-phone-pairs.csv',phones),('phone-sequence-differences.csv',mismatches),
                      ('leave-one-speaker-out.csv',loso),('speaker-diagnostics.csv',by_speaker)]:write_csv(out/name,data)
    dump(out/'diagnostics.json',observations)


if __name__=='__main__':main()
