"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Database01Icon,
  Moon02Icon,
  QuillWrite01Icon,
  SparklesIcon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/", label: "Generate", icon: SparklesIcon },
  { href: "/corpus", label: "Corpus", icon: Database01Icon },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-10 border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
        <Link href="/" className="mr-auto flex min-w-0 items-center gap-2 font-semibold">
          <HugeiconsIcon icon={QuillWrite01Icon} strokeWidth={2} className="size-6 shrink-0" />
          <span className="truncate">Word to sentences</span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => (
            <Button
              key={link.href}
              asChild
              size="lg"
              variant={pathname === link.href ? "default" : "ghost"}
            >
              <Link href={link.href} aria-label={link.label}>
                <HugeiconsIcon icon={link.icon} strokeWidth={2} className="size-5" />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            </Button>
          ))}
          <Button
            size="icon-lg"
            variant="ghost"
            aria-label="Switch between light and dark"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <HugeiconsIcon icon={Moon02Icon} strokeWidth={2} className="size-5 dark:hidden" />
            <HugeiconsIcon icon={Sun03Icon} strokeWidth={2} className="hidden size-5 dark:block" />
          </Button>
        </nav>
      </div>
    </header>
  );
}
