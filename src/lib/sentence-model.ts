// A bidirectional Markov (n-gram) sentence model.
//
// Training turns the corpus into one flat array of token ids, with every
// sentence wrapped in START/END markers, and sorts all positions by the three
// tokens that begin there (a suffix array). Every position where a one-, two-
// or three-word context occurs is then one binary search away.
//
// Generation picks a random occurrence of the seed word and grows the sentence
// outwards from it: rightwards until END and leftwards until START. Each step
// samples a word that followed (or preceded) the current three-word context
// somewhere in the corpus, backing off to shorter contexts for variety.
import { createGrammar, NOT_VERBS, type Grammar } from "./grammar";
import { isPunctuation, isTerminal, prepareSentences, type Candidate, type Position } from "./text";

const START = 0;
const END = 1;

// Interpolation weights used to score a sentence: trigram, bigram, unigram.
const WEIGHTS = [0.5, 0.3, 0.2];

export type ModelStats = {
  sentences: number;
  tokens: number;
  vocabulary: number;
};

export type SampleOptions = {
  /** 0 sticks to long contexts, 1 backs off to short ones as often as possible */
  creativity: number;
  /** give up once the sentence has more tokens than this */
  maxTokens: number;
  position: Position;
};

type SeedRange = { lo: number; hi: number; shift: number };

export class SentenceModel {
  readonly stats: ModelStats;
  readonly grammar: Grammar;

  private vocabulary: string[] = ["<s>", "</s>"];
  private tokens: Int32Array;
  /** every token position, sorted by the three tokens starting there */
  private order: Int32Array;
  /** first[id] .. first[id + 1] is the slice of `order` whose positions hold `id` */
  private first: Int32Array;
  /** lowercased word -> ids of every casing seen ("rose", "Rose") */
  private lookup = new Map<string, number[]>();
  /** corpus sentences, so generated ones can be checked for novelty */
  private seen = new Set<string>();
  /** start of the range found by the last find() call */
  private lo = 0;

  constructor(texts: string[]) {
    const sentences = prepareSentences(texts);

    const ids = new Map<string, number>();
    const flat: number[] = [];
    for (const sentence of sentences) {
      flat.push(START);
      for (const token of sentence) {
        let id = ids.get(token);
        if (id === undefined) {
          id = this.vocabulary.length;
          ids.set(token, id);
          this.vocabulary.push(token);
          if (!isPunctuation(token)) {
            const key = token.toLowerCase();
            const variants = this.lookup.get(key);
            if (variants) variants.push(id);
            else this.lookup.set(key, [id]);
          }
        }
        flat.push(id);
      }
      flat.push(END);
      this.seen.add(sentence.join(" ").toLowerCase());
    }

    const tokens = Int32Array.from(flat);
    const length = tokens.length;
    const order = new Int32Array(length);
    for (let i = 0; i < length; i++) order[i] = i;
    order.sort((x, y) => {
      for (let k = 0; k < 3; k++) {
        const a = x + k < length ? tokens[x + k] : -1;
        const b = y + k < length ? tokens[y + k] : -1;
        if (a !== b) return a - b;
      }
      return 0;
    });

    const first = new Int32Array(this.vocabulary.length + 1);
    for (let i = 0; i < length; i++) first[tokens[i] + 1]++;
    for (let id = 0; id < this.vocabulary.length; id++) first[id + 1] += first[id];

    this.tokens = tokens;
    this.order = order;
    this.first = first;
    this.grammar = createGrammar(this.learnVerbs());
    this.stats = {
      sentences: sentences.length,
      tokens: length - 2 * sentences.length,
      vocabulary: this.lookup.size,
    };
  }

  has(word: string): boolean {
    return this.lookup.has(word.toLowerCase());
  }

  /** How many times the word occurs in the corpus, in any casing. */
  frequency(word: string): number {
    const ids = this.lookup.get(word.toLowerCase()) ?? [];
    return ids.reduce((sum, id) => sum + this.first[id + 1] - this.first[id], 0);
  }

  /** Whether these tokens are, word for word, a sentence of the corpus. */
  isCorpusSentence(tokens: string[]): boolean {
    return this.seen.has(tokens.join(" ").toLowerCase());
  }

