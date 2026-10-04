"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  CloudDownloadIcon,
  RefreshIcon,
  WifiDisconnected01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  declineOffline,
  isServerReachable,
  offlineChoice,
  offlineSupported,
  saveForOffline,
  type OfflineChoice,
  type SaveProgress,
} from "@/lib/offline/client";
import { useStorageChoice } from "@/lib/consent";

const CONNECTION_EVENTS = ["online", "offline", "wordseed-server"];

function subscribeOnline(onChange: () => void) {
  for (const name of CONNECTION_EVENTS) window.addEventListener(name, onChange);
  return () => {
    for (const name of CONNECTION_EVENTS) window.removeEventListener(name, onChange);
  };
}

/** False when this device has no network, or the server stopped answering. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine && isServerReachable(), () => true);
}

function subscribeChoice(onChange: () => void) {
  window.addEventListener("wordseed-offline-choice", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("wordseed-offline-choice", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The visitor's choice; "unknown" until the page has mounted (and on the server). */
export function useChoice(): OfflineChoice | "unknown" {
  return useSyncExternalStore(subscribeChoice, offlineChoice, () => "unknown");
}

export function megabytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
}

/** A floating pill at the top of the screen while there is no network. */
export function OfflineStatus() {
  const online = useOnline();
  const choice = useChoice();
  if (online) return null;
  return (
    <span
      role="status"
      className="fixed top-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border bg-background/85 px-3 py-1.5 text-xs font-medium whitespace-nowrap shadow-lg shadow-black/10 backdrop-blur-md animate-in fade-in slide-in-from-top-2 dark:shadow-black/40 print:hidden"
      title={choice === "granted" ? "Pages and models are served from this device." : undefined}
    >
      <HugeiconsIcon icon={WifiDisconnected01Icon} strokeWidth={2} className="size-3.5" />
      {choice === "granted" ? "Offline · running on this device" : "Offline"}
    </span>
  );
}

let refreshed = false;

/**
 * Asks once whether the site may save itself for offline use, then saves it
 * with a progress bar. Once allowed, every later visit quietly refreshes the
 * saved copy when the corpus or models changed.
 */
export function OfflineConsent() {
  const choice = useChoice();
  const [progress, setProgress] = useState<SaveProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<number | null>(null);
  // Asked only once the storage notice is answered, never both at the same time.
  const answered = Boolean(useStorageChoice());
  const asking = answered && choice === null && offlineSupported();

  useEffect(() => {
    if (choice === "granted" && !refreshed && navigator.onLine) {
      refreshed = true;
      saveForOffline().catch(() => {});
    }
  }, [choice]);

  useEffect(() => {
    if (!asking) return;
    fetch("/api/offline/manifest")
      .then((response) => response.json())
      .then((manifest) => setSize(manifest.bytes))
      .catch(() => {});
  }, [asking]);

  if (!asking && progress === null) return null;

  async function allow() {
    setError(null);
    setProgress({ done: 0, total: 1 });
    try {
      await saveForOffline(setProgress, true);
      setProgress(null);
      toast.success("Saved for offline use", {
        description: "wordseed now works without a network, generating included.",
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  const share = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;

  return (
    <section
      aria-label="Offline use"
      className="fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] z-40 rounded-2xl border bg-background/95 p-3.5 shadow-xl shadow-black/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500 md:inset-x-auto md:bottom-[5.5rem] md:left-5 md:w-80 dark:shadow-black/40 print:hidden"
      data-corner-notice
    >
      <div className="flex items-start gap-2.5">
        <HugeiconsIcon icon={CloudDownloadIcon} strokeWidth={2} className="size-4 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-[0.8rem] leading-snug">
          <h2 className="font-medium">{progress ? "Saving for offline use…" : "Use wordseed offline?"}</h2>
          <p className="text-muted-foreground">
            {progress
              ? "Keep this tab open for a moment; you can carry on using the site."
              : `Save the pages and both models on this device${size ? ` (about ${megabytes(size)})` : ""}, so everything works without a network.`}
          </p>
        </div>
        {!progress && (
          <button
            type="button"
            aria-label="Not now"
            onClick={declineOffline}
            className="-mt-0.5 -mr-0.5 rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
          </button>
        )}
      </div>

      {progress ? (
        <div className="mt-3 flex flex-col gap-2">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={share}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-foreground transition-[width] duration-300" style={{ width: `${share}%` }} />
          </div>
          {error ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Could not save: {error}</span>
              <Button size="sm" variant="outline" onClick={allow}>
                <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
                Retry
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground tabular-nums">
              {share}% · step {progress.done} of {progress.total}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={allow} className="flex-1">
            Allow offline use
          </Button>
          <Button size="sm" variant="outline" onClick={declineOffline} className="flex-1">
            Not now
          </Button>
        </div>
      )}
    </section>
  );
}
