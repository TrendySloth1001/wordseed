"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiBrain01Icon,
  GitBranchIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "@hugeicons/core-free-icons";
import { engineName } from "@/components/run-view";
import { DeleteButton } from "@/components/confirm-button";
import { Tile } from "@/components/word-profile";
import type { Engine, RunListItem } from "@/lib/run-types";
import { apiFetch } from "@/lib/offline/client";

const ENGINES: Engine[] = ["markov", "neural"];

export function RunList({ initial }: { initial: RunListItem[] }) {
  const [runs, setRuns] = useState(initial);

  async function remove(id: string) {
    const response = await apiFetch(`/api/runs/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      toast.error("Could not delete that run");
      return;
    }
    setRuns((current) => current.filter((run) => run.id !== id));
    toast.success("Deleted");
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">Nothing saved yet. Sentences you generate appear here.</p>
        <Link
          href="/"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Generate sentences
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2">
        {ENGINES.map((engine) => {
          const mine = runs.filter((run) => run.engine === engine);
          const liked = mine.reduce((sum, run) => sum + run.liked, 0);
          const rated = liked + mine.reduce((sum, run) => sum + run.disliked, 0);
          return (
            <Tile
              key={engine}
              label={`${engineName({ engine })} sentences rated good`}
              value={rated === 0 ? "No ratings" : `${liked} of ${rated} · ${Math.round((liked / rated) * 100)}%`}
            />
          );
        })}
      </div>

      <ul className="flex flex-col gap-2">
        {runs.map((run) => (
          <li key={run.id} className="flex items-center gap-1 rounded-lg border pr-1">
            <Link href={`/runs/${run.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
              <HugeiconsIcon
                icon={run.engine === "markov" ? GitBranchIcon : AiBrain01Icon}
                strokeWidth={2}
                className="size-6 shrink-0"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{run.words.join(", ")}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {run.sentences} sentences · {engineName(run)} ·{" "}
                  {new Date(run.time).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </span>
            </Link>
            {run.liked + run.disliked > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums">
                <HugeiconsIcon icon={ThumbsUpIcon} strokeWidth={2} className="size-4" />
                {run.liked}
                <HugeiconsIcon icon={ThumbsDownIcon} strokeWidth={2} className="ml-1 size-4" />
                {run.disliked}
              </span>
            )}
            <DeleteButton
              label={`Delete the saved sentences for ${run.words.join(", ")}`}
              onConfirm={() => remove(run.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
