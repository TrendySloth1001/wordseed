"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  AiBrain01Icon,
  Alert02Icon,
  ArrowDown01Icon,
  BookOpen01Icon,
  Cancel01Icon,
  GitBranchIcon,
  GitCompareIcon,
  HashtagIcon,
  MinusSignIcon,
  PlusSignIcon,
  Idea01Icon,
  Loading03Icon,
  Location01Icon,
  RulerIcon,
  ShuffleIcon,
  SlidersHorizontalIcon,
  SpellCheckIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { engineName, RunView } from "@/components/run-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Engine, Run } from "@/lib/run-types";
import { apiFetch, offlineChoice } from "@/lib/offline/client";
import { GenerateIcon, QuillIcon } from "@/components/animated-icons";
import { acceptTerms, termsAccepted } from "@/lib/consent";
import { TermsCard } from "@/components/terms-card";

/** "both" runs the two engines on the same request and compares them. */
type Mode = Engine | "both";

const PRESETS = [5, 20, 100, 500];
const MAX_COUNT: Record<Mode, number> = { markov: 1000, neural: 200, both: 200 };
const MAX_WORDS = 3;

type Failure = { error: string; word?: string; suggestions?: string[] };

const SELECTED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

const EXAMPLES = ["river", "computer", "happy", "moon night"];
const DEFAULTS = {
  engine: "markov" as Mode,
  creativity: 50,
  length: "any",
  position: "any",
  readability: "any",
  grammar: true,
};

/** Settings handed over in the page address, e.g. by "Use these settings". */
export type InitialSettings = Partial<typeof DEFAULTS> & { words?: string; count?: number };

