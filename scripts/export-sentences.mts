// Writes the corpus as one tokenised sentence per line for ml/train.py, using
// the same tokeniser as the app so both models see identical tokens.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prepareSentences } from "../src/lib/text";

const root = path.join(import.meta.dirname, "..", "data");
const files = (await readdir(path.join(root, "corpus"))).filter((file) => file.endsWith(".txt"));
const texts = await Promise.all(
  files.map((file) => readFile(path.join(root, "corpus", file), "utf8")),
);
const sentences = prepareSentences(texts);

await mkdir(path.join(root, "neural"), { recursive: true });
await writeFile(
  path.join(root, "neural", "sentences.txt"),
  sentences.map((sentence) => sentence.join(" ")).join("\n") + "\n",
);
console.log(`exported ${sentences.length} sentences`);
