import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Everything public may be crawled; the API and each visitor's own pages may not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/runs", "/offline"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
