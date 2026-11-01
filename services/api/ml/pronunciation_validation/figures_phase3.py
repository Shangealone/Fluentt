"""SVG diagnostic figures from saved data; no model, fitting or transformation."""
import argparse
import csv
from html import escape
import json
from pathlib import Path

from .summarize_phase2 import svg_header


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--diagnostics',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=False)
    data=json.loads((args.diagnostics/'diagnostics.json').read_text())
    s=svg_header(920,500,'Leave-one-speaker-out sensitivity',
        'Each point: 27 recordings from 9 speakers | Dotted lines: unchanged 30-recording baseline')
    for column,metric in enumerate(['pearson','spearman']):
        left=150+column*415;width=300;baseline=data['baseline']['association'][metric]
        x=lambda value:left+(value+1)*width/2
        s.append(f'<text x="{left+width/2}" y="92" text-anchor="middle" font-size="17">{metric.title()}</text>')
        for value in [-1,-.5,0,.5,1]:
            s.extend([f'<line x1="{x(value)}" y1="105" x2="{x(value)}" y2="384" stroke="#E2E7ED"/>',
                f'<text x="{x(value)}" y="407" class="tick" text-anchor="middle">{value:g}</text>'])
        s.append(f'<line x1="{x(baseline)}" y1="105" x2="{x(baseline)}" y2="384" stroke="#677489" stroke-dasharray="4 4"/>')
        for i,row in enumerate(data['loso']):
            y=120+i*27;value=row[metric]
            s.append(f'<text x="{left-12}" y="{y+5}" text-anchor="end" class="tick">{row["excluded_speaker"]}</text>')
            s.append(f'<circle cx="{x(value):.3f}" cy="{y}" r="5" fill="#0072B2"><title>Excluded speaker {row["excluded_speaker"]}: {value:.6f}</title></circle>')
    s.append('<text x="64" y="449" class="note">Row labels identify the excluded speaker. All three of that speaker’s recordings are removed together.</text>')
    s.append('<text x="64" y="476" class="note">Sensitivity analysis is exploratory; these dots are not independent replications or confidence intervals.</text></svg>')
    (args.output/'speaker-sensitivity.svg').write_text('\n'.join(s),encoding='utf-8')

    rows=list(csv.DictReader((args.diagnostics/'diagnostic.csv').open()))
    largest=sorted(rows,key=lambda r:float(r['absolute_rank_gap']),reverse=True)[:6]
    s=svg_header(940,505,'Largest relative-ranking disagreements',
        'Post hoc descriptive examples: 6 recordings, 6 speakers | Average ranks for ties, 1 = lowest')
    left,width=330,540;x=lambda value:left+(value+25)*width/50
    for value in [-25,-15,0,15,25]:
        s.append(f'<line x1="{x(value)}" y1="100" x2="{x(value)}" y2="378" stroke="#CAD3DE"/>')
        s.append(f'<text x="{x(value)}" y="403" text-anchor="middle" class="tick">{value:+g}</text>')
    for i,row in enumerate(largest):
        y=126+i*43;gap=float(row['signed_rank_gap']);start=min(x(0),x(gap))
        s.append(f'<text x="310" y="{y-2}" text-anchor="end" class="tick">{row["sample_id"]} · speaker {row["speaker_id"]}</text>')
        s.append(f'<text x="310" y="{y+15}" text-anchor="end" class="note">Human {row["human_accuracy"]}/10 · model {row["model_score"]}/100</text>')
        s.append(f'<rect x="{start:.3f}" y="{y-12}" width="{abs(x(gap)-x(0)):.3f}" height="23" fill="{"#0072B2" if gap>0 else "#D55E00"}"/>')
    s.append('<text x="600" y="437" text-anchor="middle" font-size="15">Model rank minus human rank (positions)</text>')
    s.append('<text x="64" y="478" class="note">Rank gaps are not calibrated score errors. No score conversions, thresholds or improved formulas were fitted.</text></svg>')
    (args.output/'rank-disagreements.svg').write_text('\n'.join(s),encoding='utf-8')


if __name__=='__main__':main()
