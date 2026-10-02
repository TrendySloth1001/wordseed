// Shapes shared by the server and the browser. Types only.
import type { Tag } from "./grammar";
import type { ModelStats, Segment } from "./sentence-model";
import type { Length, Position, Readability } from "./text";

export type Engine = "markov" | "neural";

export type Settings = {
  /** 0 to 1 */
  creativity: number;
  length: Length;
  position: Position;
  readability: Readability;
  grammar: boolean;
};

export type SentenceMetrics = {
  text: string;
  words: number;
  /** under the Markov model, for both engines, so the two can be compared */
  perplexity: number;
  /** longest stretch found word for word in the corpus */
  copied: number;
  /** share of words that are rare in the corpus, 0 to 1 */
  rare: number;
  /** Flesch reading ease */
  readability: number;
};

/** Where every sampled candidate ended up. */
export type Funnel = {
  sampled: number;
  /** the engine gave up: too long, or a requested word could not be reached */
  abandoned: number;
  length: number;
  missingWord: number;
  position: number;
  copiedSentence: number;
  grammar: number;
  readability: number;
  duplicate: number;
  accepted: number;
  returned: number;
};

export type Summary = {
  averageWords: number;
  averagePerplexity: number;
  averageReadability: number;
  averageCopied: number;
  /** distinct words divided by total words across the returned sentences */
  diversity: number;
  funnel: Funnel;
  /** grammar rules that rejected candidates, most frequent first */
  grammarRules: { rule: string; count: number; example: string }[];
};

export type Run = {
  id: string;
  time: string;
  /** the words actually used, after any word-form fallback */
  words: string[];
  engine: Engine;
  requested: number;
  settings: Settings;
  sentences: SentenceMetrics[];
  summary: Summary;
  notes: string[];
  stats: ModelStats;
  /** 1 liked, -1 disliked, keyed by sentence index */
  ratings: Record<number, 1 | -1>;
};

/** How one sentence was produced; kept on disk, never sent with the run. */
export type Trace = { tokens: string[]; seed: number; orders?: number[] };

export type RunListItem = Pick<Run, "id" | "time" | "words" | "engine" | "settings"> & {
  sentences: number;
  liked: number;
  disliked: number;
};

export type TokenDetail = {
  text: string;
  tag: Tag;
  /** the engine's probability for this token; null for the seed of a neural run */
  probability: number | null;
  rare: boolean;
  /** how the token was chosen, in words */
  step: string;
  /** what else the engine could have put here */
  options: { word: string; share: number }[];
  /** corpus occurrences of the context, for Markov steps */
  occurrences: number | null;
};

export type SentenceDetail = {
  tokens: TokenDetail[];
  seed: number;
  segments: Segment[];
  grammarProblem: string | null;
};
