"""Acoustic-only CTC prefix beam search. No prompt, dictionary or second model."""

import math

NEG_INF = float("-inf")
DECODER_VERSION = "ctc-prefix-beam-v1"
BEAM_WIDTH = 16
TOKEN_TOP_K = 12


def log_add(a, b):
    if a == NEG_INF:
        return b
    if b == NEG_INF:
        return a
    high, low = max(a, b), min(a, b)
    return high + math.log1p(math.exp(low - high))


def prefix_beam_search(
    log_probs,
    blank_id=0,
    beam_width=BEAM_WIDTH,
    token_top_k=TOKEN_TOP_K,
    forbidden_ids=(),
):
    """Sum CTC paths per prefix, tracking blank/nonblank endings separately.

    Acoustic pruning limits each frame to its top-k legal tokens plus blank
    and each active prefix's last token (needed for repeated-label paths).
    Beam pruning makes this an approximation, not exhaustive decoding.
    """
    if beam_width < 1 or token_top_k < 1:
        raise ValueError("Beam width and token top-k must be positive")
    beams = {(): (0.0, NEG_INF)}
    forbidden = set(forbidden_ids) - {blank_id}
    width = None
    for frame in log_probs:
        if width is None:
            width = len(frame)
        if not width or len(frame) != width or not 0 <= blank_id < width:
            raise ValueError("Invalid CTC probability matrix")
        if any(math.isnan(value) or value > 1e-6 for value in frame):
            raise ValueError("Expected finite or negative-infinity log probabilities")
        candidates = sorted(
            (i for i in range(width) if i not in forbidden),
            key=lambda i: (-frame[i], i),
        )[:token_top_k]
        candidates = set(candidates) | {blank_id}
        next_beams = {}

        def add(prefix, blank=NEG_INF, nonblank=NEG_INF, *, beam_map=next_beams):
            old_blank, old_nonblank = beam_map.get(prefix, (NEG_INF, NEG_INF))
            beam_map[prefix] = (
                log_add(old_blank, blank),
                log_add(old_nonblank, nonblank),
            )

        for prefix, (pb, pnb) in beams.items():
            total = log_add(pb, pnb)
            add(prefix, blank=total + frame[blank_id])
            active = candidates | ({prefix[-1]} if prefix else set())
            for token in active:
                if token == blank_id or token in forbidden or frame[token] == NEG_INF:
                    continue
                probability = frame[token]
                if prefix and token == prefix[-1]:
                    # Same label without blank keeps the prefix; a blank-ended
                    # path may emit a genuinely repeated phoneme.
                    add(prefix, nonblank=pnb + probability)
                    add(prefix + (token,), nonblank=pb + probability)
                else:
                    add(prefix + (token,), nonblank=total + probability)
        beams = dict(
            sorted(next_beams.items(), key=lambda item: (-log_add(*item[1]), item[0]))[
                :beam_width
            ]
        )
    return list(min(beams, key=lambda prefix: (-log_add(*beams[prefix]), prefix)))
