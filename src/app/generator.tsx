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
import { GenerateIcon } from "@/components/animated-icons";

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
            ? "lg:sticky lg:top-16 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden"
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
              <div className="flex flex-col gap-2 @xl:flex-row">
                <div className="relative flex-1">
                  <Input
                    id="words"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="e.g. river"
                    aria-invalid={tooMany || Boolean(invalid)}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoFocus
                    enterKeyHint="go"
                    className="h-12 pr-11 text-base md:text-base"
                  />
                  {text !== "" && (
                    <Button
                      type="button"
                      size="icon-lg"
                      variant="ghost"
                      aria-label="Clear the word"
                      title="Clear"
                      onClick={() => setText("")}
                      className="absolute top-1.5 right-1.5"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-5" />
                    </Button>
                  )}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading || words.length === 0 || tooMany || Boolean(invalid)}
                  className="group h-12 px-5 text-base @xl:min-w-52"
                >
                  {loading ? (
                    <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-5 animate-spin" />
                  ) : (
                    <GenerateIcon className="size-5" />
                  )}
                  {loading ? "Generating…" : `Generate ${count} sentence${count === 1 ? "" : "s"}`}
                </Button>
              </div>
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
              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="lg"
                  value={String(count)}
                  onValueChange={(value) => value && setCountText(value)}
                >
                  {PRESETS.filter((preset) => preset <= maxCount).map((preset) => (
                    <ToggleGroupItem key={preset} value={String(preset)} className={`h-10 px-3.5 ${SELECTED}`}>
                      {preset}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
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
                  className="h-10 w-24 text-base md:text-base"
                />
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
const ROTATE_EVERY = 1800;

/**
 * Suggested words that keep changing: every couple of seconds one of them is
 * swapped for a new random word from the corpus, slot by slot. Hovering or
 * focusing the row pauses it so a word does not change under the pointer.
 */
function TryWords({ onPick }: { onPick: (word: string) => void }) {
  const [shown, setShown] = useState(EXAMPLES);
  const [paused, setPaused] = useState(false);
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
          // A new word gets a new key, so it mounts and plays its entrance.
          key={`${index}-${word}`}
          type="button"
          variant="outline"
          onClick={() => onPick(word)}
          className="animate-in duration-500 ease-out fill-mode-both fade-in slide-in-from-bottom-2 zoom-in-95 motion-reduce:animate-none"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          {word}
        </Button>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Show other words"
        title="Show other words"
        onClick={shuffle}
      >
        <HugeiconsIcon icon={ShuffleIcon} strokeWidth={2} className="size-4" />
      </Button>
    </div>
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
