import type { Metadata } from "next";
import { SavedPages } from "./saved-pages";

export const metadata: Metadata = { title: "Offline · Word to sentences" };

/**
 * Shown by the service worker in place of any page that cannot be loaded:
 * the network is down and that page was never saved on this device.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <SavedPages />
    </main>
  );
}
