"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, DocumentValidationIcon, Shield01Icon, SparklesIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

const POINTS = [
  { icon: Alert02Icon, text: "Sentences are machine-written from old books and Wikipedia, so they can be wrong, odd or offensive." },
  { icon: SparklesIcon, text: "A free student project, given as is: fun to explore, not facts to rely on." },
  { icon: Shield01Icon, text: "Use it at a human pace: requests are rate-limited." },
];

/**
 * The terms in a nutshell, popping out under the word bar the first time
 * someone generates. Agreeing carries straight on with their request.
 */
/** Where the side card's caret sits from its top, so it can be lined up with the button. */
const CARET_TOP = 80;

/**
 * On wide screens the card floats beside the Generate button (anchor), outside
 * the form, so the form's clipping can't cut it off; on narrower ones it sits
 * inline under the word bar.
 */
function useBeside(anchor: RefObject<HTMLElement | null>) {
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const wide = window.matchMedia("(min-width: 80rem)");
    const update = () => {
      const box = anchor.current?.getBoundingClientRect();
      setPlace(wide.matches && box ? { top: box.top + box.height / 2 - CARET_TOP - 6, left: box.right + 20 } : null);
    };
    update();
    addEventListener("resize", update);
    addEventListener("scroll", update, true);
    wide.addEventListener("change", update);
    return () => {
      removeEventListener("resize", update);
      removeEventListener("scroll", update, true);
      wide.removeEventListener("change", update);
    };
  }, [anchor]);
  return place;
}

export function TermsCard({
  anchor,
  onAgree,
  onCancel,
}: {
  anchor: RefObject<HTMLElement | null>;
  onAgree: () => void;
  onCancel: () => void;
}) {
  const agree = useRef<HTMLButtonElement>(null);
  const place = useBeside(anchor);
  // preventScroll: focusing must never scroll the form or the page.
  useEffect(() => agree.current?.focus({ preventScroll: true }), []);

  const card = (
    <div
      role="dialog"
      aria-labelledby="terms-card-title"
      onKeyDown={(event) => event.key === "Escape" && onCancel()}
      style={place ?? undefined}
      className={`animate-[terms-pop_0.45s_cubic-bezier(0.34,1.56,0.64,1)_both] rounded-2xl border bg-background p-4 shadow-xl shadow-black/10 dark:shadow-black/40 ${
        place ? "fixed z-40 w-72 origin-left" : "relative mt-1 origin-top"
      }`}
    >
      {/* Points at the Generate button: left from beside it, or up from below it. */}
      <span
        className={`absolute size-3 rotate-45 bg-background ${place ? "-left-1.5 border-b border-l" : "-top-1.5 left-8 border-t border-l"}`}
        style={place ? { top: CARET_TOP } : undefined}
        aria-hidden
      />
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-foreground/30">
          <HugeiconsIcon icon={DocumentValidationIcon} strokeWidth={1.8} className="size-5" />
        </span>
        <p id="terms-card-title" className="font-medium">
          Quick one before your first sentences
        </p>
      </div>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
        {POINTS.map((point) => (
          <li key={point.text} className="flex gap-2.5">
            <HugeiconsIcon icon={point.icon} strokeWidth={2} className="mt-0.5 size-4 shrink-0 text-foreground" />
            {point.text}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button ref={agree} type="button" className="group" onClick={onAgree}>
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2.5} className="size-4" />
          Agree &amp; generate
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Not now
        </Button>
        <Link href="/terms" target="_blank" className="ml-auto text-xs text-muted-foreground underline underline-offset-4">
          Full terms of use
        </Link>
      </div>
    </div>
  );
  return place ? createPortal(card, document.body) : card;
}
