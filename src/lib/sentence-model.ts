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
//
// The same index answers the analysis questions: how probable a sentence is,
// which stretches of it are copied from which source, what else could have
// followed a context, and which words keep similar company.
import { createGrammar, NOT_VERBS, type Grammar } from "./grammar";
import {
  isPunctuation,
  isTerminal,
  normalizeCapitals,
  tokenize,
  type Candidate,
  type Position,
} from "./text";

const START = 0;
const END = 1;

// Interpolation weights used to score a sentence: trigram, bigram, unigram.
const WEIGHTS = [0.5, 0.3, 0.2];
/** probability given to a word the corpus has never seen */
const UNSEEN = 1e-7;
/** a word is "rare" below this many occurrences per million tokens */
const RARE_PER_MILLION = 5;
/** most positions looked at when tallying what surrounds a context */
const SCAN_LIMIT = 20_000;

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

export type Counted = { word: string; count: number };

/** A stretch of a sentence that appears word for word in one source. */
export type Segment = { start: number; length: number; source: string | null };

export type Alternatives = {
  /** how many times the context occurs in the corpus */
  occurrences: number;
  /** the most common words at that spot, with their share of the occurrences */
  options: { word: string; share: number }[];
};

export type WordProfile = {
  word: string;
  count: number;
  perMillion: number;
  /** 1 is the most frequent word in the corpus */
  rank: number;
  variants: string[];
  before: Counted[];
  after: Counted[];
  sources: Counted[];
  similar: string[];
};

export type CorpusStatistics = {
  topWords: Counted[];
  topContentWords: Counted[];
  topPairs: Counted[];
  /** sentence counts per bucket of five words: 1-5, 6-10, ... 46+ */
  sentenceLengths: { label: string; count: number }[];
  averageSentenceLength: number;
  sources: Counted[];
};

type SeedRange = { lo: number; hi: number; shift: number };

export class SentenceModel {
  readonly stats: ModelStats;
  readonly grammar: Grammar;

  private vocabulary: string[] = ["<s>", "</s>"];
  private ids = new Map<string, number>();
  private tokens: Int32Array;
  /** every token position, sorted by the three tokens starting there */
  private order: Int32Array;
  /** first[id] .. first[id + 1] is the slice of `order` whose positions hold `id` */
  private first: Int32Array;
  /** lowercased word -> ids of every casing seen ("rose", "Rose") */
  private lookup = new Map<string, number[]>();
  /** corpus sentences, so generated ones can be checked for novelty */
  private seen = new Set<string>();
  private sourceNames: string[];
  /** token position where each source begins */
  private sourceStarts: number[] = [];
  /** start of the range found by the last find() call */
  private lo = 0;
  private statistics?: CorpusStatistics;
  private ranks?: Map<string, number>;
  private seeds?: string[];

