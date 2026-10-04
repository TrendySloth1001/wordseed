import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { READ_ONLY } from "./deployment";
import { NeuralModel } from "./neural-model";
import { SentenceModel } from "./sentence-model";

const CORPUS_DIR = path.join(process.cwd(), "data", "corpus");
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const NEURAL_DIR = path.join(process.cwd(), "data", "neural");

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type Source = { name: string; bytes: number; uploaded: boolean };

// Training takes a few seconds, so each model is built once per server
// process (globalThis survives dev-server module reloads) and rebuilt only
// when its files on disk change, or when the dev server reloads the model's
// code (which gives the class a new identity).
type Cached<T> = { signature: string; build: unknown; value: Promise<T> };
const cache = globalThis as typeof globalThis & {
  sentenceModel?: Cached<SentenceModel>;
  neuralModel?: Cached<NeuralModel | null>;
};

async function textFiles(directory: string): Promise<string[]> {
  const files = await readdir(directory).catch(() => [] as string[]);
  return files.filter((file) => file.endsWith(".txt")).sort();
}

/** Identifies the current contents of some files by path, size and mtime. */
async function signatureOf(paths: string[]): Promise<string> {
  const parts = await Promise.all(
    paths.map(async (file) => {
      const info = await stat(file).catch(() => null);
      return info ? `${file}:${info.size}:${info.mtimeMs}` : `${file}:missing`;
    }),
  );
  return parts.join("|");
}

async function corpusPaths(): Promise<string[]> {
  return [
    ...(await textFiles(CORPUS_DIR)).map((file) => path.join(CORPUS_DIR, file)),
    ...(await textFiles(UPLOAD_DIR)).map((file) => path.join(UPLOAD_DIR, file)),
  ];
}

export async function getModel(): Promise<SentenceModel> {
  const paths = await corpusPaths();
  if (paths.length === 0) {
    throw new Error("No corpus found in data/corpus. Run `npm run corpus` to download it.");
  }
  const signature = await signatureOf(paths);
  if (cache.sentenceModel?.signature !== signature || cache.sentenceModel.build !== SentenceModel) {
    const value = Promise.all(paths.map((file) => readFile(file, "utf8"))).then(
      (texts) => new SentenceModel(texts, paths.map((file) => path.basename(file, ".txt"))),
    );
    cache.sentenceModel = { signature, build: SentenceModel, value };
    value.catch(() => (cache.sentenceModel = undefined));
  }
  return cache.sentenceModel.value;
}

/** The trained LSTM, or null when `npm run train:neural` has not been run. */
export async function getNeuralModel(): Promise<NeuralModel | null> {
  const signature = await signatureOf([path.join(NEURAL_DIR, "model.bin")]);
  if (cache.neuralModel?.signature !== signature || cache.neuralModel.build !== NeuralModel) {
    const value = loadNeuralFiles().then((files) => files && NeuralModel.fromData(files.manifest, files.weights));
    cache.neuralModel = { signature, build: NeuralModel, value };
    value.catch(() => (cache.neuralModel = undefined));
  }
  return cache.neuralModel.value;
}

/** The neural model's files, or null when `npm run train:neural` has not been run. */
export async function loadNeuralFiles(): Promise<{ manifest: unknown; weights: ArrayBuffer } | null> {
  try {
    const manifest = JSON.parse(await readFile(path.join(NEURAL_DIR, "model.json"), "utf8"));
    const buffer = await readFile(path.join(NEURAL_DIR, "model.bin"));
    const weights = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    return { manifest, weights };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export type OfflineManifest = {
  version: string;
  sources: (Source & { url: string })[];
  neural: { meta: string; weights: string } | null;
  bytes: number;
};

/**
 * What a browser downloads to run both models offline, and where from.
 * `version` changes whenever any of the files does, so the browser knows when
 * its saved copy is stale. On a read-only host the files are the static copies
 * made before the build (scripts/export-offline.mjs); elsewhere the API serves
 * them, uploads included.
 */
export async function offlineManifest(): Promise<OfflineManifest> {
  if (READ_ONLY) {
    const exported = await readFile(path.join(process.cwd(), "data", "offline-manifest.json"), "utf8").catch(() => null);
    if (exported) return JSON.parse(exported);
  }
  const sources = await listSources();
  const neuralFiles = ["model.json", "model.bin"].map((file) => path.join(NEURAL_DIR, file));
  const signature = await signatureOf([...(await corpusPaths()), ...neuralFiles]);
  let hash = 0;
  for (let i = 0; i < signature.length; i++) hash = (Math.imul(hash, 31) + signature.charCodeAt(i)) | 0;
  const version = (hash >>> 0).toString(36);
  const neuralBytes = (await Promise.all(neuralFiles.map((file) => stat(file).catch(() => null)))).map(
    (info) => info?.size ?? 0,
  );
  return {
    version,
    sources: sources.map((source) => ({
      ...source,
      url: `/api/offline/corpus?name=${encodeURIComponent(source.name.replace(/\.txt$/, ""))}&v=${version}`,
    })),
    neural: neuralBytes.every((bytes) => bytes > 0)
      ? { meta: `/api/offline/neural?v=${version}`, weights: `/api/offline/weights?v=${version}` }
      : null,
    bytes: sources.reduce((sum, source) => sum + source.bytes, 0) + neuralBytes[0] + neuralBytes[1],
  };
}

export async function listSources(): Promise<Source[]> {
  const sources: Source[] = [];
  for (const [directory, uploaded] of [[CORPUS_DIR, false], [UPLOAD_DIR, true]] as const) {
    for (const name of await textFiles(directory)) {
      const { size } = await stat(path.join(directory, name));
      sources.push({ name, bytes: size, uploaded });
    }
  }
  return sources;
}

/** The full text of one corpus file, named without its .txt extension. */
export async function readSource(name: string): Promise<string | null> {
  // Only names that are actually in the corpus are ever turned into a path.
  for (const directory of [CORPUS_DIR, UPLOAD_DIR]) {
    if ((await textFiles(directory)).includes(`${name}.txt`)) {
      return readFile(path.join(directory, `${name}.txt`), "utf8");
    }
  }
  return null;
}

/** Reduces an uploaded file name to a safe `something.txt` inside UPLOAD_DIR. */
function uploadPath(name: string): string | null {
  const base = path
    .basename(name)
    .replace(/\.txt$/i, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return base ? path.join(UPLOAD_DIR, `${base}.txt`) : null;
}

/** Stores an uploaded text; the Markov model retrains on the next request. */
export async function saveUpload(name: string, text: string): Promise<string | null> {
  const target = uploadPath(name);
  if (!target) return null;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(target, text);
  return path.basename(target);
}

export async function deleteUpload(name: string): Promise<boolean> {
  const target = uploadPath(name);
  if (!target) return false;
  try {
    await unlink(target);
  } catch {
    return false;
  }
  return true;
}
