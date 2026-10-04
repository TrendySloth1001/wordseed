// Runs the sentence engine inside the browser, for when the server cannot be
// reached. It answers the same API paths as the server, from the corpus and
// model files the service worker saved, and keeps runs made offline in
// IndexedDB. Building the Markov model takes a few seconds, so it happens once,
// on the first request.
import { explainTrace, generateRun, parseGenerateRequest, UnknownWordError, type Models } from "../engine";
import { NeuralModel } from "../neural-model";
import { SentenceModel } from "../sentence-model";
import { findPassage, paragraphs } from "../source-reader";
import type { OfflineRequest, OfflineResponse } from "./protocol";
import { getLocalRun, saveLocalRun } from "./run-store";

type Manifest = {
  version: string;
  sources: { name: string; bytes: number; uploaded: boolean; url: string }[];
  neural: { meta: string; weights: string } | null;
};
type Corpus = { sources: Manifest["sources"]; texts: string[] };

let ready: Promise<{ models: Models; corpus: Corpus }> | null = null;

function load() {
  ready ??= (async () => {
    const manifest: Manifest = await (await fetch("/api/offline/manifest")).json();
    // The files come from wherever the manifest says: static copies on a
    // hosted site, the API locally. The service worker has them saved.
    const texts = await Promise.all(
      manifest.sources.map(async (source) => {
        const response = await fetch(source.url);
        if (!response.ok) throw new Error(`Could not load ${source.name}.`);
        return response.text();
      }),
    );
    const corpus: Corpus = { sources: manifest.sources, texts };
    const names = corpus.sources.map((source) => source.name.replace(/\.txt$/, ""));
    const model = new SentenceModel(corpus.texts, names);
    let neural: Promise<NeuralModel | null> | null = null;
    const loadNeural = async () => {
      if (!manifest.neural) return null;
      const [meta, weights] = await Promise.all([
        fetch(manifest.neural.meta).then((response) => response.json()),
        fetch(manifest.neural.weights).then((response) => response.arrayBuffer()),
      ]);
      return NeuralModel.fromData(meta, weights);
    };
    return { models: { model, neural: () => (neural ??= loadNeural()) }, corpus };
  })();
  // A failed load (say, nothing saved yet) is retried on the next request.
  ready.catch(() => (ready = null));
  return ready;
}

const json = (body: unknown, status = 200): OfflineResponse => ({ status, body });
const missing = json({ error: "That sentence no longer exists." }, 404);

async function handle({ method, path, body }: OfflineRequest): Promise<OfflineResponse> {
  if (method === "PING") return json({ ok: true });
  const url = new URL(path, "http://offline");
  const parts = url.pathname.split("/").filter(Boolean).slice(1); // drop "api"

  if (method === "POST" && url.pathname === "/api/generate") {
    const parsed = parseGenerateRequest(body);
    if ("error" in parsed) return json(parsed, 400);
    const { models } = await load();
    try {
      const stored = await generateRun(models, parsed.request);
      stored.run.offline = true;
      stored.run.notes.push("Made on this device while offline.");
      await saveLocalRun(stored);
      return json(stored.run);
    } catch (error) {
      if (error instanceof UnknownWordError) {
        return json({ error: error.message, word: error.word, suggestions: error.suggestions }, 404);
      }
      throw error;
    }
  }

  // Ratings and deleting are handled by the page itself, straight in IndexedDB.
  if (method === "GET" && parts[0] === "runs" && parts[2] === "sentences") {
    const stored = await getLocalRun(parts[1]);
    if (!stored) return json({ error: "Runs from the server cannot be opened while offline." }, 503);
    const detail = await explainTrace((await load()).models, stored, Number(parts[3]));
    return detail ? json(detail) : missing;
  }

  if (method === "GET") {
    const { models, corpus } = await load();
    const { model } = models;
    switch (parts[0]) {
      case "word": {
        const word = url.searchParams.get("word")?.trim() ?? "";
        const profile = word ? model.profile(word) : null;
        return profile ? json(profile) : json({ error: `"${word}" is not in the corpus.` }, 404);
      }
      case "words":
        return json(model.randomWords(Math.min(100, Math.max(1, Number(url.searchParams.get("count")) || 40))));
      case "sources": {
        const name = decodeURIComponent(parts[1] ?? "");
        const index = corpus.sources.findIndex((source) => source.name === `${name}.txt`);
        if (index === -1) return json({ error: "No such source." }, 404);
        const blocks = paragraphs(corpus.texts[index]);
        const passage = findPassage(blocks, url.searchParams.get("find")?.slice(0, 300) ?? "");
        if (!passage) return json({ error: "That wording was not found." }, 404);
        return json({ ...passage, text: blocks[passage.paragraph] });
      }
      case "corpus": {
        const neural = await models.neural();
        return json({
          sources: corpus.sources,
          stats: model.stats,
          statistics: model.corpusStatistics(),
          neural: neural && { vocabulary: neural.vocabulary.length, perplexity: neural.perplexity },
        });
      }
    }
  }

  return json({ error: "This needs the server, and it cannot be reached right now." }, 503);
}

self.onmessage = async (event: MessageEvent<{ id: number; request: OfflineRequest }>) => {
  const { id, request } = event.data;
  let response: OfflineResponse;
  try {
    response = await handle(request);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    response = json({ error: `The offline copy could not answer: ${reason}` }, 503);
  }
  // In a worker, postMessage takes no target origin (the DOM typings assume a window).
  (self as unknown as { postMessage(message: unknown): void }).postMessage({ id, response });
};
