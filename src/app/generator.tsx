"use client";

import { useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  AiBrain01Icon,
  Alert02Icon,
  BookOpen01Icon,
  GitBranchIcon,
  GitCompareIcon,
  HashtagIcon,
  Idea01Icon,
  Loading03Icon,
  Location01Icon,
  RulerIcon,
  SparklesIcon,
  SpellCheckIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { engineName, RunView } from "@/components/run-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

/** "both" runs the two engines on the same request and compares them. */
type Mode = Engine | "both";

const PRESETS = [5, 20, 100, 500];
const MAX_COUNT: Record<Mode, number> = { markov: 1000, neural: 200, both: 200 };
const MAX_WORDS = 3;

type Failure = { error: string; word?: string; suggestions?: string[] };

const SELECTED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

export function Generator() {
  const [text, setText] = useState("");
  const [count, setCount] = useState(20);
  const [engine, setEngine] = useState<Mode>("markov");
  const [creativity, setCreativity] = useState(50);
  const [length, setLength] = useState("any");
  const [position, setPosition] = useState("any");
  const [readability, setReadability] = useState("any");
  const [grammar, setGrammar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [failure, setFailure] = useState<Failure | null>(null);

  const words = splitWords(text);
  const tooMany = words.length > MAX_WORDS;
  const maxCount = MAX_COUNT[engine];

  async function generate(input: string[]) {
    setLoading(true);
    setFailure(null);
    const engines: Engine[] = engine === "both" ? ["markov", "neural"] : [engine];
    try {
      const responses = await Promise.all(
        engines.map((each) =>
          fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              words: input,
              count: Math.min(count, maxCount),
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
      if (failed === -1) {
        setRuns(data);
      } else {
        setRuns([]);
        setFailure(data[failed]);
      }
    } catch {
      setRuns([]);
      setFailure({ error: "Could not reach the server. Is it still running?" });
    } finally {
      setLoading(false);
    }
  }

  function pickWord(word: string) {
    setText(word);
    generate([word]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="mx-auto w-full max-w-3xl">
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
              label="Words"
              htmlFor="words"
              hint={
                tooMany
                  ? `Use at most ${MAX_WORDS} words.`
                  : "One word, or up to three that should all appear in each sentence."
              }
            >
              <Input
                id="words"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="river  ·  or  ·  moon night"
                aria-invalid={tooMany}
                autoComplete="off"
                autoCapitalize="none"
                className="h-12 text-base md:text-base"
              />
              {words.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {words.map((word) => (
                    <Badge key={word} variant="outline">
                      {word}
                    </Badge>
                  ))}
                </div>
              )}
            </Field>

            <Field
              icon={HashtagIcon}
              label="How many sentences"
              htmlFor="count"
              hint={`Up to ${maxCount.toLocaleString("en")} ${engine === "markov" ? "with the Markov model" : "when the neural model is used"}.`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxCount}
                  value={count}
                  onChange={(event) =>
                    setCount(Math.min(maxCount, Math.max(1, Math.floor(Number(event.target.value)) || 1)))
                  }
                  className="h-10 w-24 text-base md:text-base"
                />
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="lg"
                  value={String(count)}
                  onValueChange={(value) => value && setCount(Number(value))}
                >
                  {PRESETS.filter((preset) => preset <= maxCount).map((preset) => (
                    <ToggleGroupItem key={preset} value={String(preset)} className={`h-10 px-3.5 ${SELECTED}`}>
                      {preset}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </Field>

            <div className="grid gap-5 border-t pt-5 sm:grid-cols-2">
              <Field
                icon={MODE_ICONS[engine]}
                label="Model"
                hint={MODE_HINTS[engine]}
              >
                <Choice
                  value={engine}
                  onChange={(value) => {
                    setEngine(value as Mode);
                    setCount((current) => Math.min(current, MAX_COUNT[value as Mode]));
                  }}
                  options={[
                    { value: "markov", label: "Markov", icon: GitBranchIcon },
                    { value: "neural", label: "Neural", icon: AiBrain01Icon },
                    { value: "both", label: "Both", icon: GitCompareIcon },
                  ]}
                />
              </Field>

              <Field
                icon={Idea01Icon}
                label={`Creativity · ${creativity}%`}
                hint="Low stays close to the source text. High takes more risks."
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

            <Button
              type="submit"
              size="lg"
              disabled={loading || words.length === 0 || tooMany}
              className="h-12 w-full text-base"
            >
              <HugeiconsIcon
                icon={loading ? Loading03Icon : SparklesIcon}
                strokeWidth={2}
                className={loading ? "size-5 animate-spin" : "size-5"}
              />
              {loading ? "Generating…" : `Generate ${Math.min(count, maxCount)} sentences`}
            </Button>
          </form>
        </CardContent>
      </Card>

      {failure && (
        <Alert className="mx-auto w-full max-w-3xl">
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
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      )}

      {runs.length === 1 && (
        <div className={`mx-auto w-full max-w-3xl ${loading ? "opacity-50" : ""}`}>
          <RunView key={runs[0].id} run={runs[0]} onPickWord={pickWord} />
        </div>
      )}

      {runs.length === 2 && (
        <div className={`flex flex-col gap-6 ${loading ? "opacity-50" : ""}`}>
          <Comparison runs={runs} />
          <div className="grid gap-8 lg:grid-cols-2">
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
    ["Average words", (run) => String(run.summary.averageWords)],
    ["Average perplexity", (run) => String(run.summary.averagePerplexity)],
    ["Average reading ease", (run) => String(Math.round(run.summary.averageReadability))],
    ["Vocabulary diversity", (run) => `${Math.round(run.summary.diversity * 100)}%`],
    ["Average copied run", (run) => `${run.summary.averageCopied} tokens`],
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
    <div className="mx-auto w-full max-w-3xl rounded-lg border">
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

const MODE_HINTS: Record<Mode, string> = {
  markov: "N-gram model. Instant, and knows every word in the corpus.",
  neural: "Small LSTM network. Slower, and knows only the 8,000 commonest words.",
  both: "Runs the same request through both models and compares the numbers.",
};

const READABILITY_HINTS: Record<string, string> = {
  any: "No limit on reading ease.",
  easy: "Flesch reading ease of 70 or more.",
  hard: "Flesch reading ease below 50.",
};

const LENGTH_HINTS: Record<string, string> = {
  any: "4 to 30 words.",
  short: "3 to 8 words.",
  medium: "9 to 16 words.",
  long: "17 to 32 words.",
};

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