  /**
   * Returns a function that samples one sentence containing every word, or
   * null when the first word never occurs at the requested position.
   * The sampler itself returns null when an attempt does not work out.
   */
  sampler(words: string[], options: SampleOptions): (() => Candidate | null) | null {
    const targets = words.map((word) => this.lookup.get(word.toLowerCase()) ?? []);
    if (targets.some((variants) => variants.length === 0)) return null;

    // Seed from the rarest word: the others are easier to reach from it.
    const anchor =
      options.position === "any"
        ? targets.reduce((a, b) => (this.count(a) <= this.count(b) ? a : b))
        : targets[0];
    const others = targets.filter((variants) => variants !== anchor);

    const seeds: SeedRange[] = [];
    for (const id of anchor) {
      if (options.position === "start") {
        const size = this.find(START, id, 0, 2);
        if (size > 0) seeds.push({ lo: this.lo, hi: this.lo + size, shift: 1 });
      } else if (options.position === "end") {
        for (const terminal of [".", "!", "?"]) {
          const terminalId = this.vocabulary.indexOf(terminal);
          const size = terminalId === -1 ? 0 : this.find(id, terminalId, 0, 2);
          if (size > 0) seeds.push({ lo: this.lo, hi: this.lo + size, shift: 0 });
        }
      } else {
        seeds.push({ lo: this.first[id], hi: this.first[id + 1], shift: 0 });
      }
    }
    const total = seeds.reduce((sum, range) => sum + range.hi - range.lo, 0);
    if (total === 0) return null;

    return () => {
      let index = Math.floor(Math.random() * total);
      let seed = 0;
      for (const range of seeds) {
        if (index < range.hi - range.lo) {
          seed = this.order[range.lo + index] + range.shift;
          break;
        }
        index -= range.hi - range.lo;
      }
      const sequence = this.grow(seed, others, options);
      if (!sequence) return null;
      return {
        tokens: sequence.slice(1, -1).map((id) => this.vocabulary[id]),
        score: this.score(sequence),
      };
    };
  }

  /** Closest known words to an unknown one, most frequent first. */
  suggest(word: string, limit = 6): string[] {
    const target = word.toLowerCase();
    const maxDistance = target.length <= 4 ? 1 : 2;
    const scored: { word: string; distance: number; frequency: number }[] = [];
    for (const candidate of this.lookup.keys()) {
      if (Math.abs(candidate.length - target.length) > maxDistance) continue;
      const distance = editDistance(target, candidate, maxDistance);
      if (distance > maxDistance) continue;
      scored.push({ word: candidate, distance, frequency: this.frequency(candidate) });
    }
    scored.sort((a, b) => a.distance - b.distance || b.frequency - a.frequency);
    return scored.slice(0, limit).map((entry) => entry.word);
  }

  private count(variants: number[]): number {
    return variants.reduce((sum, id) => sum + this.first[id + 1] - this.first[id], 0);
  }

  /**
   * Finds every position where the context (a), (a b) or (a b c) occurs,
   * depending on `n`. Returns how many there are and leaves the start of
   * their range in `order` in this.lo.
   */
  private find(a: number, b: number, c: number, n: number): number {
    const { tokens, order } = this;
    let lo = this.first[a];
    let hi = this.first[a + 1];
    for (let depth = 1; depth < n; depth++) {
      const want = depth === 1 ? b : c;
      // Positions near the very end of the corpus have no token this deep.
      const at = (index: number) => {
        const position = order[index] + depth;
        return position < tokens.length ? tokens[position] : -1;
      };
      let left = lo;
      let right = hi;
      while (left < right) {
        const mid = (left + right) >> 1;
        if (at(mid) < want) left = mid + 1;
        else right = mid;
      }
      const start = left;
      right = hi;
      while (left < right) {
        const mid = (left + right) >> 1;
        if (at(mid) <= want) left = mid + 1;
        else right = mid;
      }
      lo = start;
      hi = left;
      if (lo === hi) break;
    }
    this.lo = lo;
    return hi - lo;
  }

  private pick(size: number): number {
    return this.order[this.lo + Math.floor(Math.random() * size)];
  }

