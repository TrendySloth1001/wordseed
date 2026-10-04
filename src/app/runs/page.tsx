import type { Metadata } from "next";
import { connection } from "next/server";
import { READ_ONLY } from "@/lib/deployment";
import { listRuns } from "@/lib/runs";
import { RunList } from "./run-list";

// Each visitor's own runs: nothing for search engines here.
export const metadata: Metadata = { title: "History", robots: { index: false, follow: true } };

export default async function RunsPage() {
  // The list changes with every generation, so render it per request.
  await connection();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">History</h1>
        <p className="text-muted-foreground">
          {READ_ONLY
            ? "Every generation is saved in this browser with its ratings. The 50 most recent are kept."
            : "Every generation is saved here with its ratings. The 50 most recent are kept."}
        </p>
      </header>
      <RunList initial={await listRuns()} />
    </main>
  );
}
