// The sentence engine: generating a run and explaining its sentences. It only
// needs the two models, not the file system, so the server and the browser
// (when offline) run exactly the same code.
import type { NeuralModel } from "./neural-model";
import { matchesReadability, readingEase } from "./readability";
import type {
  Engine,
  Funnel,
  Run,
  SentenceDetail,
  SentenceMetrics,
  Settings,
  Summary,
  TokenDetail,
  Trace,
} from "./run-types";
import type { SentenceModel } from "./sentence-model";
import { detokenize, isPunctuation, LENGTHS, WORD, type Candidate, type Length, type Position, type Readability } from "./text";
import { relatedForms } from "./word-forms";

/** The neural model loads lazily: only neural runs need it. */
export type Models = { model: SentenceModel; neural: () => Promise<NeuralModel | null> };

/** A run plus the per-sentence traces needed to explain its sentences later. */
export type StoredRun = { run: Run; traces: Trace[] };

const POSITIONS: Position[] = ["any", "start", "middle", "end"];
const ENGINES: Engine[] = ["markov", "neural"];
const READABILITY: Readability[] = ["any", "easy", "hard"];

export const MAX_COUNT: Record<Engine, number> = { markov: 1000, neural: 200 };
export const MAX_WORDS = 3;

export type GenerateRequest = Settings & { words: string[]; count: number; engine: Engine };

export class UnknownWordError extends Error {
  constructor(
    readonly word: string,
    readonly suggestions: string[],
  ) {
    super(`"${word}" never appears in the training corpus, so the model has nothing to build on.`);
  }
}

/**
 * Generates one run. Only the models are needed, so the same code runs on the
 * server and, offline, in the browser.
 */
export async function generateRun(models: Models, request: GenerateRequest): Promise<StoredRun> {
  const { model } = models;
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
  const neural = engine === "neural" ? await models.neural() : null;
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
  const settings: Settings = {
    creativity: request.creativity,
    length: request.length,
    position,
    readability: request.readability,
    grammar: request.grammar,
  };
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

  const funnel: Funnel = {
    sampled: 0,
    abandoned: 0,
    length: 0,
    missingWord: 0,
    position: 0,
    copiedSentence: 0,
    grammar: 0,
    readability: 0,
    duplicate: 0,
    accepted: 0,
    returned: 0,
  };
  const rules = new Map<string, { count: number; example: string }>();

  /** Returns the filter a candidate fails, or null when it passes them all. */
  const rejection = (tokens: string[]): keyof Funnel | null => {
    const spoken = tokens.filter((token) => !isPunctuation(token)).map((token) => token.toLowerCase());
    if (spoken.length < minWords || spoken.length > maxWords) return "length";
    if (!targets.every((target) => spoken.includes(target))) return "missingWord";
    if (position === "start" && spoken[0] !== targets[0]) return "position";
    if (position === "end" && spoken.at(-1) !== targets[0]) return "position";
    if (position === "middle" && !spoken.slice(1, -1).includes(targets[0])) return "position";
    if (model.isCorpusSentence(tokens)) return "copiedSentence";
    if (request.grammar) {
      const { problem } = model.grammar.explain(tokens);
      if (problem) {
        // "two modals: "would can"" and "ends on "the"" group by their rule.
        const rule = problem.split(":")[0].replace(/^ends on .*/, "ends on a dangling word");
        const entry = rules.get(rule);
        if (entry) entry.count++;
        else rules.set(rule, { count: 1, example: detokenize(tokens) });
        return "grammar";
      }
    }
    if (!matchesReadability(readingEase(tokens), request.readability)) return "readability";
    return null;
  };

  const candidates = new Map<string, Candidate>();
  if (!sample) {
    notes.push(`"${words[0]}" never appears at the ${position} of a sentence in the corpus.`);
  } else {
    // Oversample so that ranking has something to choose from. Markov attempts
    // are nearly free; neural ones cost tens of milliseconds each.
    const wanted = engine === "neural" ? Math.ceil(count * 1.5) : count * 4;
    const maxAttempts = engine === "neural" ? count * 6 + 20 : count * 400 + 4000;
    const deadline = Date.now() + (engine === "neural" ? 45_000 : 6_000);

    for (let attempt = 0; attempt < maxAttempts && candidates.size < wanted; attempt++) {
      if (attempt % 16 === 0 && Date.now() > deadline) break;
      funnel.sampled++;
      const candidate = sample();
      if (!candidate) {
        funnel.abandoned++;
        continue;
      }
      const failed = rejection(candidate.tokens);
      if (failed) {
        funnel[failed]++;
        continue;
      }
      const text = detokenize(candidate.tokens);
      if (candidates.has(text)) funnel.duplicate++;
      else candidates.set(text, candidate);
    }
  }
  funnel.accepted = candidates.size;

  const chosen = [...candidates].sort((a, b) => b[1].score - a[1].score).slice(0, count);
  funnel.returned = chosen.length;
  if (sample && chosen.length < count) {
    notes.push(
      chosen.length === 0
        ? "No sentence met these settings. Try a different length or position, or fewer words."
        : `Only ${chosen.length} of the ${count} requested sentences met these settings.`,
    );
  }

  const sentences: SentenceMetrics[] = chosen.map(([text, candidate]) => ({
    text,
    words: candidate.tokens.filter((token) => !isPunctuation(token)).length,
    perplexity: round(model.perplexity(candidate.tokens)),
    // Longest copied stretch, counted in words rather than tokens.
    copied: Math.max(
      ...model
        .segments(candidate.tokens)
        .map(
          ({ start, length }) =>
            candidate.tokens.slice(start, start + length).filter((token) => !isPunctuation(token)).length,
        ),
    ),
    rare: round(model.rareShare(candidate.tokens)),
    readability: round(readingEase(candidate.tokens)),
  }));
  const traces: Trace[] = chosen.map(([, { tokens, seed, orders }]) => ({ tokens, seed, orders }));

  const run: Run = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    time: new Date().toISOString(),
    words,
    engine,
    requested: request.count,
    settings,
    sentences,
    summary: summarise(sentences, traces, funnel, rules),
    notes,
    stats: model.stats,
    ratings: {},
  };
  return { run, traces };
}

