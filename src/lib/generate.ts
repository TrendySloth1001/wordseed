// Runs a generation request end to end: resolves the words, samples many more
// candidates than requested from the chosen engine, filters them and returns
// the ones the engine itself finds most probable.
import { getModel, getNeuralModel } from "./corpus";
import type { ModelStats } from "./sentence-model";
import {
  detokenize,
  isPunctuation,
  LENGTHS,
  type Candidate,
  type Length,
  type Position,
} from "./text";
import { relatedForms } from "./word-forms";

export type Engine = "markov" | "neural";

export const MAX_COUNT: Record<Engine, number> = { markov: 1000, neural: 200 };
export const MAX_WORDS = 3;

export type GenerateRequest = {
  words: string[];
  count: number;
  engine: Engine;
  /** 0 to 1 */
  creativity: number;
  length: Length;
  position: Position;
  grammar: boolean;
};

export type GenerateResponse = {
  /** the words actually used, after any word-form fallback */
  words: string[];
  engine: Engine;
  requested: number;
  sentences: string[];
  notes: string[];
  stats: ModelStats;
};

export class UnknownWordError extends Error {
  constructor(
    readonly word: string,
    readonly suggestions: string[],
  ) {
    super(`"${word}" never appears in the training corpus, so the model has nothing to build on.`);
  }
}

export async function generate(request: GenerateRequest): Promise<GenerateResponse> {
  const model = await getModel();
  const notes: string[] = [];

  const words: string[] = [];
  for (const word of request.words) {
    let used = word;
    if (!model.has(word)) {
      // Fall back to the most common related form: running -> run.
      const forms = relatedForms(word).filter((form) => model.has(form));
      if (forms.length === 0) throw new UnknownWordError(word, model.suggest(word));
      used = forms.reduce((a, b) => (model.frequency(b) > model.frequency(a) ? b : a));
      notes.push(`"${word}" is not in the corpus, so its form "${used}" was used instead.`);
    }
    if (!words.some((other) => other.toLowerCase() === used.toLowerCase())) words.push(used);
  }

  let engine = request.engine;
  const neural = engine === "neural" ? await getNeuralModel() : null;
  if (engine === "neural") {
    const missing = words.filter((word) => !neural?.has(word));
    if (!neural) {
      engine = "markov";
      notes.push("The neural model has not been trained yet (npm run train:neural), so the Markov model was used.");
    } else if (missing.length > 0) {
      engine = "markov";
      notes.push(
        `The neural model only knows the ${neural.vocabulary.length.toLocaleString("en")} most common words and ` +
          `"${missing[0]}" is not one of them, so the Markov model was used.`,
      );
    }
  }

  const count = Math.min(request.count, MAX_COUNT[engine]);
  if (count < request.count) {
    notes.push(`The ${engine} model returns at most ${count} sentences per request.`);
  }

  // Position only makes sense for one word; with several it is left free.
  const position = words.length === 1 ? request.position : "any";
  const [minWords, maxWords] = LENGTHS[request.length];
  const maxTokens = Math.ceil(maxWords * 1.4) + 2;
  const targets = words.map((word) => word.toLowerCase());

  let sample: (() => Candidate | null) | null;
  if (engine === "neural") {
    const temperature = 0.5 + 0.7 * request.creativity;
    sample = () => neural!.sample(words, { temperature, maxTokens, position });
  } else {
    sample = model.sampler(words, { creativity: request.creativity, maxTokens, position });
  }
  if (!sample) {
    notes.push(`"${words[0]}" never appears at the ${position} of a sentence in the corpus.`);
    return { words, engine, requested: request.count, sentences: [], notes, stats: model.stats };
  }

  const accept = (tokens: string[]): boolean => {
    const spoken = tokens.filter((token) => !isPunctuation(token)).map((token) => token.toLowerCase());
    if (spoken.length < minWords || spoken.length > maxWords) return false;
    if (!targets.every((target) => spoken.includes(target))) return false;
    if (position === "start" && spoken[0] !== targets[0]) return false;
    if (position === "end" && spoken.at(-1) !== targets[0]) return false;
    if (position === "middle" && !spoken.slice(1, -1).includes(targets[0])) return false;
    if (model.isCorpusSentence(tokens)) return false;
    return !request.grammar || model.grammar.check(tokens);
  };

  // Oversample so that ranking has something to choose from. Markov attempts
  // are nearly free; neural ones cost tens of milliseconds each.
  const wanted = engine === "neural" ? Math.ceil(count * 1.5) : count * 4;
  const maxAttempts = engine === "neural" ? count * 6 + 20 : count * 400 + 4000;
  const deadline = Date.now() + (engine === "neural" ? 45_000 : 6_000);

  const candidates = new Map<string, number>();
  for (let attempt = 0; attempt < maxAttempts && candidates.size < wanted; attempt++) {
    if (attempt % 16 === 0 && Date.now() > deadline) break;
    const candidate = sample();
    if (candidate && accept(candidate.tokens)) {
      candidates.set(detokenize(candidate.tokens), candidate.score);
    }
  }

  const sentences = [...candidates]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([text]) => text);
  if (sentences.length < count) {
    notes.push(
      sentences.length === 0
        ? "No sentence met these settings. Try a different length or position, or fewer words."
        : `Only ${sentences.length} of the ${count} requested sentences met these settings.`,
    );
  }

  return { words, engine, requested: request.count, sentences, notes, stats: model.stats };
}
