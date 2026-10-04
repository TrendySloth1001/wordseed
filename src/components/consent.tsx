"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CookieIcon } from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { saveStorageChoice, useStorageChoice } from "@/lib/consent";

/**
 * A small notice in the corner asking what this browser may keep. "Allow"
 * keeps History and loads GitHub info; "Essential only" keeps just the theme
 * and these answers. Changeable later in Settings.
 */
export function StorageNotice() {
  const choice = useStorageChoice();
  const pathname = usePathname();
  // Not yet known (server, first paint), already answered, or on the page that explains it all.
  if (choice !== null || pathname === "/privacy") return null;

  return (
    <section
      aria-label="Browser storage"
      // Bottom-left, raised above the footer line so the footer stays readable
      // underneath (on a phone: above the bottom bar).
      data-corner-notice
      className="fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] z-40 flex flex-col gap-3 rounded-2xl border bg-background/95 p-3.5 shadow-xl shadow-black/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500 md:inset-x-auto md:bottom-[5.5rem] md:left-5 md:w-80 dark:shadow-black/40 print:hidden"
    >
      <p className="flex gap-2.5 text-[0.8rem] leading-snug">
        <CookieIcon className="size-4 shrink-0" />
        <span>
          No cookies here. Your browser keeps your theme, and with your OK, your History and the GitHub info in the
          footer.{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Details
          </Link>
        </span>
      </p>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => saveStorageChoice({ history: true, external: true })}>
          Allow
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={() => saveStorageChoice({ history: false, external: false })}>
          Essential only
        </Button>
      </div>
    </section>
  );
}
