"""Read-only verification/figures for the frozen pilot; no fitted transformations.

SVG uses native axes and original observations without jitter or a calibration
line. Standard plotting packages are absent from the installed environments;
stdlib SVG avoids adding dependencies to either speech environment.
"""
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
from html import escape
import json
import math
from pathlib import Path
import statistics

from .evaluate import MODEL_REVISION, analyze, dump, sha

COLORS=['#0072B2','#D55E00','#009E73','#CC79A7','#E69F00',
        '#5B5FC7','#444444','#00A6A6','#A65E2E','#8558A6']


def verify(manifest,rows):
    if [r['sample_id'] for r in rows]!=[r['sample_id'] for r in manifest['rows']]:
        raise ValueError('Cohort missing, reordered or replaced')
    for record,row in zip(manifest['rows'],rows):
        if (record['speaker_id']!=row['speaker_id'] or
            record['reference_sha256']!=row['reference_sha256'] or
            record['human_sentence_accuracy']!=row['human_accuracy'] or
            row['model_revision']!=MODEL_REVISION):
            raise ValueError('Mismatched expert/reference/model provenance')
        if row['status']=='scored':
            raw=row['raw_prediction']
            phones=[p for w in raw['words'] for p in w['phonemes']]
            if (raw['text']!=record['reference_text'] or not phones or
                raw['overall_score']!=row['model_score'] or len(phones)!=raw['n_phonemes'] or
                any(not math.isfinite(p['score']) or not 0<=p['score']<=100 for p in phones) or
                round(statistics.mean(p['score'] for p in phones),1)!=row['model_score']):
                raise ValueError('Incomplete/inconsistent actual prediction')
    return True


def svg_header(width,height,title,subtitle):
    return [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">',
            f'<title>{escape(title)}</title><desc>{escape(subtitle)}</desc>',
            '<rect width="100%" height="100%" fill="white"/>',
            '<style>text{font-family:Segoe UI,Arial,sans-serif;fill:#253348} .tick{font-size:13px} .note{font-size:13px;fill:#526174}</style>',
            f'<text x="64" y="35" font-size="23" font-weight="600">{escape(title)}</text>',
            f'<text x="64" y="61" class="note">{escape(subtitle)}</text>']


