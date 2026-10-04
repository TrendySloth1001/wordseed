"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Copy01Icon,
  Csv01Icon,
  InformationCircleIcon,
  Search01Icon,
  Sorting01Icon,
  TextAlignLeftIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Txt01Icon,
} from "@hugeicons/core-free-icons";
import { BarList } from "@/components/bars";
import { SentenceDetail } from "@/components/sentence-detail";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Section, Tile, WordProfile } from "@/components/word-profile";
import type { Funnel, Run } from "@/lib/run-types";
import { apiFetch } from "@/lib/offline/client";

const FUNNEL_LABELS: [keyof Funnel, string][] = [
  ["sampled", "Candidates sampled"],
  ["abandoned", "Abandoned by the model"],
  ["length", "Wrong length"],
  ["missingWord", "Missing a word"],
  ["position", "Word in the wrong place"],
  ["copiedSentence", "Copied from the corpus"],
  ["grammar", "Failed grammar check"],
  ["readability", "Wrong reading level"],
  ["duplicate", "Duplicates"],
  ["accepted", "Passed every filter"],
  ["returned", "Returned to you"],
];

const PAGE = 50;

type Order = "best" | "shortest" | "longest" | "easiest";
const ORDERS: { value: Order; label: string }[] = [
  { value: "best", label: "Best first" },
  { value: "shortest", label: "Shortest" },
  { value: "longest", label: "Longest" },
  { value: "easiest", label: "Easiest" },
];

/** A plain-language reading of the Flesch score. */
function easeLabel(score: number): string {
  if (score >= 70) return "easy to read";
  if (score >= 50) return "moderate";
  return "hard to read";
}

export function engineName(run: Pick<Run, "engine">): string {
  return run.engine === "markov" ? "Markov" : "Neural";
}

