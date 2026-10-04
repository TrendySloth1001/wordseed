"use client";

import { useEffect, useState } from "react";
import { CloudIcon } from "@/components/animated-icons";
import { SAVE_EVENT, type SaveEvent } from "@/lib/offline/client";

/**
 * A small floating pill showing an offline save the visitor started, wherever
 * they started it (Settings, the gear's slide-out or the banner), so it stays
 * visible after Settings closes. Ring and cloud while saving; a tick when done.
 */
export function OfflineProgress() {
  const [status, setStatus] = useState<SaveEvent | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onSave = (event: Event) => {
      const detail = (event as CustomEvent<SaveEvent>).detail;
      clearTimeout(timer);
      setLeaving(false);
      setStatus(detail);
      if (detail.state !== "progress") {
        // Linger long enough to read, then fade out.
        timer = setTimeout(() => setLeaving(true), detail.state === "done" ? 2200 : 5000);
        timer = setTimeout(() => setStatus(null), detail.state === "done" ? 2600 : 5400);
      }
    };
    addEventListener(SAVE_EVENT, onSave);
    return () => {
      removeEventListener(SAVE_EVENT, onSave);
      clearTimeout(timer);
    };
  }, []);

  if (!status) return null;
  const share = status.state === "progress" ? status.done / Math.max(1, status.total) : 1;
  const label =
    status.state === "progress"
      ? `Saving for offline · ${Math.round(share * 100)}%`
      : status.state === "done"
        ? "Saved for offline"
        : "Could not save for offline";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full border bg-background/90 py-1.5 pr-4 pl-1.5 text-sm font-medium whitespace-nowrap shadow-lg shadow-black/10 backdrop-blur-md transition-all duration-300 dark:shadow-black/40 print:hidden ${
        leaving ? "-translate-y-3 opacity-0" : "animate-in fade-in slide-in-from-top-3"
      }`}
    >
      <span className="relative flex size-8 items-center justify-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r="16" fill="none" className="stroke-border" strokeWidth="2.5" />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - share}
            strokeLinecap="round"
            className="stroke-foreground transition-[stroke-dashoffset] duration-300"
            strokeWidth="2.5"
          />
        </svg>
        <CloudIcon
          saved={status.state === "done"}
          className={`size-4 ${status.state === "progress" ? "offline-saving" : "offline-saved"}`}
        />
      </span>
      <span className="tabular-nums">{label}</span>
    </div>
  );
}
