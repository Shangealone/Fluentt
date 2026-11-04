"""Resource-scaled Duolingo FIFAKT-derived pilot. Not a paper reproduction or ESR provider.

See PUBLIC_PILOT.md for the upstream reference and declared adaptations.
"""

import math
import torch
from torch import nn
from torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence


class PublicPilotModel(nn.Module):
    def __init__(self, words, lexemes, word_dim=32, item_dim=16, hidden=32):
        super().__init__()
        self.word = nn.Embedding(words, word_dim, padding_idx=0)
        self.item = nn.Embedding(lexemes, item_dim, padding_idx=0)
        self.rnn = nn.LSTM(word_dim + item_dim + 7, hidden, batch_first=True)
        self.head = nn.Sequential(
            nn.Linear(hidden * 2 + word_dim + item_dim + 6, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
        )

    def forward(self, hwords, hitems, features, responses, lengths, word, item, candidate_features):
        embedding = torch.cat([self.word(hwords), self.item(hitems)], -1)
        candidate = torch.cat([self.word(word), self.item(item)], -1)
        inputs = torch.cat([embedding, features, responses.unsqueeze(-1)], -1)
        packed = pack_padded_sequence(inputs, lengths.cpu(), batch_first=True, enforce_sorted=False)
        encoded, (last, _) = self.rnn(packed)
        output, _ = pad_packed_sequence(encoded, batch_first=True, total_length=hwords.shape[1])
        mask = torch.arange(hwords.shape[1], device=hwords.device)[None, :] < lengths[:, None]
        scores = torch.bmm(embedding, candidate.unsqueeze(-1)).squeeze(-1) / math.sqrt(embedding.shape[-1])
        weights = torch.softmax(scores.masked_fill(~mask, -torch.inf), -1)
        context = torch.bmm(weights.unsqueeze(1), output).squeeze(1)
        return self.head(torch.cat([context, last[-1], candidate, candidate_features], -1)).squeeze(-1)
