// Downloads the public-domain books the sentence model is trained on into
// data/corpus/. Any extra .txt file dropped into that folder is picked up too.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BOOKS = {
  "pride-and-prejudice": 1342,
  "alice-in-wonderland": 11,
  "sherlock-holmes": 1661,
  frankenstein: 84,
  dracula: 345,
  "great-gatsby": 64317,
  "wizard-of-oz": 55,
  "peter-pan": 16,
  "treasure-island": 120,
  "time-machine": 35,
  "war-of-the-worlds": 36,
  "jungle-book": 236,
  "anne-of-green-gables": 45,
  "secret-garden": 113,
  "call-of-the-wild": 215,
  "tom-sawyer": 74,
  "wind-in-the-willows": 289,
};

const outDir = path.join(import.meta.dirname, "..", "data", "corpus");
await mkdir(outDir, { recursive: true });

for (const [name, id] of Object.entries(BOOKS)) {
  const res = await fetch(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`);
  if (!res.ok) {
    console.error(`skipped ${name}: HTTP ${res.status}`);
    continue;
  }
  const raw = await res.text();
  // Keep only the book itself, not the Project Gutenberg licence boilerplate.
  const start = raw.match(/\*\*\* ?START OF TH(E|IS) PROJECT GUTENBERG EBOOK[^\n]*\n/);
  const end = raw.search(/\*\*\* ?END OF TH(E|IS) PROJECT GUTENBERG EBOOK/);
  const body = raw.slice(
    start ? start.index + start[0].length : 0,
    end === -1 ? raw.length : end,
  );
  await writeFile(path.join(outDir, `${name}.txt`), body.trim() + "\n");
  console.log(`${name}: ${(body.length / 1024).toFixed(0)} KB`);
}
