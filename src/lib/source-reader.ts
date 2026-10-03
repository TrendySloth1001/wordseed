// Turns a corpus text into readable paragraphs and finds a phrase in it.

export const PARAGRAPHS_PER_PAGE = 40;

export type Passage = { paragraph: number; start: number; end: number };

/**
 * Splits raw text into paragraphs, undoing hard line wraps and dropping the
 * plain-text markup of the e-books: _italics_ and [Illustration] notes.
 */
export function paragraphs(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((block) => block.replace(/_/g, "").replace(/\s+/g, " ").trim())
    .filter((block) => block !== "" && !/^\[Illustration[^\]]*\]$/.test(block));
}

/**
 * A pattern for the phrase's words in order, whatever punctuation, quotes or
 * capitals the original has between them. The models see tokenised text, so a
 * generated stretch never matches the source character for character.
 */
export function phrasePattern(phrase: string): RegExp | null {
  const words = phrase.match(/[\p{L}\p{N}]+/gu);
  if (!words) return null;
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped.join("[^\\p{L}\\p{N}]+")}(?![\\p{L}\\p{N}])`, "iu");
}

/** The first place the phrase occurs after paragraph `after`, if any. */
export function findPassage(blocks: string[], phrase: string, after = -1): Passage | null {
  const pattern = phrasePattern(phrase);
  if (!pattern) return null;
  for (let paragraph = after + 1; paragraph < blocks.length; paragraph++) {
    const match = pattern.exec(blocks[paragraph]);
    if (match) return { paragraph, start: match.index, end: match.index + match[0].length };
  }
  return null;
}

/** "pride-and-prejudice" -> "Pride and prejudice" */
export function sourceTitle(name: string): string {
  const spaced = name.replace(/[-_]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Chapter titles and the like: short lines that do not end a sentence. */
export function isHeading(block: string): boolean {
  return block.length < 70 && (!/[.!?,;:]["”’)]?$/.test(block) || block === block.toUpperCase());
}
