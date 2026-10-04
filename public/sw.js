// wordseed service worker. Registered only after the visitor allows offline
// use. It saves every page, the scripts and styles they need, and the corpus
// and model files, then serves them whenever the network is unavailable.
//
// Strategy: network first for everything, so an online visitor always gets
// fresh pages; each successful response refreshes the saved copy. Offline, the
// saved copy is served, and a page that was never saved redirects to /offline,
// which lists the pages that were.

const PAGES = "wordseed-pages";
const ASSETS = "wordseed-assets";
const DATA = "wordseed-data";
const META = "wordseed-meta";
const MAIN_PAGES = ["/", "/runs", "/corpus", "/docs", "/offline"];
const RESAVE_AFTER = 24 * 60 * 60 * 1000;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  if (event.data?.type !== "save") return;
  const port = event.ports[0];
  const post = (message) => port?.postMessage(message);
  event.waitUntil(
    save(Boolean(event.data.force), post).then(
      () => post({ type: "done" }),
      (error) => post({ type: "error", message: String(error?.message ?? error) }),
    ),
  );
});

async function readMeta() {
  const response = await (await caches.open(META)).match("/__meta");
  return response ? response.json() : {};
}

async function writeMeta(meta) {
  await (await caches.open(META)).put("/__meta", Response.json(meta));
}

/** Saves the whole site. Skipped when nothing changed and the last save is recent. */
async function save(force, post) {
  const manifest = await (await fetch("/api/offline/manifest", { cache: "no-store" })).json();
  const meta = await readMeta();
  if (!force && meta.version === manifest.version && Date.now() - (meta.savedAt ?? 0) < RESAVE_AFTER) {
    post({ type: "progress", done: 1, total: 1 });
    return;
  }

  const sourcePages = manifest.sources.map(
    (source) => `/corpus/${encodeURIComponent(source.name.replace(/\.txt$/, ""))}`,
  );
  const data = [
    "/api/offline/manifest",
    `/api/offline/corpus?v=${manifest.version}`,
    ...(manifest.neural ? [`/api/offline/neural?v=${manifest.version}`, `/api/offline/weights?v=${manifest.version}`] : []),
  ];
  const total = MAIN_PAGES.length + sourcePages.length + data.length + 1;
  let done = 0;
  const step = () => post({ type: "progress", done: ++done, total });

  // Pages first, collecting every asset they reference.
  const pages = await caches.open(PAGES);
  const assets = new Set();
  for (const path of [...MAIN_PAGES, ...sourcePages]) {
    const response = await fetch(path, { cache: "no-store" });
    if (response.ok) {
      const html = await response.clone().text();
      for (const url of assetUrls(html)) assets.add(url);
      await pages.put(path, response);
    }
    step();
  }

  // Scripts, styles, images, and anything the stylesheets point at (fonts).
  const assetCache = await caches.open(ASSETS);
  const queue = [...assets];
  while (queue.length > 0) {
    const batch = queue.splice(0, 8);
    await Promise.all(
      batch.map(async (url) => {
        const response = await fetch(url).catch(() => null);
        if (!response?.ok) return;
        if (url.endsWith(".css")) {
          const css = await response.clone().text();
          // Fonts are linked relative to the stylesheet: ../media/KaTeX_Main-Regular.woff2
          for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
            if (match[1].startsWith("data:")) continue;
            const target = new URL(match[1], new URL(url, self.location.origin));
            if (target.origin !== self.location.origin) continue;
            const path = target.pathname + target.search;
            if (!assets.has(path)) {
              assets.add(path);
              queue.push(path);
            }
          }
        }
        await assetCache.put(url, response);
      }),
    );
  }
  step();

  // The corpus and models, under versioned URLs; older versions are dropped.
  const dataCache = await caches.open(DATA);
  for (const url of data) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not save ${url} (${response.status}).`);
    await dataCache.put(url, response);
    step();
  }
  for (const request of await dataCache.keys()) {
    const url = new URL(request.url);
    if (url.searchParams.has("v") && url.searchParams.get("v") !== manifest.version) await dataCache.delete(request);
  }

  await writeMeta({ version: manifest.version, savedAt: Date.now(), bytes: manifest.bytes });
}

/** Same-origin URLs of scripts, styles and images referenced by a page. */
function assetUrls(html) {
  const urls = new Set();
  const text = html.replaceAll("&amp;", "&").replaceAll("\\u0026", "&");
  for (const match of text.matchAll(/\/_next\/static\/[^"'\\\s)<>,]+/g)) urls.add(match[0]);
  for (const match of text.matchAll(/\/_next\/image\?[^"'\\\s<>,]+/g)) urls.add(match[0]);
  for (const match of text.matchAll(/(?:src|href)="(\/[^"/][^"]*\.(?:svg|png|ico|webp|jpg|css|js))"/g)) urls.add(match[1]);
  return urls;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/webpack-hmr") || url.pathname.startsWith("/__nextjs")) return;

  if (request.mode === "navigate") event.respondWith(page(request, url));
  else if (url.pathname.startsWith("/api/offline/") && url.pathname !== "/api/offline/manifest") {
    event.respondWith(cacheFirst(request, DATA));
  } else if (url.pathname.startsWith("/api/")) event.respondWith(networkFirst(request, DATA));
  else event.respondWith(networkFirst(request, ASSETS));
});

/** A page: fresh from the network, else the saved copy, else /offline. */
async function page(request, url) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok && !url.searchParams.has("_rsc")) await cache.put(url.pathname + url.search, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(url.pathname + url.search)) ??
      (await cache.match(url.pathname, { ignoreSearch: true })) ??
      // Redirect rather than serve /offline here: the page's own data names its
      // address, and Next.js would show a 404 if the two disagreed.
      ((await cache.match("/offline")) && Response.redirect(`/offline?from=${encodeURIComponent(url.pathname)}`, 302)) ??
      new Response("<h1>Offline</h1><p>This page has not been saved for offline use.</p>", {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    );
  }
}

async function networkFirst(request, name) {
  const cache = await caches.open(name);
  try {
    const response = await fetch(request);
    // Next's in-app navigation data (RSC) is keyed by its URL; save it like any other.
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const saved = await cache.match(request);
    if (saved) return saved;
    // No saved copy: fail like the network did, so the app can fall back
    // (a failed in-app navigation becomes a full page load, served above).
    throw error;
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
