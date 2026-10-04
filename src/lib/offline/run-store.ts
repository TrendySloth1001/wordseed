// Runs kept in this browser (IndexedDB): those made offline, and every run on
// a host without server storage. Shared by the page and the offline worker.
// When the visitor said no to keeping History, runs live only in memory and
// are gone when the tab closes.
import { historyAllowed } from "../consent-store";
import type { StoredRun } from "../engine";
import type { RunListItem } from "../run-types";

const KEEP = 50;

let database: Promise<IDBDatabase> | null = null;
const memory = new Map<string, StoredRun>();

function open(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("wordseed-offline", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("runs", { keyPath: "run.id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}

async function store<T>(mode: IDBTransactionMode, action: (runs: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const runs = (await open()).transaction("runs", mode).objectStore("runs");
  return new Promise((resolve, reject) => {
    const request = action(runs);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Saves a run, keeping only the most recent ones (ids start with the time). */
export async function saveLocalRun(stored: StoredRun): Promise<void> {
  if (!historyAllowed()) {
    memory.set(stored.run.id, stored);
    return;
  }
  await store("readwrite", (runs) => runs.put(stored));
  const ids = (await store("readonly", (runs) => runs.getAllKeys())) as string[];
  for (const id of ids.sort().reverse().slice(KEEP)) await store("readwrite", (runs) => runs.delete(id));
}

export async function getLocalRun(id: string): Promise<StoredRun | undefined> {
  return memory.get(id) ?? store<StoredRun | undefined>("readonly", (runs) => runs.get(id));
}

export async function deleteLocalRun(id: string): Promise<void> {
  if (memory.delete(id)) return;
  await store("readwrite", (runs) => runs.delete(id));
}

/** Sets or clears (rating 0) one sentence's rating; null when it does not exist. */
export async function rateLocalRun(id: string, index: number, rating: 1 | -1 | 0): Promise<StoredRun["run"] | null> {
  const stored = await getLocalRun(id);
  if (!stored?.run.sentences[index]) return null;
  if (rating === 0) delete stored.run.ratings[index];
  else stored.run.ratings[index] = rating;
  if (memory.has(id)) memory.set(id, stored);
  else await store("readwrite", (runs) => runs.put(stored));
  return stored.run;
}

/** The runs in this browser as History lists them, newest first. */
export async function listLocalRuns(): Promise<RunListItem[]> {
  const saved = historyAllowed() ? await store<StoredRun[]>("readonly", (runs) => runs.getAll()) : [];
  return [...saved, ...memory.values()]
    .map(({ run }) => {
      const ratings = Object.values(run.ratings);
      return {
        id: run.id,
        time: run.time,
        words: run.words,
        engine: run.engine,
        settings: run.settings,
        sentences: run.sentences.length,
        liked: ratings.filter((rating) => rating === 1).length,
        disliked: ratings.filter((rating) => rating === -1).length,
        local: true,
      };
    })
    .sort((a, b) => b.time.localeCompare(a.time));
}
