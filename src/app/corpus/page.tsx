import type { Metadata } from "next";
import { READ_ONLY } from "@/lib/deployment";
import { CorpusManager } from "./corpus-manager";

export const metadata: Metadata = { title: "Corpus" };

export default function CorpusPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Corpus</h1>
        <p className="text-muted-foreground">
          The text the models learn from.
          {!READ_ONLY && " Add your own .txt file and the Markov model retrains on it straight away, so its words become available."}
        </p>
      </header>
      <CorpusManager uploads={!READ_ONLY} />
    </main>
  );
}
