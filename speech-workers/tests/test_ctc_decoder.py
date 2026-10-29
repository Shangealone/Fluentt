import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wav2vec2.ctc_decoder import prefix_beam_search


def test_ctc_collapses_repeats_but_preserves_blank_separated_label():
    frames = [
        [math.log(p) for p in row]
        for row in [
            [0.01, 0.99],
            [0.01, 0.99],
            [0.99, 0.01],
            [0.01, 0.99],
        ]
    ]
    assert prefix_beam_search(frames, blank_id=0) == [1, 1]