  /**
   * Grows a sentence around the token at `seed`, steering towards the `others`
   * words whenever the corpus has them next to the current context. Returns
   * the ids including START and END, or null if the attempt failed.
   */
  private grow(seed: number, others: number[][], options: SampleOptions): number[] | null {
    const { tokens } = this;
    // How often a context seen only once is swapped for a shorter one. A
    // unique three-word context can only replay its source sentence.
    const backoff3 = 0.55 + 0.45 * options.creativity;
    const backoff2 = 0.35 * options.creativity;

    const sequence = [tokens[seed - 1], tokens[seed], tokens[seed + 1]];
    // Corpus position each token was taken from, to measure verbatim copying.
    const sources = [seed - 1, seed, seed + 1];
    let remaining = others.filter(
      (variants) => !variants.includes(sequence[0]) && !variants.includes(sequence[2]),
    );

    while (sequence[sequence.length - 1] !== END) {
      if (sequence.length > options.maxTokens) return null;
      const a = sequence[sequence.length - 3];
      const b = sequence[sequence.length - 2];
      const c = sequence[sequence.length - 1];

      let grabbed = false;
      for (const variants of remaining) {
        for (const id of variants) {
          let size = this.find(b, c, id, 3);
          let offset = 2;
          if (size === 0 || Math.random() > 0.9) {
            size = Math.random() < 0.4 ? this.find(c, id, 0, 2) : 0;
            offset = 1;
          }
          if (size === 0) continue;
          sequence.push(id);
          sources.push(this.pick(size) + offset);
          remaining = remaining.filter((other) => other !== variants);
          grabbed = true;
          break;
        }
        if (grabbed) break;
      }
      if (grabbed) continue;

      let n = 3;
      let size = this.find(a, b, c, 3);
      if (size <= 1 && Math.random() < backoff3) {
        n = 2;
        size = this.find(b, c, 0, 2);
        if (size <= 1 && Math.random() < backoff2) {
          n = 1;
          size = this.find(c, 0, 0, 1);
        }
      }
      const position = this.pick(size) + n;
      sequence.push(tokens[position]);
      sources.push(position);
    }

    while (sequence[0] !== START) {
      if (sequence.length > options.maxTokens) return null;
      const [a, b, c] = sequence;

      let grabbed = false;
      for (const variants of remaining) {
        for (const id of variants) {
          let size = this.find(id, a, b, 3);
          if (size === 0 || Math.random() > 0.9) {
            size = Math.random() < 0.4 ? this.find(id, a, 0, 2) : 0;
          }
          if (size === 0) continue;
          sequence.unshift(id);
          sources.unshift(this.pick(size));
          remaining = remaining.filter((other) => other !== variants);
          grabbed = true;
          break;
        }
        if (grabbed) break;
      }
      if (grabbed) continue;

      let size = this.find(a, b, c, 3);
      if (size <= 1 && Math.random() < backoff3) {
        size = this.find(a, b, 0, 2);
        if (size <= 1 && Math.random() < backoff2) size = this.find(a, 0, 0, 1);
      }
      const position = this.pick(size) - 1;
      sequence.unshift(tokens[position]);
      sources.unshift(position);
    }

    if (remaining.length > 0) return null;

    // Reject sentences that are mostly one long stretch lifted from a book.
    let run = 1;
    let longest = 1;
    for (let i = 1; i < sources.length; i++) {
      run = sources[i] === sources[i - 1] + 1 ? run + 1 : 1;
      if (run > longest) longest = run;
    }
    if (longest > Math.max(7, Math.ceil(sequence.length * 0.6))) return null;

    return sequence;
  }

  /** Average log-probability per token under an interpolated trigram model. */
  private score(sequence: number[]): number {
    let total = 0;
    for (let i = 1; i < sequence.length; i++) {
      const w = sequence[i];
      const b = sequence[i - 1];
      let probability = (WEIGHTS[2] * this.find(w, 0, 0, 1)) / this.tokens.length;
      probability += (WEIGHTS[1] * this.find(b, w, 0, 2)) / this.find(b, 0, 0, 1);
      if (i > 1) {
        const a = sequence[i - 2];
        const context = this.find(a, b, 0, 2);
        if (context > 0) probability += (WEIGHTS[0] * this.find(a, b, w, 3)) / context;
      }
      total += Math.log(probability);
    }
    return total / (sequence.length - 1);
  }

  /**
   * Learns which words are verbs from the corpus itself: the word after a
   * modal ("would go", "can see") is almost always a verb in its base form.
   */
  private learnVerbs(): string[] {
    const { tokens, order, first } = this;
    const after = new Map<number, number>();
    for (const modal of ["will", "would", "can", "could", "shall", "should", "may", "might", "must"]) {
      for (const id of this.lookup.get(modal) ?? []) {
        for (let i = first[id]; i < first[id + 1]; i++) {
          const next = tokens[order[i] + 1];
          after.set(next, (after.get(next) ?? 0) + 1);
        }
      }
    }
    const verbs: string[] = [];
    for (const [id, count] of after) {
      const word = this.vocabulary[id];
      if (count < 2 || id <= END || isPunctuation(word) || isTerminal(word)) continue;
      if (word !== word.toLowerCase() || NOT_VERBS.has(word) || word.endsWith("ly")) continue;
      verbs.push(word);
    }
    return verbs;
  }
}

/** Levenshtein distance, giving up early once it must exceed `max`. */
function editDistance(a: string, b: string, max: number): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}