export function Generator({ initial = {} }: { initial?: InitialSettings }) {
  const start = { ...DEFAULTS, ...initial };
  const [text, setText] = useState(initial.words ?? "");
  // Kept as typed so the field can be emptied; clamped when it is used.
  const [countText, setCountText] = useState(String(initial.count ?? 20));
  const [engine, setEngine] = useState<Mode>(start.engine);
  const [creativity, setCreativity] = useState(start.creativity);
  const [length, setLength] = useState(start.length);
  const [position, setPosition] = useState(start.position);
  const [readability, setReadability] = useState(start.readability);
  const [grammar, setGrammar] = useState(start.grammar);
  const [showOptions, setShowOptions] = useState(false);
  // The words waiting for the visitor to agree to the terms, if any.
  const [termsFor, setTermsFor] = useState<string[] | null>(null);
  const generateButton = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [failure, setFailure] = useState<Failure | null>(null);
  const results = useRef<HTMLDivElement>(null);
  const formColumn = useRef<HTMLDivElement>(null);
  const slideFrom = useRef<number | null>(null);

  const words = splitWords(text);
  const tooMany = words.length > MAX_WORDS;
  const invalid = words.find((word) => !WORD.test(word));
  const maxCount = MAX_COUNT[engine];
  const count = Math.min(maxCount, Math.max(1, Math.floor(Number(countText)) || 1));

  // What differs from the defaults, shown on the collapsed Options row.
  const changed = [
    engine !== DEFAULTS.engine && MODE_LABELS[engine],
    creativity !== DEFAULTS.creativity && `Creativity ${creativity}%`,
    length !== DEFAULTS.length && `${capitalise(length)} sentences`,
    position !== DEFAULTS.position && words.length <= 1 && `Word at the ${position}`,
    readability !== DEFAULTS.readability && `${capitalise(readability)} to read`,
    !grammar && "Grammar check off",
  ].filter((entry) => typeof entry === "string");

  function resetOptions() {
    setEngine(DEFAULTS.engine);
    setCreativity(DEFAULTS.creativity);
    setLength(DEFAULTS.length);
    setPosition(DEFAULTS.position);
    setReadability(DEFAULTS.readability);
    setGrammar(DEFAULTS.grammar);
  }

  // Bring fresh results into view: below the form on a phone, beside it at
  // the top of the page on a wide screen.
  const newest = runs[0]?.id;
  useEffect(() => {
    if (!newest) return;
    if (window.matchMedia("(min-width: 64rem)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
    else results.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [newest]);

  async function generate(input: string[]) {
    // Nothing is generated before the visitor has agreed to the terms: the
    // terms card pops out instead, and agreeing carries on with these words.
    if (!termsAccepted()) {
      setTermsFor(input);
      return;
    }
    setTermsFor(null);
    setLoading(true);
    setFailure(null);
    const engines: Engine[] = engine === "both" ? ["markov", "neural"] : [engine];
    try {
      const responses = await Promise.all(
        engines.map((each) =>
          apiFetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              words: input,
              count,
              engine: each,
              creativity: creativity / 100,
              length,
              position,
              readability,
              grammar,
            }),
          }),
        ),
      );
      const data = await Promise.all(responses.map((response) => response.json()));
      const failed = responses.findIndex((response) => !response.ok);
      // A failed request leaves the previous results on screen.
      if (failed === -1) {
        // Remember where the form is, to slide it from there to its new place.
        slideFrom.current = formColumn.current?.getBoundingClientRect().left ?? null;
        setRuns(data);
      }
      else setFailure(data[failed]);
    } catch {
      setFailure({
        error:
          offlineChoice() === "granted"
            ? "Could not generate offline. Reload once you are back online to refresh the saved copy."
            : "Could not reach the server. To keep generating without a network, allow offline use when asked or on the Corpus page.",
      });
    } finally {
      setLoading(false);
    }
  }

  function pickWord(word: string) {
    setText(word);
    generate(splitWords(word));
  }

  // On a wide screen the form sits in the middle until there are results,
  // then moves to the left with the results beside it. The form keeps its
  // width, so the move is a plain slide: nothing inside it has to re-wrap.
  const split = runs.length > 0;

  useLayoutEffect(() => {
    const from = slideFrom.current;
    const panel = formColumn.current;
    slideFrom.current = null;
    if (!split || from === null || !panel) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const distance = from - panel.getBoundingClientRect().left;
    if (distance === 0) return;
    panel.animate([{ transform: `translateX(${distance}px)` }, { transform: "none" }], {
      duration: 700,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
  }, [split]);

  return (
    <div className={`flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10 ${split ? "" : "lg:justify-center"}`}>
      <div
        ref={formColumn}
        // *:shrink-0 keeps the card at full height so the column scrolls
        // instead of squeezing it and cutting its content off.
        className={`@container flex w-full shrink-0 flex-col gap-6 *:shrink-0 lg:w-[28rem] lg:px-1 lg:py-10 xl:w-[34rem] ${
          split
            ? // When the panel is taller than the screen it scrolls on its own; its
              // edges fade out instead of cutting the content off with a hard line.
              "lg:sticky lg:top-16 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden lg:[mask-image:linear-gradient(to_bottom,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)]"
            : ""
        }`}
      >
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sentences from a word</h1>
        <p className="text-muted-foreground">
          Type a word and get as many sentences containing it as you like, written by models
          trained on classic novels and Simple English Wikipedia.
        </p>
      </header>

      <Card className="w-full">
        <CardContent>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              generate(words);
            }}
          >
            <Field
              icon={TextFontIcon}
              label="Your word"
              htmlFor="words"
              hint={
                tooMany
                  ? `Use at most ${MAX_WORDS} words.`
                  : invalid
                    ? `"${invalid}" has characters that cannot be used. Use letters, numbers, hyphens or apostrophes.`
                    : words.length > 1
                      ? `Every sentence will contain ${words.join(" and ")}.`
                      : "Type one word. Add a second or third, separated by spaces, to get all of them in each sentence."
              }
            >
              {/* The terms card, when shown, sits beside this on wide screens. */}
              <div className="relative">
              {/* One bar holding the input and the button. While it has focus, a
                  thin light runs round its border (.word-bar in globals.css). */}
              <div className="word-bar group rounded-2xl p-px">
                <div className="flex flex-col gap-1.5 rounded-[calc(1rem-1px)] bg-background p-1.5 @xl:flex-row">
                  <div className="relative flex flex-1 items-center">
                    <QuillIcon className="pointer-events-none absolute left-3.5 size-5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
                    <Input
                      id="words"
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder="Type a word, e.g. river"
                      aria-invalid={tooMany || Boolean(invalid)}
                      autoComplete="off"
                      autoCapitalize="none"
                      autoFocus
                      enterKeyHint="go"
                      className="h-12 border-0 bg-transparent pr-24 pl-11 text-base shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent"
                    />
                    {text !== "" ? (
                      <Button
                        type="button"
                        size="icon-lg"
                        variant="ghost"
                        aria-label="Clear the word"
                        title="Clear"
                        onClick={() => setText("")}
                        className="absolute right-1.5 animate-in fade-in zoom-in-75"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-5" />
                      </Button>
                    ) : (
                      <kbd className="pointer-events-none absolute right-3 hidden items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground sm:flex">
                        ↵ Enter
                      </kbd>
                    )}
                  </div>
                  <Button
                    ref={generateButton}
                    type="submit"
                    size="lg"
                    disabled={loading || words.length === 0 || tooMany || Boolean(invalid)}
                    className="group h-12 rounded-xl px-5 text-base transition-all @xl:min-w-56 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                  >
                    {loading ? (
                      <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-5 animate-spin" />
                    ) : (
                      <GenerateIcon className="size-5" />
                    )}
                    {loading
                      ? "Generating…"
                      : words.length === 0
                        ? "Type a word to start"
                        : `Generate ${count} sentence${count === 1 ? "" : "s"}`}
                  </Button>
                </div>
              </div>
                {termsFor && (
                  <TermsCard
                    anchor={generateButton}
                    onAgree={() => {
                      acceptTerms();
                      generate(termsFor);
                    }}
                    onCancel={() => setTermsFor(null)}
                  />
                )}
              </div>
              {words.length > 0 && (
                // The words every sentence will contain, as you type them.
                <div className="flex flex-wrap items-center gap-1.5 text-xs" aria-hidden>
                  {words.map((word, index) => (
                    <span
                      key={`${index}-${word}`}
                      className={`inline-flex animate-in items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-1 fade-in slide-in-from-left-1 ${
                        index >= MAX_WORDS || word === invalid ? "border-dashed text-muted-foreground line-through" : ""
                      }`}
                    >
                      <span className="flex size-4 items-center justify-center rounded-full border text-[0.6rem] tabular-nums">
                        {index + 1}
                      </span>
                      {word}
                    </span>
                  ))}
                  <span className="text-muted-foreground tabular-nums">
                    {Math.min(words.length, MAX_WORDS)} of {MAX_WORDS} words
                  </span>
                </div>
              )}

              {text === "" && (
                <TryWords
                  onPick={(word) => {
                    setText(word);
                    generate(splitWords(word));
                  }}
                />
              )}
              {loading && engine !== "markov" && (
                <p className="text-xs text-muted-foreground" role="status">
                  The neural model writes about 20 sentences a second, so this can take a moment.
                </p>
              )}
            </Field>

            <Field
              icon={HashtagIcon}
              label="How many sentences"
              htmlFor="count"
              hint={`Pick a preset or type any number from 1 to ${maxCount.toLocaleString("en")}.`}
            >
              {/* One outlined bar, like the word bar: presets on the left, an exact
                  number with − and + on the right. */}
              <div className="flex flex-col gap-1.5 rounded-2xl border p-1.5 @md:flex-row @md:items-center">
                <div className="grid flex-1 grid-cols-4 gap-1" role="radiogroup" aria-label="Preset counts">
                  {PRESETS.filter((preset) => preset <= maxCount).map((preset) => {
                    const selected = count === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setCountText(String(preset))}
                        className={`h-10 rounded-xl text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          selected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
                <span className="hidden h-6 w-px bg-border @md:block" aria-hidden />
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Fewer sentences"
                    disabled={count <= 1}
                    onClick={() => setCountText(String(Math.max(1, count - 1)))}
                    className="size-10 rounded-xl"
                  >
                    <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} className="size-4" />
                  </Button>
                  <Input
                    id="count"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={maxCount}
                    value={countText}
                    onChange={(event) => setCountText(event.target.value)}
                    onBlur={() => setCountText(String(count))}
                    aria-label="Number of sentences"
                    className="h-10 flex-1 [appearance:textfield] rounded-xl border-0 bg-muted/60 text-center text-base font-semibold tabular-nums shadow-none focus-visible:ring-2 @md:w-20 @md:flex-none md:text-base dark:bg-muted/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="More sentences"
                    disabled={count >= maxCount}
                    onClick={() => setCountText(String(Math.min(maxCount, count + 1)))}
                    className="size-10 rounded-xl"
                  >
                    <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-4" />
                  </Button>
                </div>
              </div>
            </Field>

            <div className="flex items-center gap-2 border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                aria-expanded={showOptions}
                aria-controls="options"
                onClick={() => setShowOptions(!showOptions)}
                className="-ml-2.5 h-10 min-w-0 flex-1 justify-start"
              >
                <HugeiconsIcon icon={SlidersHorizontalIcon} strokeWidth={2} className="size-5" />
                <span className="shrink-0">Options</span>
                <span className="min-w-0 truncate font-normal text-muted-foreground">
                  {changed.length === 0 ? "Standard settings" : changed.join(" · ")}
                </span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  strokeWidth={2}
                  className={`ml-auto size-5 transition-transform duration-300 motion-reduce:transition-none ${
                    showOptions ? "rotate-180" : ""
                  }`}
                />
              </Button>
              {changed.length > 0 && (
                <Button type="button" variant="outline" size="lg" onClick={resetOptions} className="h-10">
                  Reset
                </Button>
              )}
            </div>

            {/* Animating the row from 0fr to 1fr opens the panel to its natural height. */}
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                showOptions ? "grid-rows-[1fr] opacity-100" : "-mt-5 grid-rows-[0fr] opacity-0"
              }`}
            >
            {/* relative: the switch and slider render hidden, absolutely positioned
                form inputs, which would otherwise escape the clipping and make the
                page scroll even while the panel is closed. */}
            <div id="options" inert={!showOptions} className="relative min-h-0 overflow-hidden">
            <div className="grid gap-5 p-0.5 @xl:grid-cols-2">
              <Field
                icon={MODE_ICONS[engine]}
                label="Model"
                hint={MODE_HINTS[engine]}
              >
                <Choice
                  value={engine}
                  onChange={(value) => {
                    setEngine(value as Mode);
                  }}
                  options={[
                    { value: "markov", label: "Markov", icon: GitBranchIcon },
                    { value: "neural", label: "Neural", icon: AiBrain01Icon },
                    { value: "both", label: "Compare", icon: GitCompareIcon },
                  ]}
                />
              </Field>

              <Field
                icon={Idea01Icon}
                label={`Creativity · ${creativity}%`}
                hint="Low keeps sentences close to the original texts. High gives stranger, more surprising ones."
              >
                <Slider
                  value={[creativity]}
                  onValueChange={([value]) => setCreativity(value)}
                  min={0}
                  max={100}
                  step={5}
                  aria-label="Creativity"
                  className="py-3"
                />
              </Field>

              <Field icon={RulerIcon} label="Length" hint={LENGTH_HINTS[length]}>
                <Choice
                  value={length}
                  onChange={setLength}
                  options={[
                    { value: "any", label: "Any" },
                    { value: "short", label: "Short" },
                    { value: "medium", label: "Medium" },
                    { value: "long", label: "Long" },
                  ]}
                />
              </Field>

              <Field
                icon={Location01Icon}
                label="Word position"
                hint={
                  words.length > 1
                    ? "Only available with a single word."
                    : "Where in the sentence the word should sit."
                }
              >
                <Choice
                  value={words.length > 1 ? "any" : position}
                  onChange={setPosition}
                  disabled={words.length > 1}
                  options={[
                    { value: "any", label: "Any" },
                    { value: "start", label: "Start", icon: TextAlignLeftIcon },
                    { value: "middle", label: "Middle", icon: TextAlignCenterIcon },
                    { value: "end", label: "End", icon: TextAlignRightIcon },
                  ]}
                />
              </Field>

              <Field icon={BookOpen01Icon} label="Reading level" hint={READABILITY_HINTS[readability]}>
                <Choice
                  value={readability}
                  onChange={setReadability}
                  options={[
                    { value: "any", label: "Any" },
                    { value: "easy", label: "Easy" },
                    { value: "hard", label: "Hard" },
                  ]}
                />
              </Field>

              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="grammar" className="gap-2">
                    <HugeiconsIcon icon={SpellCheckIcon} strokeWidth={2} className="size-5" />
                    Grammar check
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Drops sentences with no verb or with broken word order.
                  </p>
                </div>
                <Switch id="grammar" checked={grammar} onCheckedChange={setGrammar} />
              </div>
            </div>
            </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {failure && (
        <Alert className="w-full animate-in fade-in slide-in-from-top-2">
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-5" />
          <AlertTitle>{failure.error}</AlertTitle>
          {failure.word && failure.suggestions && failure.suggestions.length > 0 && (
            <AlertDescription className="flex flex-wrap items-center gap-2 pt-1">
              Try a word it knows:
              {failure.suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const replaced = words.map((word) =>
                      word.toLowerCase() === failure.word!.toLowerCase() ? suggestion : word,
                    );
                    setText(replaced.join(" "));
                    generate(replaced);
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </AlertDescription>
          )}
        </Alert>
      )}

      {loading && runs.length === 0 && (
        <div className="flex w-full flex-col gap-2 lg:hidden">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      )}
      </div>

      {split && (
        <div ref={results} className="min-w-0 flex-1 scroll-mt-6 lg:py-10">
          <div
            // Remounting on a new run replays the entrance animation.
            key={runs.map((run) => run.id).join()}
            className={`flex animate-in flex-col gap-6 delay-150 duration-700 ease-out fill-mode-both fade-in slide-in-from-bottom-3 motion-reduce:animate-none ${
              loading ? "opacity-50" : ""
            }`}
          >
            {runs.length === 2 && <Comparison runs={runs} />}
            {runs.map((run) => (
              <RunView key={run.id} run={run} onPickWord={pickWord} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The two engines' numbers for the same request, side by side. */
function Comparison({ runs }: { runs: Run[] }) {
  const rows: [string, (run: Run) => string][] = [
    ["Sentences returned", (run) => String(run.sentences.length)],
    ["Average length", (run) => `${run.summary.averageWords} words`],
    ["Average perplexity", (run) => String(run.summary.averagePerplexity)],
    ["Average reading ease", (run) => String(Math.round(run.summary.averageReadability))],
    ["Variety of words", (run) => `${Math.round(run.summary.diversity * 100)}%`],
    ["Average copied run", (run) => `${run.summary.averageCopied} words`],
    ["Candidates sampled", (run) => run.summary.funnel.sampled.toLocaleString("en")],
    [
      "Candidates that passed",
      (run) =>
        run.summary.funnel.sampled === 0
          ? "0%"
          : `${Math.round((run.summary.funnel.accepted / run.summary.funnel.sampled) * 100)}%`,
    ],
  ];
  return (
    <div className="w-full rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Same request, both models</TableHead>
            {runs.map((run) => (
              <TableHead key={run.id} className="text-right">
                {engineName(run)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(([label, value]) => (
            <TableRow key={label}>
              <TableCell className="whitespace-normal">{label}</TableCell>
              {runs.map((run) => (
                <TableCell key={run.id} className="text-right tabular-nums">
                  {value(run)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const MODE_ICONS = { markov: GitBranchIcon, neural: AiBrain01Icon, both: GitCompareIcon };

const MODE_LABELS: Record<Mode, string> = {
  markov: "Markov model",
  neural: "Neural model",
  both: "Compare both models",
};

const MODE_HINTS: Record<Mode, string> = {
  markov: "Recombines phrases from the texts. Instant, and knows every word in them.",
  neural: "A small neural network. Slower, plainer, and knows only the 8,000 most common words.",
  both: "Runs your word through both models and shows the results side by side.",
};

const READABILITY_HINTS: Record<string, string> = {
  any: "Simple and difficult sentences alike.",
  easy: "Only short, plain sentences (reading ease 70 or more).",
  hard: "Only dense, difficult sentences (reading ease below 50).",
};

const LENGTH_HINTS: Record<string, string> = {
  any: "4 to 30 words.",
  short: "3 to 8 words.",
  medium: "9 to 16 words.",
  long: "17 to 32 words.",
};

const VISIBLE_WORDS = 4;
const ROTATE_EVERY = 2400;

/**
 * Suggested words that keep changing: every couple of seconds one of them is
 * swapped for a new random word from the corpus, slot by slot. Hovering or
 * focusing the row pauses it so a word does not change under the pointer.
 */
function TryWords({ onPick }: { onPick: (word: string) => void }) {
  const [shown, setShown] = useState(EXAMPLES);
  const [paused, setPaused] = useState(false);
  // Bumped on every swap: restarts the countdown ring and the shuffle spin.
  const [tick, setTick] = useState(0);
  const [spins, setSpins] = useState(0);
  const pool = useRef<string[]>([]);
  const slot = useRef(0);

  const refill = useCallback(async () => {
    const words: string[] = await apiFetch(`/api/words/random?count=40`)
      .then((response) => (response.ok ? response.json() : []))
      .catch(() => []);
    pool.current.push(...words);
  }, []);

  /** The next pooled word that is not already on screen. */
  const take = useCallback((visible: string[]) => {
    let next = pool.current.shift();
    while (next && visible.includes(next)) next = pool.current.shift();
    if (pool.current.length < VISIBLE_WORDS * 2) refill();
    return next;
  }, [refill]);

  useEffect(() => {
    refill();
  }, [refill]);

  // The words on screen, readable from the timer without re-creating it.
  const current = useRef(shown);
  const show = useCallback((words: string[]) => {
    current.current = words;
    setShown(words);
    setTick((value) => value + 1);
  }, []);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      const next = take(current.current);
      if (!next) return;
      const updated = [...current.current];
      updated[slot.current] = next;
      slot.current = (slot.current + 1) % VISIBLE_WORDS;
      show(updated);
    }, ROTATE_EVERY);
    return () => clearInterval(timer);
  }, [paused, take, show]);

  function shuffle() {
    const fresh: string[] = [];
    for (let i = 0; i < VISIBLE_WORDS; i++) {
      fresh.push(take([...current.current, ...fresh]) ?? current.current[i]);
    }
    setSpins((value) => value + 1);
    show(fresh);
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      Try
      {shown.map((word, index) => (
        <Button
          key={index}
          type="button"
          variant="outline"
          onClick={() => onPick(word)}
          aria-label={word}
          // Monospaced, so the chip's width follows the word's length and can
          // ease from one word to the next.
          style={{ width: `calc(${word.length}ch + 1.5rem)` }}
          className="group/chip justify-center overflow-hidden px-0 font-mono text-[0.8rem] transition-[width,transform,background-color] duration-300 ease-out hover:-translate-y-0.5 active:scale-95"
        >
          <ScrambleWord word={word} delay={index * 90} />
        </Button>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Show other words"
        title="Show other words"
        onClick={shuffle}
        className="relative"
      >
        {/* Counts down to the next swap; frozen while the row is hovered. */}
        <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r="16" fill="none" className="stroke-border" strokeWidth="2" />
          <circle
            key={tick}
            cx="18"
            cy="18"
            r="16"
            fill="none"
            pathLength={1}
            strokeDasharray="1"
            className="stroke-foreground motion-reduce:hidden"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              animation: `try-countdown ${ROTATE_EVERY}ms linear both`,
              animationPlayState: paused ? "paused" : "running",
            }}
          />
        </svg>
        <HugeiconsIcon
          icon={ShuffleIcon}
          strokeWidth={2}
          className="size-4 transition-transform duration-500 ease-out"
          style={{ transform: `rotate(${spins * 180}deg)` }}
        />
      </Button>
    </div>
  );
}

const GLYPHS = "abcdefghijklmnopqrstuvwxyz";

/**
 * A word that arrives like a departures board: each letter flips through
 * random letters and lands, left to right. Hovering its chip ripples the
 * letters in a wave.
 */
function ScrambleWord({ word, delay = 0 }: { word: string; delay?: number }) {
  const [letters, setLetters] = useState(() => word.split("").map((char) => ({ char, done: true })));

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = -Infinity;
    const start = performance.now();
    const step = (now: number) => {
      if (reduced) {
        setLetters(word.split("").map((char) => ({ char, done: true })));
        return;
      }
      // Change the random letters about 25 times a second, not every frame.
      if (now - last < 40) {
        frame = requestAnimationFrame(step);
        return;
      }
      last = now;
      const elapsed = now - start;
      let settled = true;
      // The new word's length applies at once (so the chip resizes around
      // scrambling letters, never the old word); only the landing is staggered.
      setLetters(
        word.split("").map((char, i) => {
          if (char === " " || elapsed >= delay + 140 + i * 55) return { char, done: true };
          settled = false;
          return { char: GLYPHS[Math.floor(Math.random() * GLYPHS.length)], done: false };
        }),
      );
      if (!settled) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [word, delay]);

  return (
    <span aria-hidden className="flex whitespace-pre">
      {letters.map((letter, i) => (
        // Outer span: the hover wave. Inner span: the flip on every change.
        <span
          key={i}
          className="inline-block group-hover/chip:animate-[try-wave_0.55s_ease-in-out]"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <span
            key={letter.char + letter.done}
            className={`inline-block animate-[try-flap_0.12s_ease-out] ${
              letter.done ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {letter.char}
          </span>
        </span>
      ))}
    </span>
  );
}

const WORD = /^[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*$/u;

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function splitWords(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/[\s,]+/)
    .filter((word) => word !== "")
    .filter((word) => !seen.has(word.toLowerCase()) && seen.add(word.toLowerCase()));
}

function Field({
  icon,
  label,
  hint,
  htmlFor,
  children,
}: {
  icon: IconSvgElement;
  label: string;
  hint: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={htmlFor} className="gap-2">
        <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5" />
        {label}
      </Label>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Choice({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: IconSvgElement }[];
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="lg"
      spacing={0}
      value={value}
      disabled={disabled}
      onValueChange={(next) => next && onChange(next)}
      className="w-full"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className={`h-10 min-w-0 flex-1 ${SELECTED}`}
        >
          {option.icon && (
            <HugeiconsIcon icon={option.icon} strokeWidth={2} className="hidden size-4 min-[400px]:block" />
          )}
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