  constructor(texts: string[], names: string[] = texts.map((_, i) => `text ${i + 1}`)) {
    const perText = texts.map(tokenize);
    const sentences = perText.flat();
    normalizeCapitals(sentences);
    this.sourceNames = names;

    const flat: number[] = [];
    for (const group of perText) {
      this.sourceStarts.push(flat.length);
      for (const sentence of group) {
        flat.push(START);
        for (const token of sentence) {
          let id = this.ids.get(token);
          if (id === undefined) {
            id = this.vocabulary.length;
            this.ids.set(token, id);
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
    return this.count(this.lookup.get(word.toLowerCase()) ?? []);
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
          const size = this.find(id, this.ids.get(terminal) ?? -1, 0, 2);
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
      const grown = this.grow(seed, others, options);
      if (!grown) return null;
      return {
        tokens: grown.sequence.slice(1, -1).map((id) => this.vocabulary[id]),
        score: this.averageLogProbability(grown.sequence),
        seed: grown.seed - 1,
        orders: grown.orders.slice(1, -1),
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

  /**
   * Random everyday words that make good seeds: lowercase content words that
   * are neither so rare that few sentences exist nor so common they are dull.
   */
  randomWords(count: number): string[] {
    this.seeds ??= [...this.lookup]
      .filter(([key, variants]) => {
        if (!/^[a-z]{4,10}$/.test(key) || STOPWORDS.has(key) || NOT_VERBS.has(key)) return false;
        if (!variants.some((id) => this.vocabulary[id] === key)) return false;
        const frequency = this.count(variants);
        return frequency >= 40 && frequency <= 4000;
      })
      .map(([key]) => key);
    const picked = new Set<string>();
    while (picked.size < Math.min(count, this.seeds.length)) {
      picked.add(this.seeds[Math.floor(Math.random() * this.seeds.length)]);
    }
    return [...picked];
  }

  // ---------------------------------------------------------------- analysis

  /** How often a sequence of one to three tokens occurs, exactly as written. */
  ngramCount(tokens: string[]): number {
    const [a, b, c] = tokens.map((token) => this.ids.get(token) ?? -1);
    return this.find(a, b ?? 0, c ?? 0, tokens.length);
  }

  /** Word frequency against frequency rank, sampled at log-spaced ranks. */
  rankFrequency(points = 48): { rank: number; count: number }[] {
    const counts = [...this.lookup.values()].map((variants) => this.count(variants)).sort((a, b) => b - a);
    const ranks = new Set<number>();
    for (let i = 0; i < points; i++) {
      ranks.add(Math.round(Math.exp((Math.log(counts.length) * i) / (points - 1))));
    }
    return [...ranks].map((rank) => ({ rank, count: counts[rank - 1] }));
  }

  /** The model's probability of each token given the two before it. */
  probabilities(tokens: string[]): number[] {
    const sequence = this.encode(tokens);
    return tokens.map((_, index) => this.probability(sequence, index + 1));
  }

  /** Perplexity of the sentence under this model: lower means more expected. */
  perplexity(tokens: string[]): number {
    return Math.exp(-this.averageLogProbability(this.encode(tokens)));
  }

  /** Share of the sentence's words that are rare in the corpus. */
  rareShare(tokens: string[]): number {
    const words = tokens.filter((token) => !isPunctuation(token));
    if (words.length === 0) return 0;
    return words.filter((word) => this.isRare(word)).length / words.length;
  }

  isRare(word: string): boolean {
    return this.frequency(word) < (RARE_PER_MILLION * this.tokens.length) / 1_000_000;
  }

  /**
   * Splits the sentence into the longest stretches that appear word for word
   * in the corpus, each with the source it was found in.
   */
  segments(tokens: string[]): Segment[] {
    const sequence = tokens.map((token) => this.ids.get(token) ?? -1);
    const segments: Segment[] = [];
    for (let start = 0; start < sequence.length; ) {
      const match = this.longestMatch(sequence, start);
      segments.push({
        start,
        length: match.length,
        source: match.position === -1 ? null : this.sourceOf(match.position),
      });
      start += match.length;
    }
    return segments;
  }

  /**
   * What the corpus has at the spot of tokens[index], given the `order` words
   * before it (forward) or after it (backward).
   */
  alternatives(tokens: string[], index: number, order: number, forward: boolean): Alternatives {
    const sequence = this.encode(tokens);
    const at = index + 1;
    const context = forward
      ? sequence.slice(at - order, at)
      : sequence.slice(at + 1, at + 1 + order);
    const size = this.find(context[0], context[1] ?? 0, context[2] ?? 0, context.length);
    const lo = this.lo;
    const stride = Math.max(1, Math.ceil(size / SCAN_LIMIT));
    const tally = new Map<number, number>();
    let scanned = 0;
    for (let i = lo; i < lo + size; i += stride) {
      const position = this.order[i];
      const id = this.tokens[forward ? position + order : position - 1];
      tally.set(id, (tally.get(id) ?? 0) + 1);
      scanned++;
    }
    const options = [...tally]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => ({ word: this.label(id), share: count / scanned }));
    return { occurrences: size, options };
  }

  profile(word: string): WordProfile | null {
    const variants = this.lookup.get(word.toLowerCase());
    if (!variants) return null;
    const count = this.count(variants);
    const before = new Map<number, number>();
    const after = new Map<number, number>();
    const sources = new Map<string, number>();
    for (const id of variants) {
      for (let i = this.first[id]; i < this.first[id + 1]; i++) {
        const position = this.order[i];
        const previous = this.tokens[position - 1];
        const next = this.tokens[position + 1];
        before.set(previous, (before.get(previous) ?? 0) + 1);
        after.set(next, (after.get(next) ?? 0) + 1);
        const source = this.sourceOf(position);
        sources.set(source, (sources.get(source) ?? 0) + 1);
      }
    }
    const top = (tally: Map<number, number>): Counted[] =>
      [...tally]
        .filter(([id]) => id > END && !isPunctuation(this.vocabulary[id]))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([id, n]) => ({ word: this.vocabulary[id], count: n }));

    return {
      word: word.toLowerCase(),
      count,
      perMillion: (count * 1_000_000) / this.tokens.length,
      rank: this.rankOf(word.toLowerCase()),
      variants: variants.map((id) => this.vocabulary[id]),
      before: top(before),
      after: top(after),
      sources: [...sources]
        .sort((a, b) => b[1] - a[1])
        .map(([name, n]) => ({ word: name, count: n })),
      similar: this.similar(word),
    };
  }

  /**
   * Words that keep the same company: each is scored by how much of this
   * word's most telling left and right neighbours it shares, weighting a
   * neighbour by its positive pointwise mutual information with the word.
   */
  similar(word: string, limit = 8): string[] {
    const variants = this.lookup.get(word.toLowerCase());
    if (!variants) return [];
    const total = this.tokens.length;
    const own = this.count(variants);

    // Tally the word's neighbours on each side.
    const sides = [new Map<number, number>(), new Map<number, number>()];
    for (const id of variants) {
      const size = this.first[id + 1] - this.first[id];
      const stride = Math.max(1, Math.ceil(size / SCAN_LIMIT));
      for (let i = this.first[id]; i < this.first[id + 1]; i += stride) {
        const position = this.order[i];
        for (const side of [0, 1]) {
          const neighbour = this.tokens[position + (side === 0 ? -1 : 1)];
          sides[side].set(neighbour, (sides[side].get(neighbour) ?? 0) + stride);
        }
      }
    }

    // For each candidate, how much of this word's neighbour weight it matches.
    const matched = new Map<number, number>();
    const shared = new Map<number, number>();
    let ownWeight = 0;
    for (const side of [0, 1]) {
      const features = [...sides[side]]
        .filter(([id, n]) => id > END && n >= 2 && !isPunctuation(this.vocabulary[id]))
        .map(([id, n]) => {
          const occurrences = this.first[id + 1] - this.first[id];
          return { id, occurrences, weight: Math.log((n * total) / (own * occurrences)) };
        })
        .filter((feature) => feature.weight > 0)
        .sort((a, b) => b.weight * Math.log(1 + b.occurrences) - a.weight * Math.log(1 + a.occurrences))
        .slice(0, 40);

      for (const feature of features) {
        ownWeight += feature.weight;
        // Every word found on the other side of this neighbour is a candidate.
        const stride = Math.max(1, Math.ceil(feature.occurrences / 5000));
        const tally = new Map<number, number>();
        for (let i = this.first[feature.id]; i < this.first[feature.id + 1]; i += stride) {
          const candidate = this.tokens[this.order[i] + (side === 0 ? 1 : -1)];
          tally.set(candidate, (tally.get(candidate) ?? 0) + stride);
        }
        for (const [candidate, n] of tally) {
          if (candidate <= END) continue;
          const occurrences = this.first[candidate + 1] - this.first[candidate];
          const weight = Math.log((n * total) / (occurrences * feature.occurrences));
          if (weight <= 0) continue;
          matched.set(candidate, (matched.get(candidate) ?? 0) + Math.min(weight, feature.weight));
          shared.set(candidate, (shared.get(candidate) ?? 0) + 1);
        }
      }
    }

    const best = new Map<string, number>();
    for (const [candidate, weight] of matched) {
      const text = this.vocabulary[candidate];
      const key = text.toLowerCase();
      if (shared.get(candidate)! < 3 || isPunctuation(text) || key === word.toLowerCase()) continue;
      if (STOPWORDS.has(key) || this.first[candidate + 1] - this.first[candidate] < 5) continue;
      const score = weight / ownWeight;
      if (score > (best.get(key) ?? 0)) best.set(key, score);
    }
    return [...best]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key]) => key);
  }

  /** Corpus-wide counts for the statistics page; computed once. */
  corpusStatistics(): CorpusStatistics {
    if (this.statistics) return this.statistics;
    const { tokens, order, vocabulary } = this;
    const isWord = (id: number) => id > END && !isPunctuation(vocabulary[id]);
    const isContent = (id: number) => isWord(id) && !STOPWORDS.has(vocabulary[id].toLowerCase());

    const counts: Counted[] = [];
    for (const [word, variants] of this.lookup) counts.push({ word, count: this.count(variants) });
    counts.sort((a, b) => b.count - a.count);

    // Equal word pairs sit next to each other in the suffix array.
    const pairs: Counted[] = [];
    for (let i = 0; i < order.length; ) {
      const a = tokens[order[i]];
      const b = tokens[order[i] + 1];
      let j = i + 1;
      while (j < order.length && tokens[order[j]] === a && tokens[order[j] + 1] === b) j++;
      if (j - i >= 20 && isContent(a) && isContent(b)) {
        pairs.push({ word: `${vocabulary[a]} ${vocabulary[b]}`, count: j - i });
      }
      i = j;
    }
    pairs.sort((a, b) => b.count - a.count);

    const buckets = new Array<number>(10).fill(0);
    let words = 0;
    for (const id of tokens) {
      if (id === START) words = 0;
      else if (id === END) buckets[Math.min(9, Math.floor(Math.max(0, words - 1) / 5))]++;
      else if (isWord(id)) words++;
    }

    this.statistics = {
      topWords: counts.slice(0, 12),
      topContentWords: counts.filter((entry) => !STOPWORDS.has(entry.word)).slice(0, 12),
      topPairs: pairs.slice(0, 12),
      sentenceLengths: buckets.map((count, index) => ({
        label: index === 9 ? "46+" : `${index * 5 + 1}–${index * 5 + 5}`,
        count,
      })),
      averageSentenceLength:
        counts.reduce((sum, entry) => sum + entry.count, 0) / this.stats.sentences,
      sources: this.sourceNames.map((name, index) => ({
        word: name,
        count: (this.sourceStarts[index + 1] ?? tokens.length) - this.sourceStarts[index],
      })),
    };
    return this.statistics;
  }

  // ---------------------------------------------------------------- internals

  private count(variants: number[]): number {
    return variants.reduce((sum, id) => sum + this.first[id + 1] - this.first[id], 0);
  }

  private label(id: number): string {
    if (id === START) return "(start of sentence)";
    if (id === END) return "(end of sentence)";
    return this.vocabulary[id];
  }

  /** Token ids wrapped in START and END; -1 for a word the corpus lacks. */
  private encode(tokens: string[]): number[] {
    return [START, ...tokens.map((token) => this.ids.get(token) ?? -1), END];
  }

  private sourceOf(position: number): string {
    let index = 0;
    while (index + 1 < this.sourceStarts.length && this.sourceStarts[index + 1] <= position) index++;
    return this.sourceNames[index];
  }

  private rankOf(word: string): number {
    if (!this.ranks) {
      const sorted = [...this.lookup]
        .map(([key, variants]) => ({ key, count: this.count(variants) }))
        .sort((a, b) => b.count - a.count);
      this.ranks = new Map(sorted.map((entry, index) => [entry.key, index + 1]));
    }
    return this.ranks.get(word) ?? 0;
  }

  /**
   * Finds every position where the context (a), (a b) or (a b c) occurs,
   * depending on `n`. Returns how many there are and leaves the start of
   * their range in `order` in this.lo.
   */
  private find(a: number, b: number, c: number, n: number): number {
    const { tokens, order } = this;
    if (a < 0 || (n > 1 && b < 0) || (n > 2 && c < 0)) return 0;
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

  /** The longest run starting at sequence[start] that occurs in the corpus. */
  private longestMatch(sequence: number[], start: number): { length: number; position: number } {
    const a = sequence[start];
    const b = sequence[start + 1] ?? -1;
    const c = sequence[start + 2] ?? -1;
    if (this.find(a, 0, 0, 1) === 0) return { length: 1, position: -1 };
    let best = { length: 1, position: this.order[this.lo] };
    if (this.find(a, b, 0, 2) === 0) return best;
    best = { length: 2, position: this.order[this.lo] };
    const size = this.find(a, b, c, 3);
    if (size === 0) return best;
    // Beyond three words the index no longer helps, so compare directly.
    const lo = this.lo;
    for (let i = lo; i < lo + Math.min(size, 3000); i++) {
      const position = this.order[i];
      let length = 3;
      while (start + length < sequence.length && this.tokens[position + length] === sequence[start + length]) {
        length++;
      }
      if (length > best.length) best = { length, position };
    }
    return best;
  }

  /**
   * Grows a sentence around the token at `seed`, steering towards the `others`
   * words whenever the corpus has them next to the current context. Returns
   * the ids including START and END, how each was chosen, and where the seed
   * ended up; or null if the attempt failed.
   */
  private grow(
    seed: number,
    others: number[][],
    options: SampleOptions,
  ): { sequence: number[]; orders: number[]; seed: number } | null {
    const { tokens } = this;
    // How often a context seen only once is swapped for a shorter one. A
    // unique three-word context can only replay its source sentence.
    const backoff3 = 0.55 + 0.45 * options.creativity;
    const backoff2 = 0.35 * options.creativity;

    const sequence = [tokens[seed - 1], tokens[seed], tokens[seed + 1]];
    const orders = [0, 0, 0];
    // Corpus position each token was taken from, to measure verbatim copying.
    const sources = [seed - 1, seed, seed + 1];
    let seedIndex = 1;
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
          orders.push(10 + offset);
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
      orders.push(n);
    }

    while (sequence[0] !== START) {
      if (sequence.length > options.maxTokens) return null;
      const [a, b, c] = sequence;
      seedIndex++;

      let grabbed = false;
      for (const variants of remaining) {
        for (const id of variants) {
          let size = this.find(id, a, b, 3);
          let matched = 2;
          if (size === 0 || Math.random() > 0.9) {
            size = Math.random() < 0.4 ? this.find(id, a, 0, 2) : 0;
            matched = 1;
          }
          if (size === 0) continue;
          sequence.unshift(id);
          sources.unshift(this.pick(size));
          orders.unshift(10 + matched);
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
        size = this.find(a, b, 0, 2);
        if (size <= 1 && Math.random() < backoff2) {
          n = 1;
          size = this.find(a, 0, 0, 1);
        }
      }
      const position = this.pick(size) - 1;
      sequence.unshift(tokens[position]);
      sources.unshift(position);
      orders.unshift(n);
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

    return { sequence, orders, seed: seedIndex };
  }

  /** Interpolated trigram probability of sequence[i] given the two before it. */
  private probability(sequence: number[], i: number): number {
    const w = sequence[i];
    const b = sequence[i - 1];
    if (w < 0) return UNSEEN;
    let probability = (WEIGHTS[2] * this.find(w, 0, 0, 1)) / this.tokens.length;
    const previous = this.find(b, 0, 0, 1);
    if (previous > 0) probability += (WEIGHTS[1] * this.find(b, w, 0, 2)) / previous;
    if (i > 1) {
      const a = sequence[i - 2];
      const context = this.find(a, b, 0, 2);
      if (context > 0) probability += (WEIGHTS[0] * this.find(a, b, w, 3)) / context;
    }
    return probability;
  }

  /** Average log-probability per token, END included. */
  private averageLogProbability(sequence: number[]): number {
    let total = 0;
    for (let i = 1; i < sequence.length; i++) total += Math.log(this.probability(sequence, i));
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

/** Function words left out of the "content word" lists. */
const STOPWORDS = new Set(
  (
    "the a an and or but nor of to in on at by for with from into as is am are was were be been being " +
    "has have had do does did will would can could shall should may might must not no it its he she " +
    "they we you i me him her them us my your his their our this that these those there here which " +
    "who whom whose what when where why how if than then so such also very more most some any all " +
    "each other one two said about up out over after before between through during many much only " +
    "just because while although though like s t don't it's i'm"
  ).split(" "),
);

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
