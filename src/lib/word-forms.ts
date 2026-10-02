// Guesses other forms of a word (run / runs / ran / running) so that a word
// missing from the corpus can fall back to a relative that is in it.

/** base form followed by its irregular forms */
export const IRREGULAR_VERBS: string[][] = `be am is are was were been being|have has had having|do does did done doing|
go goes went gone|say said|make made|come came|see saw seen|take took taken|get got gotten|give gave given|
know knew known|think thought|tell told|find found|leave left|feel felt|become became|bring brought|
begin began begun|keep kept|hold held|stand stood|hear heard|mean meant|meet met|run ran|pay paid|sit sat|
speak spoke spoken|lead led|grow grew grown|lose lost|fall fell fallen|send sent|build built|
understand understood|draw drew drawn|break broke broken|spend spent|rise rose risen|drive drove driven|
buy bought|wear wore worn|choose chose chosen|write wrote written|eat ate eaten|sleep slept|catch caught|
teach taught|throw threw thrown|fly flew flown|sing sang sung|lie lay lain|lay laid|wake woke woken|
shake shook shaken|hang hung|strike struck|win won|forget forgot forgotten|hide hid hidden|bite bit bitten|
swim swam swum|drink drank drunk|ride rode ridden|fight fought|sell sold|shoot shot|steal stole stolen|
blow blew blown|bear bore born|tear tore torn|swear swore sworn|freeze froze frozen|dig dug|feed fed|
bind bound|bend bent|deal dealt|dream dreamt|kneel knelt|lend lent|light lit|seek sought|shine shone|
slide slid|spin spun|stick stuck|sting stung|sweep swept|swing swung|weep wept|wind wound|creep crept|
flee fled|cling clung|sink sank sunk|spring sprang sprung|ring rang rung|show shown|put|cut|let|set|hit|shut|read`
  .split("|")
  .map((group) => group.trim().split(/\s+/));

const IRREGULAR_NOUNS: string[][] = `man men|woman women|child children|foot feet|tooth teeth|mouse mice|
goose geese|person people|life lives|knife knives|wife wives|leaf leaves|wolf wolves|half halves`
  .split("|")
  .map((group) => group.trim().split(/\s+/));

const RELATED = new Map<string, string[]>();
for (const group of [...IRREGULAR_VERBS, ...IRREGULAR_NOUNS]) {
  for (const form of group) RELATED.set(form, group.filter((other) => other !== form));
}

const VOWEL = /[aeiou]/;

/** Regular inflections of a base form: runs, running, walked, cities... */
export function inflect(base: string): string[] {
  const forms: string[] = [];
  const last = base.at(-1)!;
  const beforeLast = base.at(-2) ?? "";
  if (last === "y" && !VOWEL.test(beforeLast)) {
    const stem = base.slice(0, -1);
    forms.push(stem + "ies", stem + "ied", base + "ing");
  } else if (last === "e") {
    forms.push(base + "s", base + "d", base.slice(0, -1) + "ing");
  } else {
    forms.push(base + (/(s|x|z|ch|sh)$/.test(base) ? "es" : "s"), base + "ed", base + "ing");
    // stop -> stopped, stopping
    if (!VOWEL.test(last) && VOWEL.test(beforeLast) && !/[wxy]/.test(last)) {
      forms.push(base + last + "ed", base + last + "ing");
    }
  }
  return forms;
}

/** Possible base forms of an inflected word: running -> runn, run, runne. */
function bases(word: string): string[] {
  const stems: string[] = [];
  const strip = (suffix: string, replacements: string[]) => {
    if (!word.endsWith(suffix) || word.length - suffix.length < 2) return;
    const stem = word.slice(0, -suffix.length);
    for (const replacement of replacements) stems.push(stem + replacement);
    // stopped -> stop
    if (stem.length > 2 && stem.at(-1) === stem.at(-2)) stems.push(stem.slice(0, -1));
  };
  strip("ies", ["y"]);
  strip("ied", ["y"]);
  strip("ing", ["", "e"]);
  strip("ed", ["", "e"]);
  strip("es", ["", "e"]);
  strip("s", [""]);
  strip("ly", [""]);
  strip("er", ["", "e"]);
  strip("est", ["", "e"]);
  return stems;
}

/** Other forms of `word`, most closely related first. */
export function relatedForms(word: string): string[] {
  const lower = word.toLowerCase();
  const stems = bases(lower);
  const forms = [
    ...(RELATED.get(lower) ?? []),
    ...stems,
    ...inflect(lower),
    ...stems.flatMap((stem) => [...(RELATED.get(stem) ?? []), ...inflect(stem)]),
  ];
  return [...new Set(forms)].filter((form) => form !== lower);
}
