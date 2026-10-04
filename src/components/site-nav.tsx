"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useChoice } from "@/components/offline";
import { SettingsDialog, THEMES } from "@/components/settings";
import { offlineSupported, saveForOffline, type SaveProgress } from "@/lib/offline/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings01Icon } from "@hugeicons/core-free-icons";
import { CorpusIcon, DocsIcon, GenerateIcon, HistoryIcon, QuillIcon } from "@/components/animated-icons";
import { CloudIcon } from "@/components/animated-icons";

// Icons whose parts animate on hover and when their page becomes current:
// sparkles pop, clock hands sweep, a book drops onto the stack, a page turns.
const LINKS = [
  { href: "/", label: "Generate", Icon: GenerateIcon },
  { href: "/runs", label: "History", Icon: HistoryIcon },
  { href: "/corpus", label: "Corpus", Icon: CorpusIcon },
  { href: "/docs", label: "Docs", Icon: DocsIcon },
];

/** Sent when the Settings slide-out opens (its box) or closes (null). */
export const FLYOUT_EVENT = "wordseed-settings-flyout";
export type FlyoutBox = { left: number; top: number; bottom: number };

/** Buttons arrive one after another when the page first loads. */
const enter = (index: number) => ({
  className: "animate-[nav-in_0.5s_cubic-bezier(0.22,1,0.36,1)_both]",
  style: { animationDelay: `${120 + index * 60}ms` },
});
/** The current page's button pops in when it becomes current. */
const POP = "animate-[nav-pop_0.35s_ease-out]";

/** The project's icon and name, floating in the top-left corner; links home. */
export function SiteBrand() {
  return (
    <Link
      href="/"
      aria-label="wordseed, home"
      className="group inline-flex items-center gap-2 rounded-full border bg-background/85 py-1.5 pr-4 pl-1.5 shadow-lg shadow-black/10 backdrop-blur-md transition-transform duration-200 outline-none animate-[nav-in_0.45s_cubic-bezier(0.22,1,0.36,1)_both] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring dark:shadow-black/40"
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-background">
        <QuillIcon className="size-[18px]" />
      </span>
      <span className="font-semibold tracking-tight">wordseed</span>
    </Link>
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
        className={`fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-5 gap-1 rounded-2xl p-1.5 animate-[nav-in_0.45s_cubic-bezier(0.22,1,0.36,1)_both] md:hidden print:hidden ${surface}`}
      >
        {LINKS.map((link, index) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active(link.href) ? "page" : undefined}
            className={`group flex justify-center rounded-xl py-1.5 text-[0.7rem] font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active(link.href) ? `bg-foreground text-background ${POP}` : "text-muted-foreground active:bg-muted"
            }`}
          >
            <span className={`flex flex-col items-center gap-0.5 ${enter(index).className}`} style={enter(index).style}>
              <link.Icon className="size-5" />
              {link.label}
            </span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setSettings(true)}
          aria-haspopup="dialog"
          className={`group flex justify-center rounded-xl py-1.5 text-[0.7rem] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            settings ? `bg-foreground text-background ${POP}` : "text-muted-foreground active:bg-muted"
          }`}
        >
          <span className={`flex flex-col items-center gap-0.5 ${enter(LINKS.length).className}`} style={enter(LINKS.length).style}>
            <HugeiconsIcon
              icon={Settings01Icon}
              strokeWidth={2}
              className="size-5 transition-transform duration-500 group-active:rotate-90"
            />
            Settings
          </span>
        </button>
      </nav>

      <nav
        aria-label="Main"
        className={`fixed right-5 bottom-5 z-30 hidden flex-col items-center gap-1 rounded-full p-1.5 animate-[nav-in_0.45s_cubic-bezier(0.22,1,0.36,1)_both] md:flex print:hidden ${surface}`}
      >
        {LINKS.map((link, index) => (
          <FloatingButton key={link.href} label={link.label} active={active(link.href)} href={link.href}>
            <span className={enter(index).className} style={enter(index).style}>
              <link.Icon className="size-5" />
            </span>
          </FloatingButton>
        ))}
        <span
          className={`my-0.5 h-px w-6 bg-border ${enter(LINKS.length).className}`}
          style={enter(LINKS.length).style}
          aria-hidden
        />
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
  const panel = useRef<HTMLDivElement>(null);

  /** Tells the page where the slide-out is, so the footer's buttons can move aside. */
  function announce(open: boolean) {
    const box = panel.current?.getBoundingClientRect();
    window.dispatchEvent(
      new CustomEvent<FlyoutBox | null>(FLYOUT_EVENT, {
        detail: open && box ? { left: box.left, top: box.top, bottom: box.bottom } : null,
      }),
    );
  }

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
    <div
      className="group/settings relative"
      onMouseEnter={() => announce(true)}
      onMouseLeave={() => announce(false)}
      onFocus={(event) => event.target.matches(":focus-visible") && announce(true)}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && announce(false)}
    >
      <button
        type="button"
        aria-label="Settings"
        aria-haspopup="dialog"
        onClick={onOpen}
        className={`${FLOATING} ${active ? `${FLOATING_ACTIVE} ${POP}` : FLOATING_IDLE} group-hover/settings:bg-muted group-hover/settings:text-foreground`}
      >
        <span className={enter(LINKS.length + 1).className} style={enter(LINKS.length + 1).style}>
          <HugeiconsIcon
            icon={Settings01Icon}
            strokeWidth={2}
            className="size-5 transition-transform duration-500 group-hover/settings:rotate-90"
          />
        </span>
      </button>

      {/* The padding on the right bridges the gap, so the pointer can travel
          from the button into the panel without it closing. */}
      <div className={`absolute top-1/2 right-full -translate-y-1/2 pr-3 transition-all duration-200 ${reveal}`}>
        <div
          ref={panel}
          className="flex items-center gap-1.5 rounded-full border bg-background/95 p-1.5 shadow-lg shadow-black/10 backdrop-blur-md dark:shadow-black/40"
        >
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
                  className={`group flex size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }`}
                >
                  <option.Icon className="size-4" />
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
                className={`group relative flex h-9 items-center gap-1.5 overflow-hidden rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
                <CloudIcon saved={saved} className="relative size-4" />
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
  const className = `${FLOATING} ${active ? `${FLOATING_ACTIVE} ${POP}` : FLOATING_IDLE}`;
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
