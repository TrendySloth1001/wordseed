import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NeuralModel } from "./neural-model";
import { SentenceModel } from "./sentence-model";

const CORPUS_DIR = path.join(process.cwd(), "data", "corpus");
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const NEURAL_DIR = path.join(process.cwd(), "data", "neural");

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type Source = { name: string; bytes: number; uploaded: boolean };

// Training takes a few seconds, so each model is built once per server
// process (globalThis survives dev-server module reloads) and rebuilt only
// when its files on disk change.
type Cached<T> = { signature: string; value: Promise<T> };
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
  if (cache.sentenceModel?.signature !== signature) {
    const value = Promise.all(paths.map((file) => readFile(file, "utf8"))).then(
      (texts) => new SentenceModel(texts),
    );
    cache.sentenceModel = { signature, value };
    value.catch(() => (cache.sentenceModel = undefined));
  }
  return cache.sentenceModel.value;
}

/** The trained LSTM, or null when `npm run train:neural` has not been run. */
export async function getNeuralModel(): Promise<NeuralModel | null> {
  const signature = await signatureOf([path.join(NEURAL_DIR, "model.bin")]);
  if (cache.neuralModel?.signature !== signature) {
    const value = NeuralModel.load(NEURAL_DIR);
    cache.neuralModel = { signature, value };
    value.catch(() => (cache.neuralModel = undefined));
  }
  return cache.neuralModel.value;
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
