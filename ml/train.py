"""Trains the small LSTM language model used by the app's "Neural" engine.

Every sentence is rewritten around a randomly chosen pivot word:

    pivot, words after it ..., <sep>, words before it in reverse ..., <end>

so the network learns to complete a sentence in both directions from any word.
Run `npm run train:neural`; it writes data/neural/model.json and model.bin,
which src/lib/neural-model.ts loads for inference.
"""

from __future__ import annotations

import json
import math
import os
import random
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

DATA = Path(__file__).resolve().parent.parent / "data" / "neural"

PAD, UNK, SEP, END = 0, 1, 2, 3
SPECIALS = ["<pad>", "<unk>", "<sep>", "<end>"]
PUNCTUATION = set(",;:—.!?")

VOCABULARY = 8000
HIDDEN = 256
MAX_TOKENS = 40
BATCH = 128
EPOCHS = int(os.environ.get("EPOCHS", 12))
DROPOUT = 0.3


class Model(nn.Module):
    def __init__(self, size: int):
        super().__init__()
        self.embedding = nn.Embedding(size, HIDDEN, padding_idx=PAD)
        self.lstm = nn.LSTM(HIDDEN, HIDDEN, batch_first=True)
        self.bias = nn.Parameter(torch.zeros(size))
        self.dropout = nn.Dropout(DROPOUT)

    def forward(self, tokens: torch.Tensor) -> torch.Tensor:
        hidden, _ = self.lstm(self.dropout(self.embedding(tokens)))
        # The output layer shares its weights with the embedding.
        return F.linear(self.dropout(hidden), self.embedding.weight, self.bias)


def pivoted(sentence: list[int], rng: random.Random) -> list[int] | None:
    """Rewrites a sentence around a random real word, or None if it has none."""
    pivots = [i for i, token in enumerate(sentence) if token >= len(SPECIALS) and not is_punctuation[token]]
    if not pivots:
        return None
    pivot = rng.choice(pivots)
    return sentence[pivot:] + [SEP] + sentence[:pivot][::-1] + [END]


def batches(sentences: list[list[int]], rng: random.Random, shuffle: bool):
    examples = [example for sentence in sentences if (example := pivoted(sentence, rng))]
    if shuffle:
        rng.shuffle(examples)
    # Sort chunks by length so each batch needs little padding.
    for start in range(0, len(examples), BATCH * 50):
        chunk = sorted(examples[start : start + BATCH * 50], key=len)
        order = list(range(0, len(chunk), BATCH))
        if shuffle:
            rng.shuffle(order)
        for index in order:
            group = chunk[index : index + BATCH]
            width = max(len(example) for example in group)
            yield torch.tensor([example + [PAD] * (width - len(example)) for example in group])


def loss_of(model: Model, batch: torch.Tensor) -> torch.Tensor:
    logits = model(batch[:, :-1])
    return F.cross_entropy(logits.reshape(-1, logits.size(-1)), batch[:, 1:].reshape(-1), ignore_index=PAD)


torch.manual_seed(0)
rng = random.Random(0)
device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"

lines = [line.split() for line in (DATA / "sentences.txt").read_text().splitlines()]
lines = [line for line in lines if len(line) <= MAX_TOKENS]
counts = Counter(token for line in lines for token in line)
vocabulary = SPECIALS + [token for token, _ in counts.most_common(VOCABULARY - len(SPECIALS))]
ids = {token: index for index, token in enumerate(vocabulary)}
is_punctuation = [token in PUNCTUATION for token in vocabulary]

encoded = [[ids.get(token, UNK) for token in line] for line in lines]
rng.shuffle(encoded)
held_out = encoded[: len(encoded) // 50]
training = encoded[len(encoded) // 50 :]
print(f"{len(training)} training sentences, {len(held_out)} held out, vocabulary {len(vocabulary)}, device {device}")

model = Model(len(vocabulary)).to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=2e-3)
steps = EPOCHS * math.ceil(len(training) / BATCH)
scheduler = torch.optim.lr_scheduler.OneCycleLR(optimizer, max_lr=2e-3, total_steps=steps, pct_start=0.1)

perplexity = float("inf")
for epoch in range(EPOCHS):
    started = time.time()
    model.train()
    for batch in batches(training, rng, shuffle=True):
        optimizer.zero_grad()
        loss = loss_of(model, batch.to(device))
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        if scheduler.last_epoch < steps - 1:
            scheduler.step()

    model.eval()
    with torch.no_grad():
        losses = [loss_of(model, batch.to(device)).item() for batch in batches(held_out, random.Random(1), shuffle=False)]
    perplexity = math.exp(sum(losses) / len(losses))
    print(f"epoch {epoch + 1}/{EPOCHS}: held-out perplexity {perplexity:.1f} ({time.time() - started:.0f}s)", flush=True)

state = {name: tensor.detach().cpu().numpy().astype(np.float32) for name, tensor in model.state_dict().items()}
weights = [
    state["embedding.weight"],
    state["lstm.weight_ih_l0"],
    state["lstm.weight_hh_l0"],
    state["lstm.bias_ih_l0"] + state["lstm.bias_hh_l0"],
    state["bias"],
]
(DATA / "model.bin").write_bytes(b"".join(array.tobytes() for array in weights))
(DATA / "model.json").write_text(
    json.dumps({"vocabulary": vocabulary, "hidden": HIDDEN, "perplexity": round(perplexity, 1)})
)
print(f"saved {sum(array.size for array in weights):,} weights to {DATA}")
