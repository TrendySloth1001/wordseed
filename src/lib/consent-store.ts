// The visitor's two decisions, kept in this browser (wordseed sets no cookies):
// - agreeing to the terms of use, asked the first time they generate;
// - what the browser may keep, asked by a small notice in the corner.
// Bump TERMS_VERSION when the terms change and everyone is asked again.

export const TERMS_VERSION = 1;
const TERMS_KEY = "wordseed-terms";
const STORAGE_KEY = "wordseed-storage";
export const CONSENT_EVENT = "wordseed-consent";

export type StorageChoice = {
  /** keep History and ratings in this browser */
  history: boolean;
  /** load the star count and profile card from GitHub */
  external: boolean;
  /** when the choice was made (ISO time) */
  decidedAt: string;
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function termsAccepted(): boolean {
  return read(TERMS_KEY) === String(TERMS_VERSION);
}

export function acceptTerms() {
  write(TERMS_KEY, String(TERMS_VERSION));
}

let cached: { raw: string | null; value: StorageChoice | null } = { raw: null, value: null };

/** The storage choice, or null when the visitor has not answered the notice yet. */
export function storageChoice(): StorageChoice | null {
  const raw = read(STORAGE_KEY);
  // Same string, same object: React's useSyncExternalStore needs a stable snapshot.
  if (raw === cached.raw) return cached.value;
  let value: StorageChoice | null = null;
  try {
    value = raw ? (JSON.parse(raw) as StorageChoice) : null;
  } catch {}
  cached = { raw, value };
  return value;
}

export function saveStorageChoice(choice: Pick<StorageChoice, "history" | "external">) {
  write(STORAGE_KEY, JSON.stringify({ ...choice, decidedAt: new Date().toISOString() }));
}

/**
 * Whether runs may be kept in this browser's storage; until the visitor
 * answers, they are kept in memory only. A web worker has no localStorage to
 * ask; it only runs once offline use (which stores the whole site) has been
 * allowed, so it may.
 */
export function historyAllowed(): boolean {
  if (typeof localStorage === "undefined") return true;
  return storageChoice()?.history ?? false;
}
