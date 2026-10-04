// Offline use, from the page's side: the visitor's choice, the service worker
// that saves the site, and apiFetch, which answers API calls from the offline
// worker when the server cannot be reached.
import type { OfflineRequest, OfflineResponse } from "./protocol";

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
export async function saveForOffline(onProgress?: (progress: SaveProgress) => void, force = false): Promise<void> {
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

/** Removes the saved site and the runs made offline, and remembers the choice. */
export async function removeOfflineCopy(): Promise<void> {
  setChoice("denied");
  const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? [];
  await Promise.all(registrations.map((registration) => registration.unregister()));
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith("wordseed-")).map((name) => caches.delete(name)));
  indexedDB.deleteDatabase("wordseed-offline");
  try {
    localStorage.removeItem(LOCAL_RUNS_KEY);
  } catch {}
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

export function offlineRunCount(): number {
  return localRuns().size;
}

/** Ids of runs that were made in this browser, which the server does not know. */
function localRuns(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LOCAL_RUNS_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function rememberLocalRun(id: string) {
  const ids = [...localRuns(), id].slice(-50);
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
 * fetch() for the app's own API. Runs made offline are always answered by the
 * offline worker; anything else goes to the server first, and to the worker
 * only when the server cannot be reached and the visitor allowed offline use.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const run = path.match(/^\/api\/runs\/([a-z0-9]+)/)?.[1];
  if (run && localRuns().has(run)) return answerOffline(path, init);
  try {
    const response = await fetch(path, init);
    setServerReachable(true);
    return response;
  } catch (error) {
    setServerReachable(false);
    if (offlineChoice() !== "granted") throw error;
    return answerOffline(path, init);
  }
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
