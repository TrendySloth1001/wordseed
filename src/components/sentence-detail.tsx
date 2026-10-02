"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, CheckmarkCircle02Icon, Layers01Icon, Route01Icon } from "@hugeicons/core-free-icons";
import { BarList } from "@/components/bars";
import { Skeleton } from "@/components/ui/skeleton";
import type { SentenceDetail as Detail } from "@/lib/run-types";

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
          Darker words were less expected by the model. The thick border marks the seed word. Tap a
          word to see how it was chosen.
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
        <ul className="flex flex-col gap-1">
          {detail.segments.map((segment) => (
            <li key={segment.start} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 break-words">
                {detail.tokens
                  .slice(segment.start, segment.start + segment.length)
                  .map((entry) => entry.text)
                  .join(" ")}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {segment.source ?? "not in the corpus"} · {segment.length}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Each line is the longest stretch found word for word in one source, with its length in
          tokens.
        </p>
      </div>

      <p className="flex items-center gap-2">
        <HugeiconsIcon
          icon={detail.grammarProblem ? Alert02Icon : CheckmarkCircle02Icon}
          strokeWidth={2}
          className="size-5 shrink-0"
        />
        {detail.grammarProblem
          ? `Grammar check would reject it: ${detail.grammarProblem}.`
          : "Passes the grammar check."}
      </p>
    </div>
  );
}
