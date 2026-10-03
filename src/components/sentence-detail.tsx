"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  CheckmarkCircle02Icon,
  Layers01Icon,
  Route01Icon,
} from "@hugeicons/core-free-icons";
import { BarList } from "@/components/bars";
import { Skeleton } from "@/components/ui/skeleton";
import type { SentenceDetail as Detail } from "@/lib/run-types";
import { sourceTitle } from "@/lib/source-reader";

const TAG_NAMES: Record<string, string> = {
  det: "determiner",
  poss: "possessive",
  coord: "conjunction",
  subord: "conjunction",
  subject: "pronoun",
  be: "verb (be)",
  aux: "auxiliary",
  modal: "modal",
  prep: "preposition",
  to: "to",
  verb: "verb",
  punct: "punctuation",
  other: "other",
};

/** 0 for a certain token, 1 for one the model gave under 0.01% */
function surprise(probability: number | null): number {
  if (probability === null) return 0;
  return Math.min(1, -Math.log10(Math.max(probability, 1e-4)) / 4);
}

function percent(value: number): string {
  if (value >= 0.1) return `${Math.round(value * 100)}%`;
  if (value >= 0.001) return `${(value * 100).toFixed(1)}%`;
  return "under 0.1%";
}

export function SentenceDetail({ runId, index }: { runId: string; index: number }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/runs/${runId}/sentences/${index}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => active && setDetail(data))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [runId, index]);

  if (failed) {
    return <p className="text-sm text-muted-foreground">The breakdown for this sentence is no longer available.</p>;
  }
  if (!detail) return <Skeleton className="h-28 w-full" />;

  const token = selected === null ? null : detail.tokens[selected];

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-x-1 gap-y-2">
          {detail.tokens.map((entry, i) => {
            const shade = surprise(entry.probability) * 60;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i === selected ? null : i)}
                className="flex flex-col items-center gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={`rounded-md px-1.5 py-1 leading-5 ${shade > 32 ? "text-background" : "text-foreground"} ${
                    i === detail.seed ? "border-2 border-foreground font-semibold" : "border border-border"
                  } ${i === selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
                  style={{ backgroundColor: `color-mix(in oklch, var(--foreground) ${shade}%, transparent)` }}
                >
                  {entry.text}
                </span>
                <span className="text-[0.65rem] leading-3 text-muted-foreground">
                  {entry.tag === "punct" ? " " : entry.tag}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Tap any word to see how it was chosen. Darker words surprised the model more; the word
          with the thick border is where the sentence started.
        </p>
      </div>

      {token && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="flex items-center gap-2 font-medium">
            <HugeiconsIcon icon={Route01Icon} strokeWidth={2} className="size-5 shrink-0" />
            <span>
              &ldquo;{token.text}&rdquo; · {TAG_NAMES[token.tag]}
              {token.rare && " · rare word"}
            </span>
          </p>
          <p className="text-muted-foreground">
            {token.step}
            {token.probability !== null && ` Probability: ${percent(token.probability)}.`}
            {token.occurrences !== null &&
              ` That context occurs ${token.occurrences.toLocaleString("en")} time${token.occurrences === 1 ? "" : "s"} in the corpus.`}
          </p>
          {token.options.length > 0 && (
            <BarList
              max={1}
              bars={token.options.map((option) => ({
                label: option.word,
                value: option.share,
                display: percent(option.share),
              }))}
            />
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 font-medium">
          <HugeiconsIcon icon={Layers01Icon} strokeWidth={2} className="size-5" />
          Where the wording comes from
        </p>
        <ul className="flex flex-col gap-1.5">
          {detail.segments.map((segment) => (
            <SegmentRow
              key={segment.start}
              source={segment.source}
              words={detail.tokens.slice(segment.start, segment.start + segment.length).map((entry) => entry.text)}
            />
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Each line is a stretch that appears word for word in the text named beside it. Tap a
          line to read the original passage.
        </p>
      </div>

      <p className="flex items-center gap-2">
        <HugeiconsIcon
          icon={detail.grammarProblem ? Alert02Icon : CheckmarkCircle02Icon}
          strokeWidth={2}
          className="size-5 shrink-0"
        />
        {detail.grammarProblem
          ? `The grammar check would reject this sentence: ${detail.grammarProblem}.`
          : "Passes the grammar check."}
      </p>
    </div>
  );
}

type Passage = { text: string; start: number; end: number };

/** One copied stretch; opening it shows the original passage around it. */
function SegmentRow({ words, source }: { words: string[]; source: string | null }) {
  const [open, setOpen] = useState(false);
  const [passage, setPassage] = useState<Passage | "missing" | null>(null);
  const phrase = words.join(" ");
  const shown = phrase.replace(/ ([,;:.!?])/g, "$1");

  if (!source) {
    return (
      <li className="flex items-baseline justify-between gap-3 px-2 py-1">
        <span className="min-w-0 break-words">{shown}</span>
        <span className="shrink-0 text-xs text-muted-foreground">not in the texts</span>
      </li>
    );
  }

  const address = `${encodeURIComponent(source)}?find=${encodeURIComponent(phrase)}`;

  function toggle() {
    setOpen(!open);
    if (passage) return;
    fetch(`/api/sources/${address}`)
      .then((response) => (response.ok ? response.json() : "missing"))
      .catch(() => "missing")
      .then(setPassage);
  }

  // Enough of the paragraph to read the stretch in context.
  const from = passage && passage !== "missing" ? Math.max(0, passage.start - 220) : 0;
  const to = passage && passage !== "missing" ? Math.min(passage.text.length, passage.end + 220) : 0;

  return (
    <li className="rounded-lg border">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 break-words">{shown}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium underline underline-offset-4">
          {sourceTitle(source)}
          <HugeiconsIcon icon={open ? ArrowUp01Icon : ArrowDown01Icon} strokeWidth={2} className="size-4" />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t px-2 py-2">
          {passage === null && <Skeleton className="h-16 w-full" />}
          {passage === "missing" && (
            <p className="text-muted-foreground">The exact passage could not be located in this text.</p>
          )}
          {passage && passage !== "missing" && (
            <blockquote className="border-l-2 border-foreground pl-3 leading-7">
              {from > 0 && "… "}
              {passage.text.slice(from, passage.start)}
              <mark className="rounded-sm bg-foreground px-1 text-background">
                {passage.text.slice(passage.start, passage.end)}
              </mark>
              {passage.text.slice(passage.end, to)}
              {to < passage.text.length && " …"}
            </blockquote>
          )}
          <Link
            href={`/corpus/${address}`}
            target="_blank"
            className="self-start text-sm font-medium underline underline-offset-4"
          >
            Read it in {sourceTitle(source)} (opens a new tab)
          </Link>
        </div>
      )}
    </li>
  );
}
