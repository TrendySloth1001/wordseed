"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RunView } from "@/components/run-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocalRun } from "@/lib/offline/run-store";
import type { Run } from "@/lib/run-types";

/** One saved run: its settings, a link to generate again, and the sentences. */
export function RunPageBody({ run, when }: { run: Run; when: string }) {
  const { settings } = run;
  const again = new URLSearchParams({
    words: run.words.join(" "),
    count: String(run.requested),
    engine: run.engine,
    creativity: String(Math.round(settings.creativity * 100)),
    length: settings.length,
    position: settings.position,
    readability: settings.readability,
    grammar: settings.grammar ? "on" : "off",
  });
  return (
    <>
      <header className="flex flex-col gap-2">
        <Link href="/runs" className="text-sm text-muted-foreground underline underline-offset-4">
          Back to history
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">{run.words.join(", ")}</h1>
        <p className="text-muted-foreground">
          {when} · creativity {Math.round(settings.creativity * 100)}% · length {settings.length} · position{" "}
          {settings.position} · reading level {settings.readability} · grammar check {settings.grammar ? "on" : "off"}
        </p>
      </header>
      <Link
        href={`/?${again}`}
        className="self-start rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Generate again with these settings
      </Link>
      <RunView run={run} />
    </>
  );
}

/** A run the server does not have: look for it among the runs kept in this browser. */
export function LocalRun({ id }: { id: string }) {
  const [run, setRun] = useState<Run | null | undefined>(undefined);

  useEffect(() => {
    getLocalRun(id).then(
      (stored) => setRun(stored?.run ?? null),
      () => setRun(null),
    );
  }, [id]);

  if (run === undefined) {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (run === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Run not found</h1>
        <p className="text-muted-foreground">
          It is not saved on the server or in this browser. Runs are kept per browser, and only the 50 most recent.
        </p>
        <Link href="/runs" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
          Back to history
        </Link>
      </div>
    );
  }
  const when = new Date(run.time).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
  return <RunPageBody run={run} when={when} />;
}

/** LocalRun for the id in the address (?id=), used by /runs/local. */
export function LocalRunFromQuery() {
  const id = useSearchParams().get("id") ?? "";
  return <LocalRun key={id} id={id} />;
}
