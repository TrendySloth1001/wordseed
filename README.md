# Word to sentences

Type one to three words and get any number of sentences containing them. Both
models are trained from scratch on 17 public-domain novels and about 1,100
Simple English Wikipedia articles (2.4 million tokens).

## Run it

```bash
npm install
npm run dev
```

## Models

- **Markov** (`src/lib/sentence-model.ts`): a bidirectional n-gram model over a
  suffix array. It grows a sentence outwards from the seed word using
  three-word contexts, backing off to two and one. Instant, and knows every
  word in the corpus.
- **Neural** (`ml/train.py`, `src/lib/neural-model.ts`): a one-layer LSTM with
  an 8,000-word vocabulary, trained in PyTorch and run in TypeScript. It reaches
  a held-out perplexity of about 64.

Each request samples more candidates than asked for, drops the ones that fail
the length, position, novelty and grammar checks (`src/lib/grammar.ts`), and
returns the highest-scoring ones (`src/lib/generate.ts`).

## Data

```bash
npm run corpus        # re-download the novels and Wikipedia articles
npm run train:neural  # retrain the LSTM (needs Python with torch and numpy)
```

Text files added on the Corpus page are stored in `data/uploads/` and the
Markov model retrains on them automatically. The novels are public domain
(Project Gutenberg); the Wikipedia text is CC BY-SA 4.0.
