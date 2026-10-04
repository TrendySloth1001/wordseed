import type { MetadataRoute } from "next";
import { listSources } from "@/lib/corpus";
import { SITE_URL } from "@/lib/site";

/** The public pages, plus every book and article in the corpus. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/docs`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/corpus`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
  const sources = (await listSources()).filter((source) => !source.uploaded);
  return [
    ...pages,
    ...sources.map((source) => ({
      url: `${SITE_URL}/corpus/${encodeURIComponent(source.name.replace(/\.txt$/, ""))}`,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
  ];
}