function summarise(
  sentences: SentenceMetrics[],
  traces: Trace[],
  funnel: Funnel,
  rules: Map<string, { count: number; example: string }>,
): Summary {
  const average = (pick: (sentence: SentenceMetrics) => number) =>
    sentences.length === 0 ? 0 : round(sentences.reduce((sum, s) => sum + pick(s), 0) / sentences.length);
  const all = traces.flatMap((trace) =>
    trace.tokens.filter((token) => !isPunctuation(token)).map((token) => token.toLowerCase()),
  );
  return {
    averageWords: average((s) => s.words),
    averagePerplexity: average((s) => s.perplexity),
    averageReadability: average((s) => s.readability),
    averageCopied: average((s) => s.copied),
    diversity: all.length === 0 ? 0 : round(new Set(all).size / all.length),
    funnel,
    grammarRules: [...rules]
      .map(([rule, entry]) => ({ rule, ...entry }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Checks a request body from the browser; returns the request or what is wrong with it. */
export function parseGenerateRequest(input: unknown): { request: GenerateRequest } | { error: string } {
  const body: Record<string, unknown> = typeof input === "object" && input !== null ? { ...input } : {};
  const pick = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
    options.includes(value as T) ? (value as T) : fallback;

  const words = Array.isArray(body.words)
    ? body.words.filter((word): word is string => typeof word === "string").map((word) => word.trim())
    : [];
  if (words.length < 1 || words.length > MAX_WORDS || !words.every((word) => WORD.test(word))) {
    return { error: `Enter one to ${MAX_WORDS} words, separated by spaces.` };
  }

  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT.markov) {
    return { error: `Count must be a whole number from 1 to ${MAX_COUNT.markov}.` };
  }

  const creativity = Number(body.creativity ?? 0.5);
  if (!(creativity >= 0 && creativity <= 1)) return { error: "Creativity must be between 0 and 1." };

  return {
    request: {
      words,
      count,
      engine: pick(ENGINES, body.engine, "markov"),
      creativity,
      length: pick(Object.keys(LENGTHS) as Length[], body.length, "any"),
      position: pick(POSITIONS, body.position, "any"),
      readability: pick(READABILITY, body.readability, "any"),
      grammar: body.grammar !== false,
    },
  };
}

/** Explains one sentence of a run: how each token was chosen and how likely it was. */
export async function explainTrace(models: Models, stored: StoredRun, index: number): Promise<SentenceDetail | null> {
  const trace = stored.traces[index];
  if (!trace) return null;
  const { tokens, seed, orders } = trace;
  const { model } = models;
  const { tags, problem } = model.grammar.explain(tokens);

  let details: Pick<TokenDetail, "probability" | "step" | "options" | "occurrences">[];
  if (stored.run.engine === "neural") {
    const neural = await models.neural();
    const replay = neural?.replay(tokens, seed) ?? tokens.map(() => null);
    details = tokens.map((_, i) => ({
      probability: replay[i]?.probability ?? null,
      step:
        i === seed
          ? "Seed word: the network started here."
          : i > seed
            ? "Written left to right, after the seed."
            : "Written right to left, after the rest of the sentence.",
      options: replay[i]?.options ?? [],
      occurrences: null,
    }));
  } else {
    const probabilities = model.probabilities(tokens);
    details = tokens.map((_, i) => {
      const order = orders?.[i] ?? 0;
      if (order === 0) {
        return {
          probability: probabilities[i],
          step:
            i === seed
              ? "Seed word: one occurrence of it was picked at random from the corpus."
              : "Taken together with the seed word from the same place in the corpus.",
          options: [],
          occurrences: null,
        };
      }
      const forward = i > seed;
      const context = order % 10;
      const side = forward ? "before" : "after";
      const { occurrences, options } = model.alternatives(tokens, i, context, forward);
      return {
        probability: probabilities[i],
        step:
          order > 10
            ? `Requested word, pulled in because the corpus has it next to the ${context} word${context === 1 ? "" : "s"} ${side} it.`
            : `Sampled from what the corpus has ${forward ? "after" : "before"} the ${context} word${context === 1 ? "" : "s"} ${side} it.`,
        options,
        occurrences,
      };
    });
  }

  return {
    tokens: tokens.map((text, i) => ({ text, tag: tags[i], rare: tags[i] !== "punct" && model.isRare(text), ...details[i] })),
    seed,
    segments: model.segments(tokens),
    grammarProblem: problem,
  };
}
