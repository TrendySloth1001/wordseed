// Runs a generation request end to end: resolves the words, samples many more
// candidates than requested from the chosen engine, filters them, returns the
// ones the engine itself finds most probable, and records where every
// candidate went along the way.
import { getModel, getNeuralModel } from "./corpus";
import { matchesReadability, readingEase } from "./readability";
import type { Engine, Funnel, Run, SentenceMetrics, Settings, Summary, Trace } from "./run-types";
import { saveRun } from "./runs";
import { detokenize, isPunctuation, LENGTHS, type Candidate } from "./text";
import { relatedForms } from "./word-forms";

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

export async function generate(request: GenerateRequest): Promise<Run> {
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
  await saveRun(run, traces);
  return run;
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
