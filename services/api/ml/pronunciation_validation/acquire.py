"""Bounded original-source acquisition, not a dataset loader executing remote code.

Use only with the documented OpenSLR CC BY 4.0 attribution. No Hub mirror
relicensing is assumed. This retrieves about 34 MB, not the full corpus.
"""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

from .evaluate import REVISION, SEED, dump, keyed, select

LIMIT = 300*1024**2
BASE = f'https://raw.githubusercontent.com/jimbozhang/speechocean762/{REVISION}/'
METADATA = ['README.md','test/utt2spk','test/text','test/wav.scp','train/utt2spk',
            'test/spk2age','test/spk2gender','resource/scores.json','resource/scores-detail.json']


def verify_blob(data, size, git_hash):
    if len(data)!=size or hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()!=git_hash:
        raise ValueError('Original Git blob verification failed')


class Download:
    def __init__(self):self.used=0

    def get(self, url, maximum):
        if maximum<0 or self.used+maximum>LIMIT:raise ValueError('Download budget exceeded')
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'FLUENTT-research/1'}),timeout=40) as response:
            data=response.read(maximum+1)
        self.used+=len(data)
        if len(data)>maximum:raise ValueError('Response exceeds declared file size')
        return data


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=False)
    downloader=Download();tree_url=f'https://api.github.com/repos/jimbozhang/speechocean762/git/trees/{REVISION}?recursive=1'
    tree=json.loads(downloader.get(tree_url,3_000_000))
    if tree.get('truncated'):raise ValueError('Incomplete file inventory')
    files={x['path']:x for x in tree['tree'] if x['type']=='blob'};ledger=[]
    dump(args.output/'official-tree.json',tree)

    def obtain(path):
        entry=files[path];data=downloader.get(BASE+path,entry['size']);verify_blob(data,entry['size'],entry['sha'])
        target=args.output/'source'/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
        ledger.append({'path':path,'url':BASE+path,'bytes':len(data),'git_blob':entry['sha'],'sha256':hashlib.sha256(data).hexdigest()})

    for path in METADATA:obtain(path)
    source=args.output/'source';chosen=select(keyed(source/'test/utt2spk'),keyed(source/'train/utt2spk'))
    paths=[f'WAVE/SPEAKER{s}/{u}.WAV' for u,s in chosen]
    plan={'revision':REVISION,'seed':SEED,'sample_ids':[u for u,s in chosen],
          'expected_audio_bytes':sum(files[p]['size'] for p in paths),
          'license':'CC BY 4.0 per https://www.openslr.org/101/; preserve source attribution'}
    dump(args.output/'download-plan.json',plan)
    print(json.dumps(plan),flush=True)  # Document bounded audio plan before retrieval.
    for path in paths:obtain(path)
    dump(args.output/'acquisition.json',{'revision':REVISION,'license':'CC BY 4.0','files':ledger})
    print(json.dumps({'downloaded_bytes_including_tree':downloader.used,'limit_bytes':LIMIT}))


if __name__=='__main__':main()
