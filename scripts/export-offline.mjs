// Copies the corpus and the neural model into public/offline/<version>/ so a
// host serves them as static files (a server response on Vercel is capped at
// 4.5 MB; these are up to 10 MB each), and writes data/offline-manifest.json,
// which /api/offline/manifest returns on such a host. Runs before every build.
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const corpusDir = path.join(root, "data", "corpus");
const neuralDir = path.join(root, "data", "neural");
const outRoot = path.join(root, "public", "offline");

const names = (await readdir(corpusDir)).filter((file) => file.endsWith(".txt")).sort();
const sources = await Promise.all(
  names.map(async (name) => ({ name, bytes: (await stat(path.join(corpusDir, name))).size, uploaded: false })),
);
const neuralFiles = await Promise.all(
  ["model.json", "model.bin"].map((file) => stat(path.join(neuralDir, file)).then((info) => info.size, () => 0)),
);
const hasNeural = neuralFiles.every((bytes) => bytes > 0);

// The version changes whenever any file does, so browsers replace stale copies.
const hash = createHash("sha1");
for (const source of sources) hash.update(`${source.name}:${source.bytes}\n`);
hash.update(`neural:${neuralFiles.join(":")}`);
const version = hash.digest("hex").slice(0, 10);

await rm(outRoot, { recursive: true, force: true });
const out = path.join(outRoot, version);
await mkdir(path.join(out, "corpus"), { recursive: true });
for (const source of sources) await copyFile(path.join(corpusDir, source.name), path.join(out, "corpus", source.name));
if (hasNeural) {
  await mkdir(path.join(out, "neural"), { recursive: true });
  for (const file of ["model.json", "model.bin"]) await copyFile(path.join(neuralDir, file), path.join(out, "neural", file));
}

const manifest = {
  version,
  sources: sources.map((source) => ({ ...source, url: `/offline/${version}/corpus/${encodeURIComponent(source.name)}` })),
  neural: hasNeural
    ? { meta: `/offline/${version}/neural/model.json`, weights: `/offline/${version}/neural/model.bin` }
    : null,
  bytes: sources.reduce((sum, source) => sum + source.bytes, 0) + neuralFiles[0] + neuralFiles[1],
};
await writeFile(path.join(root, "data", "offline-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Offline files: ${sources.length} texts${hasNeural ? " + neural model" : ""}, version ${version}`);
