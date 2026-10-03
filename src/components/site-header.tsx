"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BookOpen01Icon,
  Clock01Icon,
  Database01Icon,
  Moon02Icon,
  QuillWrite01Icon,
  SparklesIcon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";

const LINKS = [
  { href: "/", label: "Generate", icon: SparklesIcon },
  { href: "/runs", label: "History", icon: Clock01Icon },
  { href: "/corpus", label: "Corpus", icon: Database01Icon },
  { href: "/docs", label: "Docs", icon: BookOpen01Icon },
];

/** The top bar: just the app's name, which links home. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[90rem] items-center px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
          <HugeiconsIcon icon={QuillWrite01Icon} strokeWidth={2} className="size-6 shrink-0" />
          <span className="truncate">Word to sentences</span>
        </Link>
      </div>
    </header>
  );
}

/**
 * Navigation that floats over the page: a bar along the bottom on a phone,
 * and a column of round buttons in the bottom-right corner on larger screens,
 * each showing its name on hover or keyboard focus.
 */
export function SiteNav() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");
  const surface = "border bg-background/85 shadow-lg shadow-black/10 backdrop-blur-md dark:shadow-black/40";

  return (
    <>
      <nav
        aria-label="Main"
        className={`fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-5 gap-1 rounded-2xl p-1.5 md:hidden ${surface}`}
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active(link.href) ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[0.7rem] font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active(link.href) ? "bg-foreground text-background" : "text-muted-foreground active:bg-muted"
            }`}
          >
            <HugeiconsIcon icon={link.icon} strokeWidth={2} className="size-5" />
            {link.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Switch between light and dark"
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[0.7rem] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted"
        >
          <HugeiconsIcon icon={Moon02Icon} strokeWidth={2} className="size-5 dark:hidden" />
          <HugeiconsIcon icon={Sun03Icon} strokeWidth={2} className="hidden size-5 dark:block" />
          Theme
        </button>
      </nav>

      <nav
        aria-label="Main"
        className={`fixed right-5 bottom-5 z-30 hidden flex-col items-center gap-1 rounded-full p-1.5 md:flex ${surface}`}
      >
        {LINKS.map((link) => (
          <FloatingButton key={link.href} label={link.label} active={active(link.href)} href={link.href}>
            <HugeiconsIcon icon={link.icon} strokeWidth={2} className="size-5" />
          </FloatingButton>
        ))}
        <span className="my-0.5 h-px w-6 bg-border" aria-hidden />
        <FloatingButton label="Light or dark" onClick={toggleTheme}>
          <HugeiconsIcon icon={Moon02Icon} strokeWidth={2} className="size-5 dark:hidden" />
          <HugeiconsIcon icon={Sun03Icon} strokeWidth={2} className="hidden size-5 dark:block" />
        </FloatingButton>
      </nav>
    </>
  );
}

function FloatingButton({
  label,
  active,
  href,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const className = `group relative flex size-11 items-center justify-center rounded-full transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    active ? "bg-foreground text-background" : "text-muted-foreground hover:scale-105 hover:bg-muted hover:text-foreground"
  }`;
  const tooltip = (
    <span className="pointer-events-none absolute right-full mr-3 translate-x-1 rounded-md bg-foreground px-2.5 py-1 text-xs font-medium whitespace-nowrap text-background opacity-0 shadow-md transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
      {label}
    </span>
  );
  return href ? (
    <Link href={href} aria-label={label} aria-current={active ? "page" : undefined} className={className}>
      {children}
      {tooltip}
    </Link>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={className}>
      {children}
      {tooltip}
    </button>
  );
}
