// Offline use, from the page's side: the visitor's choice, the service worker
// that saves the site, and apiFetch, which answers API calls from the offline
// worker when the server cannot be reached.
import type { OfflineRequest, OfflineResponse } from "./protocol";
import { historyAllowed, TERMS_VERSION, termsAccepted } from "../consent-store";

const CHOICE_KEY = "wordseed-offline";
const LOCAL_RUNS_KEY = "wordseed-offline-runs";

export type OfflineChoice = "granted" | "denied" | null;
export type SaveProgress = { done: number; total: number };

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "caches" in window;
}

export function offlineChoice(): OfflineChoice {
  try {
    const value = localStorage.getItem(CHOICE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function setChoice(choice: Exclude<OfflineChoice, null>) {
  try {
    localStorage.setItem(CHOICE_KEY, choice);
  } catch {}
  window.dispatchEvent(new Event("wordseed-offline-choice"));
}

export function declineOffline() {
  setChoice("denied");
}

/**
 * Registers the service worker and has it save every page, script, style and
 * both models. Resolves when everything is saved; `force` re-saves even when
 * nothing has changed since the last time.
 */
/** Sent on window while a save the visitor asked for runs, so the page can show it anywhere. */
export const SAVE_EVENT = "wordseed-save";
export type SaveEvent =
  | ({ state: "progress" } & SaveProgress)
  | { state: "done" }
  | { state: "error"; message: string };

function announceSave(detail: SaveEvent) {
  window.dispatchEvent(new CustomEvent<SaveEvent>(SAVE_EVENT, { detail }));
}

export async function saveForOffline(onProgress?: (progress: SaveProgress) => void, force = false): Promise<void> {
  // A forced save is one the visitor asked for; the quiet refresh on each visit is not announced.
  if (!force) return save(onProgress, false);
  announceSave({ state: "progress", done: 0, total: 1 });
  try {
    await save((progress) => {
      onProgress?.(progress);
      announceSave({ state: "progress", ...progress });
    }, true);
    announceSave({ state: "done" });
  } catch (error) {
    announceSave({ state: "error", message: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

async function save(onProgress: ((progress: SaveProgress) => void) | undefined, force: boolean): Promise<void> {
  if (!offlineSupported()) throw new Error("This browser cannot save sites for offline use.");
  setChoice("granted");
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  const registration = await navigator.serviceWorker.ready;
  const worker = registration.active;
  if (!worker) throw new Error("The service worker did not start.");

  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = ({ data }) => {
      if (data.type === "progress") onProgress?.(data);
      else if (data.type === "done") resolve();
      else if (data.type === "error") reject(new Error(data.message));
    };
    worker.postMessage({ type: "save", force }, [channel.port2]);
  });
  // No page links to the offline worker's script, so start it once now: it is
  // fetched through the service worker, which saves it with everything else.
  await askWorker({ method: "PING", path: "/" });
}

/** Removes the saved site (pages, scripts, models) and remembers the choice. */
export async function removeOfflineCopy(): Promise<void> {
  setChoice("denied");
  const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? [];
  await Promise.all(registrations.map((registration) => registration.unregister()));
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith("wordseed-")).map((name) => caches.delete(name)));
  // Runs kept in this browser stay: they are History, not part of the copy.
}

export type SavedCopy = {
  version?: string;
  savedAt?: number;
  /** size of the corpus and model files */
  bytes?: number;
  pages: number;
  assets: number;
};

/** What the service worker has saved so far, read from its caches. */
export async function savedCopy(): Promise<SavedCopy> {
  const count = async (name: string) => (await (await caches.open(name)).keys()).length;
  const meta = await (await caches.open("wordseed-meta")).match("/__meta");
  return {
    ...(meta ? await meta.json() : {}),
    pages: await count("wordseed-pages"),
    assets: await count("wordseed-assets"),
  };
}

/** Runs kept in this browser rather than on the server. */
export function localRunCount(): number {
  return localRuns().size;
}

/** Ids of runs kept in this browser (made offline, or on a host without storage). */
function localRuns(): Set<string> {
  let saved: string[] = [];
  try {
    saved = JSON.parse(localStorage.getItem(LOCAL_RUNS_KEY) ?? "[]");
  } catch {}
  return new Set([...saved, ...sessionRuns]);
}

// Runs kept in memory only, when the visitor said no to keeping History.
const sessionRuns = new Set<string>();

function rememberLocalRun(id: string) {
  if (!historyAllowed()) {
    sessionRuns.add(id);
    return;
  }
  writeLocalRuns([...localRuns()].filter((other) => !sessionRuns.has(other)).concat(id).slice(-50));
}

function forgetLocalRun(id: string) {
  sessionRuns.delete(id);
  writeLocalRuns([...localRuns()].filter((other) => other !== id && !sessionRuns.has(other)));
}

function writeLocalRuns(ids: string[]) {
  try {
    localStorage.setItem(LOCAL_RUNS_KEY, JSON.stringify(ids));
  } catch {}
}

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, (response: OfflineResponse) => void>();

function askWorker(request: OfflineRequest): Promise<OfflineResponse> {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }: MessageEvent<{ id: number; response: OfflineResponse }>) => {
      pending.get(data.id)?.(data.response);
      pending.delete(data.id);
    };
  }
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker!.postMessage({ id, request });
  });
}

