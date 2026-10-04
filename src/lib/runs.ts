// Saved generation runs. Each run is one JSON file in data/runs holding what
// the browser sees plus the per-sentence traces needed to explain a sentence
// later. Only the most recent runs are kept.
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getModel, getNeuralModel } from "./corpus";
import { explainTrace, type StoredRun } from "./engine";
import type { Run, RunListItem, SentenceDetail } from "./run-types";

const RUN_DIR = path.join(process.cwd(), "data", "runs");
const KEEP = 50;

function runPath(id: string): string | null {
  return /^[a-z0-9]+$/.test(id) ? path.join(RUN_DIR, `${id}.json`) : null;
}

async function load(id: string): Promise<StoredRun | null> {
  const file = runPath(id);
  if (!file) return null;
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

/** Run ids, newest first (ids start with the timestamp in base 36). */
async function runIds(): Promise<string[]> {
  const files = await readdir(RUN_DIR).catch(() => [] as string[]);
  return files
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -5))
    .sort()
    .reverse();
}

export async function saveRun(run: Run, traces: StoredRun["traces"]): Promise<void> {
  await mkdir(RUN_DIR, { recursive: true });
  await writeFile(runPath(run.id)!, JSON.stringify({ run, traces } satisfies StoredRun));
  for (const old of (await runIds()).slice(KEEP)) await unlink(runPath(old)!).catch(() => {});
}

export async function getRun(id: string): Promise<Run | null> {
  return (await load(id))?.run ?? null;
}

export async function listRuns(): Promise<RunListItem[]> {
  const stored = await Promise.all((await runIds()).map(load));
  return stored
    .filter((entry) => entry !== null)
    .map(({ run }) => {
      const ratings = Object.values(run.ratings);
      return {
        id: run.id,
        time: run.time,
        words: run.words,
        engine: run.engine,
        settings: run.settings,
        sentences: run.sentences.length,
        liked: ratings.filter((rating) => rating === 1).length,
        disliked: ratings.filter((rating) => rating === -1).length,
      };
    });
}

export async function deleteRun(id: string): Promise<boolean> {
  const file = runPath(id);
  if (!file) return false;
  return unlink(file).then(
    () => true,
    () => false,
  );
}

/** Sets or clears (rating 0) the rating of one sentence. */
export async function rateSentence(id: string, index: number, rating: 1 | -1 | 0): Promise<Run | null> {
  const stored = await load(id);
  if (!stored || !stored.run.sentences[index]) return null;
  if (rating === 0) delete stored.run.ratings[index];
  else stored.run.ratings[index] = rating;
  await writeFile(runPath(id)!, JSON.stringify(stored));
  return stored.run;
}

/** Explains one sentence of a saved run. */
export async function explainSentence(id: string, index: number): Promise<SentenceDetail | null> {
  const stored = await load(id);
  if (!stored) return null;
  return explainTrace({ model: await getModel(), neural: getNeuralModel }, stored, index);
}
