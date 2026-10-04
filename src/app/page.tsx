import { AUTHOR, REPOSITORY, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { Generator, type InitialSettings } from "./generator";

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
  codeRepository: REPOSITORY,
  inLanguage: "en",
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function Home(props: PageProps<"/">) {
  const query = await props.searchParams;
  const pick = <T extends string>(key: string, allowed: readonly T[]): T | undefined =>
    allowed.find((option) => option === first(query[key]));
  const number = (key: string) => {
    const value = Number(first(query[key]));
    return first(query[key]) !== undefined && Number.isFinite(value) ? value : undefined;
  };

  // Only keys that are present override the form's defaults.
  const initial: InitialSettings = Object.fromEntries(
    Object.entries({
      words: first(query.words)?.slice(0, 100),
      count: number("count"),
      engine: pick("engine", ["markov", "neural", "both"] as const),
      creativity: number("creativity"),
      length: pick("length", ["any", "short", "medium", "long"] as const),
      position: pick("position", ["any", "start", "middle", "end"] as const),
      readability: pick("readability", ["any", "easy", "hard"] as const),
      grammar: first(query.grammar) === undefined ? undefined : first(query.grammar) !== "off",
    }).filter(([, value]) => value !== undefined),
  );

  return (
    <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-6 sm:py-10 lg:py-0">
      {/* Structured data: tells search engines what this site is. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, "\\u003c") }}
      />
      <Generator initial={initial} />
    </main>
  );
}
