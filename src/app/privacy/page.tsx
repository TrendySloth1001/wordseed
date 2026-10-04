import type { Metadata } from "next";
import Link from "next/link";
import {
  BrowserIcon,
  CookieIcon,
  Delete02Icon,
  GithubIcon,
  ServerStack01Icon,
  ShieldUserIcon,
  WifiDisconnected01Icon,
} from "@hugeicons/core-free-icons";
import { Clause, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy & cookies",
  description: "What wordseed stores, where, and why: no cookies, no accounts, no tracking.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      icon={ShieldUserIcon}
      title="Privacy & cookies"
      intro="The short version: no cookies, no accounts, no analytics, no tracking. What little is kept stays in your own browser, and you choose most of it."
      updated="4 October 2026"
      other={{ href: "/terms", label: "Terms of use" }}
    >
      <Clause icon={CookieIcon} title="Cookies">
        <p>
          wordseed sets no cookies at all. The &ldquo;cookie&rdquo; question you were asked is really about your
          browser&apos;s own storage, described below.
        </p>
      </Clause>

      <Clause icon={BrowserIcon} title="What your browser keeps">
        <ul>
          <li>
            <strong>Always (essential):</strong> your light or dark theme, and your answers to the agreement and
            storage questions.
          </li>
          <li>
            <strong>If you allow History:</strong> your generated sentences, their details for Explain, and your
            ratings, kept in this browser (IndexedDB), the 50 most recent. Say no and they last only until you close
            the tab.
          </li>
          <li>
            <strong>If you allow offline use</strong> (asked separately): a copy of the pages, the corpus and both
            models, so the site works without a network.
          </li>
          <li>
            <strong>If you allow GitHub info:</strong> the star count and the author&apos;s public profile, cached
            until you close the tab.
          </li>
        </ul>
      </Clause>

      <Clause icon={ServerStack01Icon} title="What the server sees">
        <ul>
          <li>
            The words and settings you generate with, needed to write the sentences. On this hosted site they are not
            saved on the server: the results come back to your browser.
          </li>
          <li>
            Your IP address, as with any website. It is used only to rate-limit requests: held briefly in the
            server&apos;s memory and never written to disk.
          </li>
          <li>
            The site is hosted on Vercel, which may keep standard request logs under its own privacy policy. If you run
            wordseed yourself, your runs are saved in its <code>data/runs</code> folder on your own machine.
          </li>
        </ul>
      </Clause>

      <Clause icon={GithubIcon} title="Third parties">
        <p>
          Only GitHub, and only if you allow it: your browser then asks GitHub&apos;s public API for the star count
          and the author&apos;s profile, so GitHub sees your IP address. Fonts, images and maths rendering are all
          served by wordseed itself.
        </p>
      </Clause>

      <Clause icon={WifiDisconnected01Icon} title="Offline use">
        <p>
          Offline use is off until you say yes. Turning it on saves about 25 MB in your browser; turning it off in
          Settings deletes that copy again.
        </p>
      </Clause>

      <Clause icon={Delete02Icon} title="Changing your mind">
        <ul>
          <li>Change any choice in Settings (the gear button), under &ldquo;Privacy &amp; cookies&rdquo;.</li>
          <li>Delete single runs in History, or everything at once by clearing this site&apos;s data in your browser.</li>
          <li>
            Questions or concerns? Open an issue on{" "}
            <a href="https://github.com/TrendySloth1001/wordseed/issues" className="underline underline-offset-4">
              GitHub
            </a>
            . See also the{" "}
            <Link href="/terms" className="underline underline-offset-4">
              Terms of use
            </Link>
            .
          </li>
        </ul>
      </Clause>
    </LegalPage>
  );
}
