// React access to the visitor's decisions in consent-store.ts.
import { useSyncExternalStore } from "react";
import { CONSENT_EVENT, storageChoice, termsAccepted, type StorageChoice } from "./consent-store";

export * from "./consent-store";

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Whether the terms were agreed to; undefined until mounted (and on the server). */
export function useTermsAccepted(): boolean | undefined {
  return useSyncExternalStore(subscribe, termsAccepted, () => undefined);
}

/** The storage choice; undefined until mounted, null while the notice is unanswered. */
export function useStorageChoice(): StorageChoice | null | undefined {
  return useSyncExternalStore(subscribe, storageChoice, () => undefined);
}