export function RunView({ run, onPickWord }: { run: Run; onPickWord?: (word: string) => void }) {
  const [ratings, setRatings] = useState(run.ratings);
  const [open, setOpen] = useState<number | null>(null);
  const [profiled, setProfiled] = useState(run.words[0]);
  const [order, setOrder] = useState<Order>("best");
  const [shown, setShown] = useState(PAGE);
  const texts = run.sentences.map((sentence) => sentence.text);

  async function copyAll() {
    await navigator.clipboard.writeText(texts.join("\n"));
    toast.success(`Copied ${texts.length} sentences`);
  }

  function download(kind: "txt" | "csv") {
    const quote = (text: string) => `"${text.replaceAll('"', '""')}"`;
    const body =
      kind === "txt"
        ? texts.join("\n") + "\n"
        : // The BOM makes spreadsheet apps read the file as UTF-8.
          "﻿number,sentence,words,perplexity,reading_ease,longest_copied_run,rare_word_share,rating\n" +
          run.sentences
            .map((s, i) =>
              [i + 1, quote(s.text), s.words, s.perplexity, s.readability, s.copied, s.rare, ratings[i] ?? ""].join(","),
            )
            .join("\n") +
          "\n";
    const url = URL.createObjectURL(new Blob([body], { type: kind === "txt" ? "text/plain" : "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${run.words.join("-")}-${run.engine}-sentences.${kind}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function rate(index: number, rating: 1 | -1) {
    const next = ratings[index] === rating ? 0 : rating;
    const previous = ratings;
    const updated = { ...ratings };
    if (next === 0) delete updated[index];
    else updated[index] = next;
    setRatings(updated);
    const response = await apiFetch(`/api/runs/${run.id}/ratings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index, rating: next }),
    }).catch(() => null);
    if (!response?.ok) {
      setRatings(previous);
      toast.error("Could not save the rating");
    }
  }

  async function copyOne(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Sentence copied");
  }

  // Each sentence keeps its original index: ratings and breakdowns use it.
  const ordered = run.sentences.map((sentence, index) => ({ sentence, index }));
  if (order === "shortest") ordered.sort((a, b) => a.sentence.words - b.sentence.words);
  if (order === "longest") ordered.sort((a, b) => b.sentence.words - a.sentence.words);
  if (order === "easiest") ordered.sort((a, b) => b.sentence.readability - a.sentence.readability);

  const { summary } = run;
  const liked = Object.values(ratings).filter((rating) => rating === 1).length;
  const disliked = Object.values(ratings).filter((rating) => rating === -1).length;

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">
          {run.sentences.length} sentence{run.sentences.length === 1 ? "" : "s"}
          <span className="font-normal text-muted-foreground"> · {engineName(run)} model</span>
        </h2>
        {run.sentences.length > 0 && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" onClick={copyAll}>
              <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-5" />
              Copy all
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

      {run.notes.map((note) => (
        <Alert key={note}>
          <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-5" />
          <AlertDescription className="text-foreground">{note}</AlertDescription>
        </Alert>
      ))}

      <Tabs defaultValue="sentences">
        <TabsList className="h-10 w-full">
          <TabsTrigger value="sentences">
            <HugeiconsIcon icon={TextAlignLeftIcon} strokeWidth={2} className="size-4" />
            Sentences
          </TabsTrigger>
          <TabsTrigger value="summary">
            <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} className="size-4" />
            Statistics
          </TabsTrigger>
          <TabsTrigger value="word">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-4" />
            Word info
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sentences" className="flex flex-col gap-3 pt-2">
          {run.sentences.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <HugeiconsIcon icon={Sorting01Icon} strokeWidth={2} className="size-5" />
                Order
              </span>
              <ToggleGroup
                type="single"
                variant="outline"
                spacing={0}
                value={order}
                onValueChange={(value) => {
                  if (!value) return;
                  setOrder(value as Order);
                  setOpen(null);
                }}
              >
                {ORDERS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="h-9 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
          <ol className="flex flex-col gap-2">
            {ordered.slice(0, shown).map(({ sentence, index }, place) => (
              <li key={sentence.text} className="rounded-lg border">
                <div className="flex gap-3 px-3 pt-3 text-[0.95rem] leading-7 sm:px-4">
                  <span className="w-7 shrink-0 text-right font-mono text-xs leading-7 text-muted-foreground">
                    {place + 1}
                  </span>
                  <span className="min-w-0 break-words">
                    <Highlighted text={sentence.text} words={run.words} />
                  </span>
                </div>
                <div className="flex items-center gap-0.5 py-1 pr-1 pl-13 sm:pl-14">
                  <span className="mr-auto min-w-0 truncate text-xs text-muted-foreground">
                    {sentence.words} words · {easeLabel(sentence.readability)}
                  </span>
                  <Button
                    type="button"
                    size="icon-lg"
                    variant="ghost"
                    aria-label="Copy this sentence"
                    title="Copy this sentence"
                    onClick={() => copyOne(sentence.text)}
                  >
                    <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-lg"
                    variant={ratings[index] === 1 ? "default" : "ghost"}
                    aria-label="Good sentence"
                    title="Good sentence"
                    aria-pressed={ratings[index] === 1}
                    onClick={() => rate(index, 1)}
                  >
                    <HugeiconsIcon icon={ThumbsUpIcon} strokeWidth={2} className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-lg"
                    variant={ratings[index] === -1 ? "default" : "ghost"}
                    aria-label="Bad sentence"
                    title="Bad sentence"
                    aria-pressed={ratings[index] === -1}
                    onClick={() => rate(index, -1)}
                  >
                    <HugeiconsIcon icon={ThumbsDownIcon} strokeWidth={2} className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant={open === index ? "secondary" : "ghost"}
                    aria-label="Explain how this sentence was built"
                    title="Explain how this sentence was built"
                    aria-expanded={open === index}
                    onClick={() => setOpen(open === index ? null : index)}
                    className="px-2"
                  >
                    <span className="max-sm:hidden">Explain</span>
                    <HugeiconsIcon
                      icon={open === index ? ArrowUp01Icon : ArrowDown01Icon}
                      strokeWidth={2}
                      className="size-5"
                    />
                  </Button>
                </div>
                {open === index && (
                  <div className="flex flex-col gap-4 border-t px-3 py-4 sm:px-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Tile
                        label="Perplexity"
                        value={String(sentence.perplexity)}
                        hint="lower means more natural"
                      />
                      <Tile
                        label="Reading ease"
                        value={String(Math.round(sentence.readability))}
                        hint={easeLabel(sentence.readability)}
                      />
                      <Tile
                        label="Longest copied run"
                        value={`${sentence.copied} words`}
                        hint="taken in a row from one text"
                      />
                      <Tile
                        label="Rare words"
                        value={`${Math.round(sentence.rare * 100)}%`}
                        hint="of this sentence"
                      />
                    </div>
                    <SentenceDetail runId={run.id} index={index} />
                  </div>
                )}
              </li>
            ))}
          </ol>
          {ordered.length > shown && (
            <Button type="button" variant="outline" size="lg" onClick={() => setShown(shown + PAGE)} className="h-11">
              Show {Math.min(PAGE, ordered.length - shown)} more · {ordered.length - shown} left
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            &ldquo;Best first&rdquo; puts the sentences the model itself finds most likely at the
            top. Copy all and the downloads always include every sentence.
          </p>
        </TabsContent>

        <TabsContent value="summary" className="flex flex-col gap-5 pt-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Tile label="Average length" value={`${summary.averageWords} words`} />
            <Tile
              label="Average perplexity"
              value={String(summary.averagePerplexity)}
              hint="lower means more natural"
            />
            <Tile
              label="Average reading ease"
              value={String(Math.round(summary.averageReadability))}
              hint={easeLabel(summary.averageReadability)}
            />
            <Tile
              label="Variety"
              value={`${Math.round(summary.diversity * 100)}%`}
              hint="different words out of all words"
            />
            <Tile
              label="Average copied run"
              value={`${summary.averageCopied} words`}
              hint="taken in a row from one text"
            />
            <Tile label="Your ratings" value={`${liked} good · ${disliked} bad`} />
          </div>
          <Section title="How the sentences were picked">
            <BarList
              bars={FUNNEL_LABELS.filter(([key]) => summary.funnel[key] > 0 || key === "returned").map(
                ([key, label]) => ({
                  label,
                  value: summary.funnel[key],
                  display: summary.funnel[key].toLocaleString("en"),
                }),
              )}
            />
          </Section>
          {summary.grammarRules.length > 0 && (
            <Section title="Grammar rules that rejected candidates">
              <ul className="flex flex-col gap-2 text-sm">
                {summary.grammarRules.map((entry) => (
                  <li key={entry.rule} className="rounded-lg border px-3 py-2">
                    <p className="font-medium">
                      {entry.rule} · {entry.count}
                    </p>
                    <p className="text-muted-foreground">{entry.example}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <p className="text-xs text-muted-foreground">
            The model writes more candidates than you ask for, drops the ones that fail a check
            and returns the best of the rest. Trained on {run.stats.sentences.toLocaleString("en")} sentences,{" "}
            {run.stats.tokens.toLocaleString("en")} tokens and{" "}
            {run.stats.vocabulary.toLocaleString("en")} distinct words.
          </p>
        </TabsContent>

        <TabsContent value="word" className="flex flex-col gap-4 pt-2">
          {run.words.length > 1 && (
            <ToggleGroup
              type="single"
              variant="outline"
              size="lg"
              spacing={0}
              value={profiled}
              onValueChange={(value) => value && setProfiled(value)}
            >
              {run.words.map((word) => (
                <ToggleGroupItem
                  key={word}
                  value={word}
                  className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {word}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <WordProfile word={profiled} onPickWord={onPickWord} />
        </TabsContent>
      </Tabs>
    </section>
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