def scatter(rows, analysis, target):
    good=[r for r in rows if r['status']=='scored'];speakers=sorted({r['speaker_id'] for r in good})
    s=svg_header(900,660,'WavLM and expert sentence accuracy',
                 f'SpeechOcean762 frozen test pilot | {len(good)} utterances, {len(speakers)} speakers | Native score scales')
    left,top,width,height=95,92,745,385
    for score in range(0,101,20):
        y=top+height*(1-score/100)
        s.extend([f'<line x1="{left}" y1="{y}" x2="{left+width}" y2="{y}" stroke="#E2E7ED"/>',
                  f'<text x="{left-14}" y="{y+5}" text-anchor="end" class="tick">{score}</text>'])
    for score in range(11):
        x=left+width*score/10
        s.extend([f'<line x1="{x}" y1="{top}" x2="{x}" y2="{top+height}" stroke="#EEF1F5"/>',
                  f'<text x="{x}" y="{top+height+24}" text-anchor="middle" class="tick">{score}</text>'])
    for r in good:
        x=left+width*r['human_accuracy']/10;y=top+height*(1-r['model_score']/100)
        s.append(f'<circle cx="{x:.3f}" cy="{y:.3f}" r="5.5" fill="{COLORS[speakers.index(r["speaker_id"])]}" fill-opacity=".8" stroke="white"><title>{r["sample_id"]}: expert={r["human_accuracy"]}, WavLM={r["model_score"]}</title></circle>')
    s.extend([f'<text x="{left+width/2}" y="524" text-anchor="middle" font-size="15">Expert sentence accuracy (0–10)</text>',
              '<text transform="translate(28 290) rotate(-90)" text-anchor="middle" font-size="15">Model mean-phone score (0–100)</text>'])
    for i,speaker in enumerate(speakers):
        x=100+(i%5)*150;y=554+(i//5)*24
        s.extend([f'<circle cx="{x}" cy="{y-4}" r="4.5" fill="{COLORS[i]}"/>',f'<text x="{x+12}" y="{y}" class="tick">Speaker {speaker}</text>'])
    a=analysis['association'];ci=analysis.get('speaker_bootstrap_95_percent')
    s.append(f'<text x="64" y="611" class="note">Pearson r={a["pearson"]:.3f}; Spearman ρ={a["spearman"]:.3f}. Association is not calibrated score agreement.</text>')
    s.append('<text x="64" y="635" class="note">Training-data independence UNVERIFIED. No fitted score conversion or reference identity line.</text></svg>')
    target.write_text('\n'.join(s),encoding='utf-8')


def distributions(rows,target):
    good=[r for r in rows if r['status']=='scored']
    s=svg_header(920,505,'Observed score distributions','Native dimensions shown separately | No score conversion, calibration or error metric')
    panels=[('human_accuracy',1,11,'Expert sentence accuracy (0–10)','#0072B2'),
            ('model_score',10,10,'WavLM mean-phone score (0–100)','#009E73')]
    for k,(field,step,bins,title,color) in enumerate(panels):
        left=80+k*450;top=110;width=350;height=270
        counts=Counter(min(int(r[field]//step),bins-1) for r in good);maxcount=max(counts.values(),default=1)
        for i in range(bins):
            value=counts[i];h=height*value/maxcount;x=left+i*width/bins
            s.append(f'<rect x="{x+2:.2f}" y="{top+height-h:.2f}" width="{width/bins-4:.2f}" height="{h:.2f}" fill="{color}"/>')
            if value:s.append(f'<text x="{x+width/bins/2:.2f}" y="{top+height-h-7:.2f}" text-anchor="middle" class="tick">{value}</text>')
            s.append(f'<text x="{x+width/bins/2:.2f}" y="{top+height+23}" text-anchor="middle" class="tick">{i*step}</text>')
        s.append(f'<text x="{left+width/2}" y="436" text-anchor="middle" font-size="15">{escape(title)}</text>')
    s.append('<text x="64" y="480" class="note">Numbers above bars are recording counts; human categories and model 10-point bins are different units.</text></svg>')
    target.write_text('\n'.join(s),encoding='utf-8')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--run',type=Path,required=True);parser.add_argument('--figures',type=Path,required=True)
    args=parser.parse_args();folder=args.run
    manifest=json.loads((folder/'manifest.json').read_text());rows=json.loads((folder/'evaluation.json').read_text())
    verify(manifest,rows);analysis=analyze(rows)
    if analysis!=json.loads((folder/'analysis.json').read_text()):raise ValueError('Prespecified analysis does not reproduce')
    args.figures.mkdir(parents=True,exist_ok=False)
    groups=defaultdict(list)
    for r in rows:
        if r['status']=='scored':groups[r['speaker_id']].append(r)
    speakers=[{'speaker_id':speaker,'scored':len(items),
               'human_mean':statistics.mean(r['human_accuracy'] for r in items),
               'model_mean':statistics.mean(r['model_score'] for r in items),
               'model_min':min(r['model_score'] for r in items),'model_max':max(r['model_score'] for r in items)}
              for speaker,items in sorted(groups.items())]
    with (folder/'speaker-summary.csv').open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=list(speakers[0]));writer.writeheader();writer.writerows(speakers)
    timings=sorted(r['latency_ms'] for r in rows if r['status']=='scored')
    dump(folder/'postrun-verification.json',{'matching_verified':True,'analysis_reproduced':True,
         'latency_ms':{'min':min(timings),'median':statistics.median(timings),'mean':statistics.mean(timings),
                       'p95_nearest_rank':timings[math.ceil(.95*len(timings))-1],'max':max(timings)},
         'word_predictions':sum(len(r['raw_prediction']['words']) for r in rows if r['status']=='scored'),
         'phone_predictions':sum(r['raw_prediction']['n_phonemes'] for r in rows if r['status']=='scored'),
         'flagged_phones_unvalidated':sum(r['raw_prediction']['n_errors'] for r in rows if r['status']=='scored'),
         'code_sha256':sha(Path(__file__))})
    scatter(rows,analysis,args.figures/'model-vs-expert.svg')
    distributions(rows,args.figures/'score-distributions.svg')


if __name__=='__main__':main()
