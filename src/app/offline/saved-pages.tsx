"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Clock01Icon,
  Database01Icon,
  File01Icon,
  RefreshIcon,
  SparklesIcon,
  WifiDisconnected01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { sourceTitle } from "@/lib/source-reader";

const MAIN = [
  { path: "/", label: "Generate", hint: "Works fully offline: sentences are written on this device", icon: SparklesIcon },
  { path: "/corpus", label: "Corpus", hint: "The texts the models learned from", icon: Database01Icon },
  { path: "/runs", label: "History", hint: "As it was when last saved", icon: Clock01Icon },
];

/** The pages the service worker saved, read straight from its cache. */
export function SavedPages() {
  const [saved, setSaved] = useState<string[] | null>(null);
  // The service worker redirects here with the address that failed to load.
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const from = new URLSearchParams(location.search).get("from");
    caches
      .open("wordseed-pages")
      .then((cache) => cache.keys())
      .then((requests) => requests.map((request) => new URL(request.url).pathname))
      .catch(() => [] as string[])
      .then((paths) => {
        setAddress(from);
        setSaved([...new Set(paths)].filter((path) => path !== "/offline"));
      });
  }, []);

  const main = MAIN.filter((page) => saved === null || saved.includes(page.path));
  const books = (saved ?? []).filter((path) => path.startsWith("/corpus/")).sort();

  return (
    <>
      <header className="flex flex-col items-start gap-4">
        <span className="flex size-14 items-center justify-center rounded-2xl border">
          <HugeiconsIcon icon={WifiDisconnected01Icon} strokeWidth={2} className="size-7" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">This page can&apos;t be loaded</h1>
          <p className="text-muted-foreground">
            {address ? (
              <>
                There is no network connection, and <code className="font-mono text-foreground">{address}</code> was
                not saved on this device.
              </>
            ) : (
              "There is no network connection right now."
            )}{" "}
            Everything below is saved and works without a network.
          </p>
        </div>
        <Button variant="outline" onClick={() => location.assign(address ?? "/")}>
          <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
          Try again
        </Button>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Available offline</h2>
        <ul className="flex flex-col gap-2">
          {main.map((page) => (
            <li key={page.path}>
              <a
                href={page.path}
                className="group flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-background">
                  <HugeiconsIcon icon={page.icon} strokeWidth={2} className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{page.label}</span>
                  <span className="text-sm text-muted-foreground">{page.hint}</span>
                </span>
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4 shrink-0 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      {books.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Books and articles</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {books.map((path) => (
              <li key={path}>
                <a href={path} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                  <HugeiconsIcon icon={File01Icon} strokeWidth={2} className="size-4 shrink-0" />
                  <span className="truncate">{sourceTitle(decodeURIComponent(path.slice("/corpus/".length)))}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {saved !== null && saved.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing has been saved yet. Once you are back online, allow offline use when asked, or turn it on from the{" "}
          <Link href="/corpus" className="underline underline-offset-2">
            Corpus
          </Link>{" "}
          page.
        </p>
      )}
    </>
  );
}
