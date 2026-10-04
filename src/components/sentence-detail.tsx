"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowDown01Icon,
  Book02Icon,
  CheckmarkCircle02Icon,
  Layers01Icon,
  Route01Icon,
} from "@hugeicons/core-free-icons";
import { BarList } from "@/components/bars";
import { Skeleton } from "@/components/ui/skeleton";
import type { SentenceDetail as Detail } from "@/lib/run-types";
import { sourceTitle } from "@/lib/source-reader";
import { apiFetch } from "@/lib/offline/client";

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
  // Why the breakdown could not be loaded, when it could not.
  const [failed, setFailed] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/runs/${runId}/sentences/${index}`)
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error);
        return data;
      })
      .then((data) => active && setDetail(data))
      .catch((error: Error) =>
        active && setFailed(error.message || "The breakdown for this sentence is no longer available."),
      );
    return () => {
      active = false;
    };
  }, [runId, index]);

  if (failed) return <p className="text-sm text-muted-foreground">{failed}</p>;
  if (!detail) return <Skeleton className="h-28 w-full" />;

  const token = selected === null ? null : detail.tokens[selected];

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-2">
        {/* Plain words, no boxes. The bar under each word shows how much it
            surprised the model (darker = more), the marker above shows where
            the sentence started, and the line below is its part of speech. */}
        <div className="flex flex-wrap gap-x-1 gap-y-3">
          {detail.tokens.map((entry, i) => {
            const level = surprise(entry.probability);
            const seed = i === detail.seed;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i === selected ? null : i)}
                aria-pressed={i === selected}
                aria-label={`${entry.text}${seed ? ", where the sentence started" : ""}`}
                className={`flex flex-col items-center gap-1 rounded-lg border px-1.5 pt-0.5 pb-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  i === selected ? "border-foreground" : "border-transparent hover:border-border"
                }`}
              >
                <span className="h-3 text-[0.55rem] leading-3 font-semibold tracking-widest text-muted-foreground uppercase">
                  {seed ? "start" : ""}
                </span>
                <span className={`leading-5 ${seed ? "font-semibold underline decoration-2 underline-offset-4" : ""}`}>
                  {entry.text}
                </span>
                <span
                  className="h-1 w-full min-w-3 rounded-full bg-foreground"
                  style={{ opacity: entry.tag === "punct" ? 0 : 0.1 + level * 0.9 }}
                  aria-hidden
                />
                <span className="text-[0.65rem] leading-3 text-muted-foreground">
                  {entry.tag === "punct" ? " " : entry.tag}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            expected
            <span className="flex gap-0.5" aria-hidden>
              {[0.1, 0.32, 0.55, 0.78, 1].map((opacity) => (
                <span key={opacity} className="h-1 w-3 rounded-full bg-foreground" style={{ opacity }} />
              ))}
            </span>
            surprising
          </span>
          <span>Tap a word to see how it was chosen.</span>
        </div>
      </div>

      {token && (
        <div className="flex flex-col gap-2 rounded-xl border p-3">
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
        <ul className="divide-y overflow-hidden rounded-xl border">
          {detail.segments.map((segment) => (
            <SegmentRow
              key={segment.start}
              source={segment.source}
              words={detail.tokens.slice(segment.start, segment.start + segment.length).map((entry) => entry.text)}
            />
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Each line appears word for word in the book or article named beside it. Tap one to read
          the original passage.
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
      <li className="flex items-baseline justify-between gap-3 px-3 py-2">
        <span className="min-w-0 break-words">{shown}</span>
        <span className="shrink-0 text-xs text-muted-foreground">not in the texts</span>
      </li>
    );
  }

  const address = `${encodeURIComponent(source)}?find=${encodeURIComponent(phrase)}`;

  function toggle() {
    setOpen(!open);
    if (passage) return;
    apiFetch(`/api/sources/${address}`)
      .then((response) => (response.ok ? response.json() : "missing"))
      .catch(() => "missing")
      .then(setPassage);
  }

  // Enough of the paragraph to read the stretch in context.
  const from = passage && passage !== "missing" ? Math.max(0, passage.start - 220) : 0;
  const to = passage && passage !== "missing" ? Math.min(passage.text.length, passage.end + 220) : 0;

  return (
    <li>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span className="min-w-0 break-words">{shown}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <HugeiconsIcon icon={Book02Icon} strokeWidth={2} className="size-4" />
          <span className="max-w-32 truncate font-medium text-foreground sm:max-w-none">{sourceTitle(source)}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-3 pb-3">
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
