"use client";

import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CONTENTS } from "./contents";

/** Tracks which section is being read, and how far down the page the reader is. */
function useReading() {
  const [active, setActive] = useState(CONTENTS[0].id);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const sections = CONTENTS.map(({ id }) => document.getElementById(id)).filter((section) => section !== null);
    // The section crossing a line a quarter of the way down the screen is the one being read.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((item) => item.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-25% 0px -70% 0px" },
    );
    sections.forEach((section) => observer.observe(section));

    const onScroll = () => {
      const total = document.documentElement.scrollHeight - innerHeight;
      setProgress(total > 0 ? Math.min(1, scrollY / total) : 0);
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      removeEventListener("scroll", onScroll);
    };
  }, []);

  return { active, progress };
}

/** The sticky contents list beside the article on wide screens. */
export function Toc() {
  const { active, progress } = useReading();
  const list = useRef<HTMLOListElement>(null);

  // Keep the current entry in view by scrolling the list only, never the page.
  useEffect(() => {
    const box = list.current;
    const item = box?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!box || !item) return;
    if (item.offsetTop < box.scrollTop) box.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = item.offsetTop + item.offsetHeight - box.clientHeight;
    }
  }, [active]);

  return (
    <nav
      aria-label="Contents"
      className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] w-64 shrink-0 flex-col gap-3 self-start lg:flex print:hidden"
    >
      <div className="flex flex-col gap-2 px-2 pt-1">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">On this page</p>
          <p className="text-xs text-muted-foreground tabular-nums">{Math.round(progress * 100)}% read</p>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-foreground transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <ol ref={list} className="relative flex flex-col gap-0.5 overflow-y-auto [scrollbar-width:none]">
        {CONTENTS.map(({ id, title, icon }, index) => {
          const current = id === active;
          return (
            <li key={id} data-id={id}>
              <a
                href={`#${id}`}
                aria-current={current ? "location" : undefined}
                className={`group flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors ${
                  current ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                    current ? "border-foreground" : "border-transparent group-hover:border-foreground/30"
                  }`}
                >
                  <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
                </span>
                <span className="min-w-0 leading-snug">
                  <span className="mr-1 tabular-nums opacity-60">{String(index + 1).padStart(2, "0")}</span>
                  {title}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** On narrower screens: every section as a card to jump to, under the introduction. */
export function JumpGrid() {
  return (
    <nav aria-label="Contents" className="lg:hidden print:hidden">
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CONTENTS.map(({ id, title, icon, blurb }, index) => (
          <li key={id}>
            <a href={`#${id}`} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/60">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-foreground/30">
                <HugeiconsIcon icon={icon} strokeWidth={2} className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  <span className="mr-1 text-muted-foreground tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                  {title}
                </span>
                <span className="truncate text-xs text-muted-foreground">{blurb}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
