"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  ComputerIcon,
  Moon02Icon,
  RefreshIcon,
  Sun03Icon,
  Wifi01Icon,
  WifiDisconnected01Icon,
} from "@hugeicons/core-free-icons";
import { megabytes, useChoice, useOnline } from "@/components/offline";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  localRunCount,
  offlineSupported,
  removeOfflineCopy,
  savedCopy,
  saveForOffline,
  type SavedCopy,
  type SaveProgress,
} from "@/lib/offline/client";

export const THEMES = [
  { value: "light", label: "Light", icon: Sun03Icon },
  { value: "dark", label: "Dark", icon: Moon02Icon },
  { value: "system", label: "System", icon: ComputerIcon },
];

/** Appearance and offline use: what is saved on this device, and a switch for it. */
export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { theme, setTheme } = useTheme();
  const online = useOnline();
  const choice = useChoice();
  const [copy, setCopy] = useState<SavedCopy | null>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const [progress, setProgress] = useState<SaveProgress | null>(null);
  const [refresh, setRefresh] = useState(0);
  const supported = choice !== "unknown" && offlineSupported();

  // Re-read what is saved whenever the panel opens or the copy changes.
  useEffect(() => {
    if (!open || !supported) return;
    savedCopy().then(setCopy, () => setCopy(null));
    navigator.storage?.estimate?.().then(
      (estimate) => setUsage(estimate.usage ?? null),
      () => setUsage(null),
    );
  }, [open, supported, refresh, choice]);

  const enabled = choice === "granted";
  const saved = enabled && Boolean(copy?.savedAt);

  async function save() {
    setProgress({ done: 0, total: 1 });
    try {
      await saveForOffline(setProgress, true);
      toast.success("Saved for offline use");
    } catch (reason) {
      toast.error("Could not save for offline use", {
        description: reason instanceof Error ? reason.message : String(reason),
      });
    } finally {
      setProgress(null);
      setRefresh((value) => value + 1);
    }
  }

  async function toggle(on: boolean) {
    if (on) return save();
    await removeOfflineCopy();
    toast.success("Offline copy removed", { description: "Pages and models were deleted from this device." });
    setRefresh((value) => value + 1);
  }

  const share = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
  const status = progress ? `Saving… ${share}%` : saved ? "Saved" : enabled ? "Waiting to save" : "Off";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Appearance and offline use, for this device only.</DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Appearance</h3>
          <div className="grid grid-cols-3 gap-1 rounded-lg border p-1" role="radiogroup" aria-label="Theme">
            {THEMES.map((option) => {
              const selected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(option.value)}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <HugeiconsIcon icon={option.icon} strokeWidth={2} className="size-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-medium" id="offline-label">
                Work offline
              </h3>
              <p className="text-sm text-muted-foreground">
                {supported
                  ? "Save every page and both models on this device, so everything, generating included, works without a network."
                  : "This browser cannot save sites for offline use."}
              </p>
            </div>
            <Switch
              aria-labelledby="offline-label"
              checked={enabled}
              disabled={!supported || progress !== null || (!online && !enabled)}
              onCheckedChange={toggle}
              className="mt-0.5"
            />
          </div>

          {progress && (
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={share} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-foreground transition-[width] duration-300" style={{ width: `${share}%` }} />
            </div>
          )}

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border text-sm">
            <Info label="Connection">
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={online ? Wifi01Icon : WifiDisconnected01Icon} strokeWidth={2} className="size-4" />
                {online ? "Online" : "Offline"}
              </span>
            </Info>
            <Info label="Offline copy">{status}</Info>
            <Info label="Last updated">
              {saved ? new Date(copy!.savedAt!).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
            </Info>
            <Info label="Corpus and models">{saved && copy?.bytes ? megabytes(copy.bytes) : "—"}</Info>
            <Info label="Pages saved">{saved ? copy!.pages.toLocaleString("en") : "—"}</Info>
            <Info label="Scripts and styles">{saved ? copy!.assets.toLocaleString("en") : "—"}</Info>
            <Info label="Storage used">{usage !== null ? megabytes(usage) : "—"}</Info>
            <Info label="Runs kept in this browser">{supported ? localRunCount().toLocaleString("en") : "—"}</Info>
          </dl>

          <div className="flex flex-wrap gap-2">
            {saved && (
              <Button variant="outline" size="sm" onClick={save} disabled={progress !== null || !online}>
                <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
                Update now
              </Button>
            )}
            {saved && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/offline" onClick={() => onOpenChange(false)}>
                  See saved pages
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                </Link>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Everything stays in this browser. Nothing about you is stored on the server or sent anywhere.
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 bg-background px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  );
}
