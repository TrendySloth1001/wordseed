import type { Metadata } from "next";
import { Suspense } from "react";
import { LocalRunFromQuery } from "../[id]/run-page-body";

export const metadata: Metadata = { title: "Saved run", robots: { index: false, follow: false } };

/**
 * A run kept in this browser, named by ?id=. One static page for all of them,
 * so it is saved once for offline use and opens any of them without a network.
 */
export default function LocalRunPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <Suspense>
        <LocalRunFromQuery />
      </Suspense>
    </main>
  );
}
