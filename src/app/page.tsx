import { Generator } from "./generator";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Sentences from a word
        </h1>
        <p className="text-muted-foreground">
          Give it up to three words and choose how many sentences you want. Both models were
          trained from scratch on classic novels and Simple English Wikipedia.
        </p>
      </header>
      <Generator />
    </main>
  );
}
