import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readSource } from "@/lib/corpus";
import {
  findPassage,
  isHeading,
  paragraphs,
  PARAGRAPHS_PER_PAGE,
  sourceTitle,
} from "@/lib/source-reader";
import { ScrollToMatch } from "./scroll-to-match";

export async function generateMetadata(props: PageProps<"/corpus/[name]">): Promise<Metadata> {
  const name = decodeURIComponent((await props.params).name);
  const title = sourceTitle(name);
  return {
    title,
    description: `Read ${title}, one of the texts the wordseed language models were trained on, and find where any phrase came from.`,
    alternates: { canonical: `/corpus/${encodeURIComponent(name)}` },
  };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function SourcePage(props: PageProps<"/corpus/[name]">) {
  const name = decodeURIComponent((await props.params).name);
  const query = await props.searchParams;
  const text = await readSource(name);
  if (text === null) notFound();

  const blocks = paragraphs(text);
  const pages = Math.max(1, Math.ceil(blocks.length / PARAGRAPHS_PER_PAGE));
  const find = first(query.find)?.trim().slice(0, 300) ?? "";
  const after = Number(first(query.after));
  const passage = find ? findPassage(blocks, find, Number.isInteger(after) ? after : -1) : null;
  const page = passage
    ? Math.floor(passage.paragraph / PARAGRAPHS_PER_PAGE) + 1
    : Math.min(pages, Math.max(1, Math.floor(Number(first(query.page))) || 1));
  const offset = (page - 1) * PARAGRAPHS_PER_PAGE;
  const base = `/corpus/${encodeURIComponent(name)}`;
  const findQuery = `find=${encodeURIComponent(find)}`;

  const pager = (
    <nav className="flex items-center justify-between gap-2" aria-label="Pages">
      <Button asChild={page > 1} variant="outline" size="lg" disabled={page <= 1} className="h-10">
        {page > 1 ? (
          <Link href={`${base}?page=${page - 1}`}>
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-5" />
            Previous
          </Link>
        ) : (
          <span>Previous</span>
        )}
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums">
        Page {page.toLocaleString("en")} of {pages.toLocaleString("en")}
      </span>
      <Button asChild={page < pages} variant="outline" size="lg" disabled={page >= pages} className="h-10">
        {page < pages ? (
          <Link href={`${base}?page=${page + 1}`}>
            Next
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-5" />
          </Link>
        ) : (
          <span>Next</span>
        )}
      </Button>
    </nav>
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex flex-col gap-3">
        <Link href="/corpus" className="text-sm text-muted-foreground underline underline-offset-4">
          Back to the corpus
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
          {sourceTitle(name)}
        </h1>
        <form action={base} className="flex gap-2">
          <Input
            name="find"
            defaultValue={find}
            placeholder="Find a word or phrase in this text"
            aria-label="Find a word or phrase in this text"
            autoComplete="off"
            className="h-10 text-base md:text-base"
          />
          <Button type="submit" size="lg" className="h-10">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-5" />
            Find
          </Button>
        </form>
        {find && (
          <p className="text-sm" role="status">
            {passage ? (
              <>
                Found &ldquo;{find}&rdquo;, highlighted below.{" "}
                <Link
                  href={`${base}?${findQuery}&after=${passage.paragraph}`}
                  className="font-medium underline underline-offset-4"
                >
                  Next match
                </Link>
              </>
            ) : Number.isInteger(after) ? (
              <>
                No more matches for &ldquo;{find}&rdquo;.{" "}
                <Link href={`${base}?${findQuery}`} className="font-medium underline underline-offset-4">
                  Back to the first match
                </Link>
              </>
            ) : (
              <>&ldquo;{find}&rdquo; does not appear in this text.</>
            )}
          </p>
        )}
      </header>

      {pager}

      <article className="flex flex-col gap-4 text-[1.05rem] leading-8">
        {blocks.slice(offset, offset + PARAGRAPHS_PER_PAGE).map((block, index) => {
          const number = offset + index;
          if (passage?.paragraph === number) {
            return (
              <p key={number}>
                {block.slice(0, passage.start)}
                <mark id="match" className="rounded-sm bg-foreground px-1 text-background">
                  {block.slice(passage.start, passage.end)}
                </mark>
                {block.slice(passage.end)}
              </p>
            );
          }
          return isHeading(block) ? (
            <h2 key={number} className="pt-4 text-lg font-semibold">
              {block}
            </h2>
          ) : (
            <p key={number}>{block}</p>
          );
        })}
      </article>

      {pager}
      {passage && <ScrollToMatch key={`${find}-${passage.paragraph}`} />}
    </main>
  );
}
