"use client";

import { useEffect, useState } from "react";
import { BarList } from "@/components/bars";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { WordProfile as Profile } from "@/lib/sentence-model";
import { sourceTitle } from "@/lib/source-reader";
import { apiFetch } from "@/lib/offline/client";

export function WordProfile({ word, onPickWord }: { word: string; onPickWord?: (word: string) => void }) {
  const [loaded, setLoaded] = useState<{ word: string; profile: Profile | null } | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/word?word=${encodeURIComponent(word)}`)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((profile) => active && setLoaded({ word, profile }));
    return () => {
      active = false;
    };
  }, [word]);

  if (loaded?.word !== word) return <Skeleton className="h-40 w-full" />;
  const profile = loaded.profile;
  if (!profile) return <p className="text-sm text-muted-foreground">No profile is available for this word.</p>;

  const bars = (items: { word: string; count: number }[]) =>
    items.map((item) => ({ label: item.word, value: item.count, display: item.count.toLocaleString("en") }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Times used" value={profile.count.toLocaleString("en")} hint="in all the texts" />
        <Tile label="Per million" value={Math.round(profile.perMillion).toLocaleString("en")} hint="words of text" />
        <Tile label="Rank" value={`#${profile.rank.toLocaleString("en")}`} hint="1 is the commonest" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="Words that come before it">
          <BarList bars={bars(profile.before)} />
        </Section>
        <Section title="Words that come after it">
          <BarList bars={bars(profile.after)} />
        </Section>
      </div>

      <Section title="Texts that use it · tap one to read it there">
        <BarList
          bars={profile.sources.slice(0, 8).map((source) => ({
            label: sourceTitle(source.word),
            value: source.count,
            display: source.count.toLocaleString("en"),
            href: `/corpus/${encodeURIComponent(source.word)}?find=${encodeURIComponent(profile.word)}`,
          }))}
        />
      </Section>

      {profile.similar.length > 0 && (
        <Section title="Similar words · tap one to generate sentences for it">
          <div className="flex flex-wrap gap-2">
            {profile.similar.map((similar) => (
              <Button
                key={similar}
                type="button"
                variant="outline"
                disabled={!onPickWord}
                onClick={() => onPickWord?.(similar)}
                className="disabled:opacity-100"
              >
                {similar}
              </Button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-xs font-medium">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}