async function answerOffline(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  const { status, body: answer } = await askWorker({ method, path, body });
  if (method === "POST" && path === "/api/generate" && status === 200) {
    rememberLocalRun((answer as { id: string }).id);
  }
  return Response.json(answer, { status });
}

/**
 * Requests about a run kept in this browser. Ratings and deleting happen right
 * here in IndexedDB; explaining a sentence asks the server (it has the models)
 * with the sentence's trace, or the offline worker when there is no server.
 */
async function answerLocalRun(id: string, path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  const { deleteLocalRun, getLocalRun, rateLocalRun } = await import("./run-store");

  if (method === "DELETE") {
    await deleteLocalRun(id);
    forgetLocalRun(id);
    return Response.json({ ok: true });
  }
  if (method === "POST" && path.endsWith("/ratings")) {
    const run = await rateLocalRun(id, Number(body?.index), body?.rating);
    return run ? Response.json({ ratings: run.ratings }) : Response.json({ error: "That sentence no longer exists." }, { status: 404 });
  }
  const index = Number(path.match(/\/sentences\/(\d+)/)?.[1]);
  const stored = await getLocalRun(id);
  const trace = stored?.traces[index];
  if (!stored || !trace) return Response.json({ error: "That sentence no longer exists." }, { status: 404 });
  try {
    const response = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engine: stored.run.engine, trace }),
    });
    setServerReachable(true);
    return response;
  } catch (error) {
    setServerReachable(false);
    if (offlineChoice() !== "granted") throw error;
    return answerOffline(path, init);
  }
}

/**
 * fetch() for the app's own API. Runs kept in this browser are answered here;
 * anything else goes to the server first, and to the offline worker only when
 * the server cannot be reached and the visitor allowed offline use. When the
 * server keeps no files, a new run comes back with its traces and is saved in
 * this browser.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  // Generating requires the terms to have been agreed; the server checks for this header.
  if (path === "/api/generate" && termsAccepted()) {
    init = { ...init, headers: { ...(init?.headers as Record<string, string>), "X-Terms-Accepted": String(TERMS_VERSION) } };
  }
  const run = path.match(/^\/api\/runs\/([a-z0-9]+)/)?.[1];
  if (run && localRuns().has(run)) return answerLocalRun(run, path, init);
  let response: Response;
  try {
    response = await fetch(path, init);
    setServerReachable(true);
  } catch (error) {
    setServerReachable(false);
    if (offlineChoice() !== "granted") throw error;
    return answerOffline(path, init);
  }
  if (path === "/api/generate" && response.ok) {
    const { traces, ...run } = await response.json();
    if (traces) {
      const { saveLocalRun } = await import("./run-store");
      await saveLocalRun({ run, traces }).catch(() => {});
      rememberLocalRun(run.id);
    }
    return Response.json(run, { status: response.status });
  }
  return response;
}

// The browser only knows whether this device has a network, not whether the
// server answers; apiFetch records the latter as it goes.
let serverReachable = true;

function setServerReachable(reachable: boolean) {
  if (reachable === serverReachable) return;
  serverReachable = reachable;
  window.dispatchEvent(new Event("wordseed-server"));
}

export function isServerReachable(): boolean {
  return serverReachable;
}
