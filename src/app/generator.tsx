"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  AiBrain01Icon,
  Alert02Icon,
  Copy01Icon,
  Csv01Icon,
  GitBranchIcon,
  HashtagIcon,
  Idea01Icon,
  InformationCircleIcon,
  Loading03Icon,
  Location01Icon,
  RulerIcon,
  SparklesIcon,
  SpellCheckIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextFontIcon,
  Txt01Icon,
} from "@hugeicons/core-free-icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Engine = "markov" | "neural";

const PRESETS = [5, 20, 100, 500];
const MAX_COUNT: Record<Engine, number> = { markov: 1000, neural: 200 };
const MAX_WORDS = 3;

type Result = {
  words: string[];
  engine: Engine;
  requested: number;
  sentences: string[];
  notes: string[];
  stats: { sentences: number; tokens: number; vocabulary: number };
};

type Failure = { error: string; word?: string; suggestions?: string[] };

const SELECTED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

export function Generator() {
  const [text, setText] = useState("");
  const [count, setCount] = useState(20);
  const [engine, setEngine] = useState<Engine>("markov");
  const [creativity, setCreativity] = useState(50);
  const [length, setLength] = useState("any");
  const [position, setPosition] = useState("any");
  const [grammar, setGrammar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  const words = splitWords(text);
  const tooMany = words.length > MAX_WORDS;
  const maxCount = MAX_COUNT[engine];

  async function generate(input: string[]) {
    setLoading(true);
    setFailure(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          words: input,
          count: Math.min(count, maxCount),
          engine,
          creativity: creativity / 100,
          length,
          position,
          grammar,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult(data);
      } else {
        setResult(null);
        setFailure(data);
      }
    } catch {
      setResult(null);
      setFailure({ error: "Could not reach the server. Is it still running?" });
    } finally {
      setLoading(false);
    }
  }

  async function copyAll() {
    if (!result) return;
    await navigator.clipboard.writeText(result.sentences.join("\n"));
    toast.success(`Copied ${result.sentences.length} sentences`);
  }

  function download(kind: "txt" | "csv") {
    if (!result) return;
    const body =
      kind === "txt"
        ? result.sentences.join("\n") + "\n"
        : // The BOM makes spreadsheet apps read the file as UTF-8.
          "﻿number,sentence\n" +
          result.sentences.map((s, i) => `${i + 1},"${s.replaceAll('"', '""')}"`).join("\n") +
          "\n";
    const url = URL.createObjectURL(new Blob([body], { type: kind === "txt" ? "text/plain" : "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.words.join("-")}-sentences.${kind}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
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
              hint={`Up to ${maxCount.toLocaleString("en")} with the ${engine === "markov" ? "Markov" : "neural"} model.`}
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
                icon={engine === "markov" ? GitBranchIcon : AiBrain01Icon}
                label="Model"
                hint={
                  engine === "markov"
                    ? "N-gram model. Instant, and knows every word in the corpus."
                    : "Small LSTM network. Slower, and knows only the 8,000 commonest words."
                }
              >
                <Choice
                  value={engine}
                  onChange={(value) => {
                    setEngine(value as Engine);
                    setCount((current) => Math.min(current, MAX_COUNT[value as Engine]));
                  }}
                  options={[
                    { value: "markov", label: "Markov", icon: GitBranchIcon },
                    { value: "neural", label: "Neural", icon: AiBrain01Icon },
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

              <div className="flex items-center justify-between gap-4 sm:col-span-2">
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
        <Alert>
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

      {loading && !result && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      )}

      {result && (
        <section className={`flex flex-col gap-4 ${loading ? "opacity-50" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium">
              {result.sentences.length} sentence{result.sentences.length === 1 ? "" : "s"}
              <span className="font-normal text-muted-foreground">
                {" "}
                · {result.engine === "markov" ? "Markov" : "Neural"} model
              </span>
            </h2>
            {result.sentences.length > 0 && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="lg" onClick={copyAll}>
                  <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-5" />
                  Copy
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => download("txt")}>
                  <HugeiconsIcon icon={Txt01Icon} strokeWidth={2} className="size-5" />
                  TXT
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => download("csv")}>
                  <HugeiconsIcon icon={Csv01Icon} strokeWidth={2} className="size-5" />
                  CSV
                </Button>
              </div>
            )}
          </div>

          {result.notes.map((note) => (
            <Alert key={note}>
              <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-5" />
              <AlertDescription className="text-foreground">{note}</AlertDescription>
            </Alert>
          ))}

          <ol className="flex flex-col gap-2">
            {result.sentences.map((sentence, index) => (
              <li
                key={sentence}
                className="flex gap-3 rounded-lg border px-3 py-3 text-[0.95rem] leading-7 sm:px-4"
              >
                <span className="w-7 shrink-0 text-right font-mono text-xs leading-7 text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0 break-words">
                  <Highlighted text={sentence} words={result.words} />
                </span>
              </li>
            ))}
          </ol>

          <p className="text-xs text-muted-foreground">
            Trained on {result.stats.sentences.toLocaleString("en")} sentences,{" "}
            {result.stats.tokens.toLocaleString("en")} tokens and{" "}
            {result.stats.vocabulary.toLocaleString("en")} distinct words. Best-scoring sentences
            are listed first.
          </p>
        </section>
      )}
    </div>
  );
}

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

function Highlighted({ text, words }: { text: string; words: string[] }) {
  const targets = words.map((word) => word.toLowerCase());
  // Split on word boundaries the same way the tokenizer does, keeping the gaps.
  const parts = text.split(/([\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*)/u);
  return parts.map((part, index) =>
    targets.includes(part.toLowerCase()) ? (
      <mark key={index} className="rounded-sm bg-foreground px-1 text-background">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
