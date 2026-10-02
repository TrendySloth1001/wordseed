// A small rule-based grammar check. Each token gets a coarse part-of-speech
// tag from closed-class word lists plus a verb lexicon, and a sentence is
// rejected when it has no verb or contains a sequence that is never valid
// English ("the of", "would can", ending on "and"...). It is a filter for
// obvious breakage, not a parser.
import { isPunctuation, isTerminal } from "./text";
import { inflect, IRREGULAR_VERBS } from "./word-forms";

export type Tag =
  | "det"
  | "poss"
  | "coord"
  | "subord"
  | "subject"
  | "be"
  | "aux"
  | "modal"
  | "prep"
  | "to"
  | "verb"
  | "punct"
  | "other";

const words = (list: string) => new Set(list.split(" "));

const DETERMINERS = words("the a an every");
const POSSESSIVES = words("my your our their its");
const COORDINATORS = words("and or but nor");
const SUBORDINATORS = words("because although unless if than whether while though");
const SUBJECTS = words("i he she we they");
const BE_FINITE = words("is am are was were");
const AUXILIARIES = words("be been being has have had having do does did");
const MODALS = words("will would can could shall should may might must cannot");
const PREPOSITIONS = words("of from into with at");
const CONTRACTION = /(n't|'m|'re|'ve|'ll|'d)$|^(he|she|it|that|there|what|who|here|let|where)'s$/;
const REPEATABLE = words("had that very so");
/** words that can follow a modal without being a verb */
export const NOT_VERBS = words(
  "not never also always ever only just still soon even often then now perhaps probably all both " +
    "either rather scarcely hardly therefore however well easily really almost once again there " +
    "here so too very quite much more most less no yes you i he she we they it me him her us them " +
    "this that these those the a an and or but if as in on at by for of to with from",
);

export type Grammar = {
  /** The tag of every token, and the first rule the sentence breaks (if any). */
  explain(tokens: string[]): { tags: Tag[]; problem: string | null };
  check(tokens: string[]): boolean;
};

/**
 * `baseVerbs` are verbs in their base form ("walk", "consider"); every regular
 * and irregular inflection of them is treated as a verb too.
 */
export function createGrammar(baseVerbs: Iterable<string>): Grammar {
  const verbs = new Set<string>(IRREGULAR_VERBS.flat());
  for (const base of baseVerbs) {
    verbs.add(base);
    for (const form of inflect(base)) verbs.add(form);
  }

  function tag(token: string): Tag {
    if (isPunctuation(token)) return "punct";
    const word = token.toLowerCase();
    if (DETERMINERS.has(word)) return "det";
    if (POSSESSIVES.has(word)) return "poss";
    if (COORDINATORS.has(word)) return "coord";
    if (SUBORDINATORS.has(word)) return "subord";
    if (SUBJECTS.has(word)) return "subject";
    if (BE_FINITE.has(word)) return "be";
    if (AUXILIARIES.has(word) || CONTRACTION.test(word)) return "aux";
    if (MODALS.has(word)) return "modal";
    if (PREPOSITIONS.has(word)) return "prep";
    if (word === "to") return "to";
    if (verbs.has(word) || (word.length > 4 && word.endsWith("ed"))) return "verb";
    return "other";
  }

  function problem(tokens: string[], tags: Tag[]): string | null {
    if (tags[0] === "punct") return "starts with punctuation";
    if (!tags.some((t) => t === "verb" || t === "be" || t === "aux" || t === "modal")) {
      return "no verb";
    }

    // What the sentence ends on, ignoring the final full stop.
    const lastIndex = isTerminal(tokens.at(-1)!) ? tokens.length - 2 : tokens.length - 1;
    const last = tags[lastIndex];
    if (last === "det" || last === "poss" || last === "coord" || last === "subord" || last === "punct") {
      return `ends on "${tokens[lastIndex]}"`;
    }
    if (tokens[lastIndex].toLowerCase() === "very") return 'ends on "very"';

    for (let i = 0; i < lastIndex; i++) {
      const current = tags[i];
      const next = tags[i + 1];
      const word = tokens[i].toLowerCase();
      const following = tokens[i + 1].toLowerCase();
      const pair = `"${tokens[i]} ${tokens[i + 1]}"`;

      if (current === "punct" && next === "punct") return "doubled punctuation";
      if (word === following && !REPEATABLE.has(word)) return "repeated word";
      if (word === "a" && /^[aeio]/.test(following) && !following.startsWith("one")) {
        return '"a" before a vowel';
      }
      if (word === "an" && /^[^aeiouh]/.test(following)) return '"an" before a consonant';

      const functional =
        next === "det" || next === "coord" || next === "be" || next === "modal" || next === "punct";
      if (current === "det" && (functional || next === "prep" || next === "to" || next === "poss" || next === "subject")) {
        return `determiner with no noun: ${pair}`;
      }
      if (current === "poss" && (functional || next === "prep" || next === "subject")) {
        return `possessive with no noun: ${pair}`;
      }
      if (current === "modal" && next === "modal") return `two modals: ${pair}`;
      if (current === "subject" && next === "subject") return `two subjects: ${pair}`;
      if (current === "coord" && next === "coord") return `two conjunctions: ${pair}`;
      if (current === "be" && next === "be") return `two forms of "be": ${pair}`;
      if (current === "prep" && (next === "be" || next === "modal")) {
        return `preposition before a verb: ${pair}`;
      }
      if (current === "to" && (next === "be" || next === "modal")) return `"to" before a finite verb: ${pair}`;
    }
    return null;
  }

  function explain(tokens: string[]) {
    const tags = tokens.map(tag);
    return { tags, problem: problem(tokens, tags) };
  }

  return { explain, check: (tokens) => explain(tokens).problem === null };
}
