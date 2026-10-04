import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RunView } from "@/components/run-view";
import { getRun } from "@/lib/runs";

export const metadata: Metadata = { title: "Saved run" };

export default async function RunPage(props: PageProps<"/runs/[id]">) {
  const { id } = await props.params;
  const run = await getRun(id);
  if (!run) notFound();

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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <Link href="/runs" className="text-sm text-muted-foreground underline underline-offset-4">
          Back to history
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
          {run.words.join(", ")}
        </h1>
        <p className="text-muted-foreground">
          {new Date(run.time).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })} ·
          creativity {Math.round(settings.creativity * 100)}% · length {settings.length} · position{" "}
          {settings.position} · reading level {settings.readability} · grammar check{" "}
          {settings.grammar ? "on" : "off"}
        </p>
      </header>
      <Link
        href={`/?${again}`}
        className="self-start rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Generate again with these settings
      </Link>
      <RunView run={run} />
    </main>
  );
}
