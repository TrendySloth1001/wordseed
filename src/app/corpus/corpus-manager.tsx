"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  AiBrain01Icon,
  Alert02Icon,
  Delete02Icon,
  File01Icon,
  Loading03Icon,
  ChartHistogramIcon,
  ParagraphIcon,
  TextFontIcon,
  TextIcon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarList, Histogram } from "@/components/bars";
import { Section } from "@/components/word-profile";
import type { CorpusStatistics } from "@/lib/sentence-model";

type Summary = {
  sources: { name: string; bytes: number; uploaded: boolean }[];
  stats: { sentences: number; tokens: number; vocabulary: number };
  statistics: CorpusStatistics;
  neural: { vocabulary: number; perplexity: number } | null;
};

export function CorpusManager() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  /** Runs a request against /api/corpus and shows the summary it returns. */
  async function request(url: string, init?: RequestInit): Promise<boolean> {
    try {
      const response = await fetch(url, init);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error);
        return false;
      }
      setError(null);
      setSummary(data);
      return true;
    } catch {
      setError("Could not reach the server. Is it still running?");
      return false;
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/corpus")
      .then((response) => response.json())
      .then((data) => active && setSummary(data))
      .catch(() => active && setError("Could not reach the server. Is it still running?"));
    return () => {
      active = false;
    };
  }, []);

  async function upload(file: File) {
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    if (await request("/api/corpus", { method: "POST", body })) {
      toast.success(`Added ${file.name} and retrained the Markov model`);
    }
    setBusy(false);
  }

  async function remove(name: string) {
    setBusy(true);
    if (await request(`/api/corpus?name=${encodeURIComponent(name)}`, { method: "DELETE" })) {
      toast.success(`Removed ${name}`);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert>
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-5" />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Stat icon={ParagraphIcon} label="Sentences" value={summary?.stats.sentences} />
        <Stat icon={TextIcon} label="Tokens" value={summary?.stats.tokens} />
        <Stat icon={TextFontIcon} label="Words" value={summary?.stats.vocabulary} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2 font-medium">
              <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} className="size-5" />
              Add your own text
            </h2>
            <p className="text-sm text-muted-foreground">
              A plain .txt file, up to 5 MB. More text means more words and better sentences.
            </p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              event.target.value = "";
            }}
          />
          <Button
            size="lg"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="h-11 shrink-0"
          >
            <HugeiconsIcon
              icon={busy ? Loading03Icon : Upload01Icon}
              strokeWidth={2}
              className={busy ? "size-5 animate-spin" : "size-5"}
            />
            {busy ? "Retraining…" : "Upload .txt"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 font-medium">
            <HugeiconsIcon icon={AiBrain01Icon} strokeWidth={2} className="size-5" />
            Neural model
          </h2>
          <p className="text-sm text-muted-foreground">
            {!summary
              ? "Loading…"
              : summary.neural
                ? `Trained, with a ${summary.neural.vocabulary.toLocaleString("en")}-word vocabulary and a held-out perplexity of ${summary.neural.perplexity}. It is trained offline, so uploads do not change it until you run npm run train:neural.`
                : "Not trained yet. Run npm run train:neural to train it on the built-in corpus."}
          </p>
        </CardContent>
      </Card>

      {summary && (
        <section className="flex flex-col gap-5">
          <h2 className="flex items-center gap-2 font-medium">
            <HugeiconsIcon icon={ChartHistogramIcon} strokeWidth={2} className="size-5" />
            Statistics
          </h2>
          <Section
            title={`Sentence length in words · average ${summary.statistics.averageSentenceLength.toFixed(1)}`}
          >
            <Histogram
              bars={summary.statistics.sentenceLengths.map((bucket) => ({
                label: bucket.label,
                value: bucket.count,
              }))}
            />
          </Section>
          <div className="grid gap-5 sm:grid-cols-2">
            <Section title="Most common words">
              <BarList bars={counted(summary.statistics.topWords)} />
            </Section>
            <Section title="Most common content words">
              <BarList bars={counted(summary.statistics.topContentWords)} />
            </Section>
            <Section title="Most common word pairs">
              <BarList bars={counted(summary.statistics.topPairs)} />
            </Section>
            <Section title="Tokens per source">
              <BarList
                bars={counted([...summary.statistics.sources].sort((a, b) => b.count - a.count).slice(0, 12))}
              />
            </Section>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Sources</h2>
        {!summary &&
          Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
        <ul className="flex flex-col gap-2">
          {summary?.sources.map((source) => (
            <li key={source.name} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <HugeiconsIcon icon={File01Icon} strokeWidth={2} className="size-5 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm">{source.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(source.bytes)}</span>
              {source.uploaded ? (
                <>
                  <Badge>Uploaded</Badge>
                  <Button
                    size="icon-lg"
                    variant="ghost"
                    disabled={busy}
                    aria-label={`Remove ${source.name}`}
                    onClick={() => remove(source.name)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-5" />
                  </Button>
                </>
              ) : (
                <Badge variant="outline" className="hidden min-[400px]:inline-flex">
                  Built-in
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: IconSvgElement; label: string; value?: number }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <HugeiconsIcon icon={icon} strokeWidth={2} className="size-6" />
        {value === undefined ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <span className="text-lg font-semibold tabular-nums sm:text-2xl">
            {new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

function counted(items: { word: string; count: number }[]) {
  return items.map((item) => ({ label: item.word, value: item.count }));
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
