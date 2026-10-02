// Flesch reading ease for a single sentence. Higher is easier: 90+ reads like
// a children's book, below 50 like academic prose.
import { isPunctuation, type Readability } from "./text";

/** Estimates syllables by counting vowel groups, with the usual silent-e fix. */
export function syllables(word: string): number {
  const lower = word.toLowerCase().replace(/[^a-z]/g, "");
  if (lower.length <= 3) return 1;
  const trimmed = lower.replace(/(?:[^laeiouy]es|[^aeiouy]e)$/, "").replace(/^y/, "");
  return Math.max(1, trimmed.match(/[aeiouy]+/g)?.length ?? 1);
}

export function readingEase(tokens: string[]): number {
  const words = tokens.filter((token) => !isPunctuation(token));
  if (words.length === 0) return 0;
  const total = words.reduce((sum, word) => sum + syllables(word), 0);
  return 206.835 - 1.015 * words.length - 84.6 * (total / words.length);
}

export function matchesReadability(score: number, wanted: Readability): boolean {
  if (wanted === "easy") return score >= 70;
  if (wanted === "hard") return score < 50;
  return true;
}
