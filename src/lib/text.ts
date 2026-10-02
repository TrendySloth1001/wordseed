// Tokenisation and the settings shared by both sentence engines.

export type Length = "any" | "short" | "medium" | "long";
export type Position = "any" | "start" | "middle" | "end";
export type Readability = "any" | "easy" | "hard";

/**
 * A generated sentence as tokens, with the engine's own probability score.
 * `seed` is the index of the token generation started from. `orders` records,
 * for the Markov engine, how each token was chosen: 0 for the seed and its two
 * neighbours, 1 to 3 for the number of context words used, and 11 or 12 when
 * a requested word was pulled in after one or two matching context words.
 */
export type Candidate = { tokens: string[]; score: number; seed: number; orders?: number[] };

/** Allowed number of words (punctuation not counted) for each length setting. */
export const LENGTHS: Record<Length, [min: number, max: number]> = {
  any: [4, 30],
  short: [3, 8],
  medium: [9, 16],
  long: [17, 32],
};

export const WORD = /^[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*$/u;

const ABBREVIATIONS = /\b(Mr|Mrs|Ms|Dr|St|Mt|Jr|Sr|Prof|Capt|Col|Gen|Rev|Hon|Messrs)\./g;
const TOKEN = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*|[,;:—]/gu;
const SENTENCE = /[^.!?]+[.!?]+/g;
const PUNCTUATION = /^[,;:—.!?]$/;
const TERMINAL = /^[.!?]$/;

export function isPunctuation(token: string): boolean {
  return PUNCTUATION.test(token);
}

export function isTerminal(token: string): boolean {
  return TERMINAL.test(token);
}

/** Splits raw text into sentences, each a list of word and punctuation tokens. */
export function tokenize(text: string): string[][] {
  const sentences: string[][] = [];
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”"_*()[\]]/g, "")
    .replace(/--+|—|–/g, " — ")
    .replace(ABBREVIATIONS, "$1");

  for (const block of cleaned.split(/\n\s*\n/)) {
    const paragraph = block.replace(/\s+/g, " ").trim();
    const pieces = paragraph.match(SENTENCE);
    if (!pieces) continue;

    // "What!" he cried. -> the lowercase continuation belongs to one sentence.
    const merged: string[] = [];
    for (const piece of pieces) {
      const trimmed = piece.trim();
      if (merged.length > 0 && /^[a-z]/.test(trimmed)) {
        merged[merged.length - 1] += " " + trimmed;
      } else {
        merged.push(trimmed);
      }
    }

    for (const sentence of merged) {
      if (!/[a-z]/.test(sentence)) continue; // headings such as "CHAPTER I."
      if (/[^\u0000-\u024F\u2014]/.test(sentence)) continue; // non-Latin scripts
      const body = sentence.replace(/[.!?]+$/, "");
      const words = body.replace(/[.!?]+/g, ",").match(TOKEN);
      if (!words || words.length < 3 || words.length > 80) continue;
      const terminal = sentence[body.length];
      words.push(terminal === "!" || terminal === "?" ? terminal : ".");
      sentences.push(words);
    }
  }
  return sentences;
}

/**
 * Normalises sentence-initial capitals in place: a capital at the start of a
 * sentence says nothing about the word itself, so it is only kept when the
 * word is never seen lowercased mid-sentence.
 */
export function normalizeCapitals(sentences: string[][]): void {
  const midSentence = new Set<string>();
  for (const sentence of sentences) {
    for (let i = 1; i < sentence.length; i++) midSentence.add(sentence[i]);
  }
  for (const sentence of sentences) {
    const first = sentence[0];
    const lower = first.toLowerCase();
    if (first !== "I" && !first.startsWith("I'")) {
      if (midSentence.has(lower) || !midSentence.has(first)) sentence[0] = lower;
    }
  }
}

/** Tokenises every text into one list of sentences with capitals normalised. */
export function prepareSentences(texts: string[]): string[][] {
  const sentences = texts.flatMap(tokenize);
  normalizeCapitals(sentences);
  return sentences;
}

export function detokenize(tokens: string[]): string {
  let text = "";
  for (const token of tokens) {
    if (text === "" || /^[,;:.!?]$/.test(token)) text += token;
    else text += " " + token;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}
