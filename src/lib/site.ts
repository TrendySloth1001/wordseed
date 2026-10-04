// Facts about the public site, used for SEO metadata, the sitemap and sharing.
// Set NEXT_PUBLIC_SITE_URL when the site moves to its own domain.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://wordseed-five.vercel.app").replace(/\/$/, "");
export const SITE_NAME = "wordseed";
export const SITE_TAGLINE = "Type a word, get as many sentences as you want";
export const SITE_DESCRIPTION =
  "Generate any number of sentences containing your word, written by an n-gram model and a small LSTM built from scratch, trained on 17 classic novels and Simple English Wikipedia. Every sentence is explained: probabilities, sources and grammar.";
export const AUTHOR = { name: "Nikhil Kumawat", url: "https://github.com/TrendySloth1001" };
export const REPOSITORY = "https://github.com/TrendySloth1001/wordseed";
