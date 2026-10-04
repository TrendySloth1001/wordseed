"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { OfflineStatus, useChoice } from "@/components/offline";
import { SettingsDialog, THEMES } from "@/components/settings";
import { offlineSupported, saveForOffline, type SaveProgress } from "@/lib/offline/client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BookOpen01Icon,
  Clock01Icon,
  CloudDownloadIcon,
  CloudSavingDone01Icon,
  Database01Icon,
  QuillWrite01Icon,
  Settings01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";

const LINKS = [
  { href: "/", label: "Generate", icon: SparklesIcon },
  { href: "/runs", label: "History", icon: Clock01Icon },
  { href: "/corpus", label: "Corpus", icon: Database01Icon },
  { href: "/docs", label: "Docs", icon: BookOpen01Icon },
];

/** The top bar: the app's name, which links home, and an Offline pill when there is no network. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b print:static bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[90rem] items-center px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
          <HugeiconsIcon icon={QuillWrite01Icon} strokeWidth={2} className="size-6 shrink-0" />
          <span className="truncate">Word to sentences</span>
        </Link>
        <OfflineStatus />
      </div>
    </header>
  );
}

/**
 * Navigation that floats over the page: a bar along the bottom on a phone,
 * and a column of round buttons in the bottom-right corner on larger screens,
 * each showing its name on hover or keyboard focus. The theme and offline use
 * live in Settings; on larger screens, hovering Settings also slides out quick
 * controls for both.
 */
export function SiteNav() {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const [settings, setSettings] = useState(false);
  const surface = "border bg-background/85 shadow-lg shadow-black/10 backdrop-blur-md dark:shadow-black/40";

  return (
    <>
      <nav
        aria-label="Main"
        className={`fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-5 gap-1 rounded-2xl p-1.5 md:hidden print:hidden ${surface}`}
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
          onClick={() => setSettings(true)}
          aria-haspopup="dialog"
          className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[0.7rem] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            settings ? "bg-foreground text-background" : "text-muted-foreground active:bg-muted"
          }`}
        >
          <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} className="size-5" />
          Settings
        </button>
      </nav>

      <nav
        aria-label="Main"
        className={`fixed right-5 bottom-5 z-30 hidden flex-col items-center gap-1 rounded-full p-1.5 md:flex print:hidden ${surface}`}
      >
        {LINKS.map((link) => (
          <FloatingButton key={link.href} label={link.label} active={active(link.href)} href={link.href}>
            <HugeiconsIcon icon={link.icon} strokeWidth={2} className="size-5" />
          </FloatingButton>
        ))}
        <span className="my-0.5 h-px w-6 bg-border" aria-hidden />
        <SettingsLauncher active={settings} onOpen={() => setSettings(true)} />
      </nav>

      <SettingsDialog open={settings} onOpenChange={setSettings} />
    </>
  );
}

const FLOATING =
  "group relative flex size-11 items-center justify-center rounded-full transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring";
const FLOATING_IDLE = "text-muted-foreground hover:scale-105 hover:bg-muted hover:text-foreground";
const FLOATING_ACTIVE = "bg-foreground text-background";

/**
 * The Settings button of the floating column. Clicking it opens Settings;
 * hovering or focusing it slides out the theme and the offline save button.
 */
function SettingsLauncher({ active, onOpen }: { active: boolean; onOpen: () => void }) {
  const { theme, setTheme } = useTheme();
  // The server cannot know the saved theme, so mark one only once mounted.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const choice = useChoice();
  const [progress, setProgress] = useState<SaveProgress | null>(null);
  const supported = choice !== "unknown" && offlineSupported();
  const saved = choice === "granted";
  const share = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;

  async function saveOffline() {
    // Already saved: Settings shows what is saved and can update or remove it.
    if (saved) return onOpen();
    setProgress({ done: 0, total: 1 });
    try {
      await saveForOffline(setProgress, true);
      toast.success("Saved for offline use", {
        description: "wordseed now works without a network, generating included.",
      });
    } catch (reason) {
      toast.error("Could not save for offline use", {
        description: reason instanceof Error ? reason.message : String(reason),
      });
    } finally {
      setProgress(null);
    }
  }

  const reveal =
    "pointer-events-none translate-x-2 opacity-0 group-has-focus-visible/settings:pointer-events-auto group-has-focus-visible/settings:translate-x-0 group-has-focus-visible/settings:opacity-100 group-hover/settings:pointer-events-auto group-hover/settings:translate-x-0 group-hover/settings:opacity-100";

  return (
    <div className="group/settings relative">
      <button
        type="button"
        aria-label="Settings"
        aria-haspopup="dialog"
        onClick={onOpen}
        className={`${FLOATING} ${active ? FLOATING_ACTIVE : FLOATING_IDLE} group-hover/settings:bg-muted group-hover/settings:text-foreground`}
      >
        <HugeiconsIcon
          icon={Settings01Icon}
          strokeWidth={2}
          className="size-5 transition-transform duration-500 group-hover/settings:rotate-90"
        />
      </button>

      {/* The padding on the right bridges the gap, so the pointer can travel
          from the button into the panel without it closing. */}
      <div className={`absolute top-1/2 right-full -translate-y-1/2 pr-3 transition-all duration-200 ${reveal}`}>
        <div className="flex items-center gap-1.5 rounded-full border bg-background/95 p-1.5 shadow-lg shadow-black/10 backdrop-blur-md dark:shadow-black/40">
          <div role="radiogroup" aria-label="Theme" className="flex gap-0.5 rounded-full bg-muted p-0.5">
            {THEMES.map((option) => {
              const selected = mounted && theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${option.label} theme`}
                  title={option.label}
                  onClick={() => setTheme(option.value)}
                  className={`flex size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }`}
                >
                  <HugeiconsIcon icon={option.icon} strokeWidth={2} className="size-4" />
                </button>
              );
            })}
          </div>

          {supported && (
            <>
              <span className="h-6 w-px bg-border" aria-hidden />
              <button
                type="button"
                onClick={saveOffline}
                disabled={progress !== null}
                className={`relative flex h-9 items-center gap-1.5 overflow-hidden rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  saved ? "text-foreground hover:bg-muted" : "bg-foreground text-background hover:bg-foreground/85"
                }`}
              >
                {progress && (
                  <span
                    className="absolute inset-y-0 left-0 bg-background/25 transition-[width] duration-300"
                    style={{ width: `${share}%` }}
                    aria-hidden
                  />
                )}
                <HugeiconsIcon
                  icon={saved ? CloudSavingDone01Icon : CloudDownloadIcon}
                  strokeWidth={2}
                  className="relative size-4"
                />
                <span className="relative tabular-nums">
                  {progress ? `Saving ${share}%` : saved ? "Saved offline" : "Save offline"}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
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
  const className = `${FLOATING} ${active ? FLOATING_ACTIVE : FLOATING_IDLE}`;
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
