import assert from "node:assert/strict";
import { test } from "node:test";
import { createGrammar } from "../src/lib/grammar";
import { SentenceModel } from "../src/lib/sentence-model";
import { isPunctuation } from "../src/lib/text";

const grammar = createGrammar(["walk", "see", "like"]);
const split = (sentence: string) => sentence.split(" ");

test("grammar accepts ordinary sentences", () => {
  assert.equal(grammar.explain(split("the dog walked to the river .")).problem, null);
  assert.equal(grammar.explain(split("she is here .")).problem, null);
});

test("grammar names the rule a sentence breaks", () => {
  const problem = (sentence: string) => grammar.explain(split(sentence)).problem;
  assert.equal(problem("the old house by the river ."), "no verb");
  assert.equal(problem("she walked to the ."), 'ends on "the"');
  assert.equal(problem("he would can see it ."), 'two modals: "would can"');
  assert.equal(problem("they saw the of it ."), 'determiner with no noun: "the of"');
  assert.equal(problem("we saw a apple ."), '"a" before a vowel');
  assert.equal(problem("it it is here ."), "repeated word");
});

test("grammar tags closed-class words and learned verbs", () => {
  assert.deepEqual(grammar.explain(split("they will walk to the river .")).tags, [
    "subject", "modal", "verb", "to", "det", "other", "punct",
  ]);
});

const CORPUS = [
  "The quick fox jumped over the lazy dog. The lazy dog slept under the old tree. " +
    "A quick fox can see the old tree. The old tree stood near the quiet river. " +
    "The quiet river ran past the lazy dog. A fox would walk over the quiet river.",
  "River water is cold in winter. The fox can walk past the old tree in winter.",
];
const model = new SentenceModel(CORPUS, ["fables", "notes"]);
const options = { creativity: 0.5, maxTokens: 40, position: "any" as const };

function sampleMany(words: string[], position: "any" | "start" | "end" = "any") {
  const sample = model.sampler(words, { ...options, position });
  assert.ok(sample);
  const results = [];
  for (let i = 0; i < 300; i++) {
    const candidate = sample();
    if (candidate) results.push(candidate);
  }
  assert.ok(results.length > 0);
  return results;
}

test("the model counts sentences, tokens and distinct words", () => {
  assert.equal(model.stats.sentences, 8);
  assert.equal(model.frequency("fox"), 4);
  assert.equal(model.frequency("River"), 4);
  assert.ok(model.has("WINTER"));
  assert.ok(!model.has("computer"));
});

test("every sampled sentence contains the seed word", () => {
  for (const candidate of sampleMany(["fox"])) {
    assert.ok(candidate.tokens.includes("fox"));
    assert.equal(candidate.tokens[candidate.seed], "fox");
    assert.equal(candidate.orders?.length, candidate.tokens.length);
  }
});

test("position start and end place the word first and last", () => {
  for (const { tokens } of sampleMany(["river"], "start")) assert.equal(tokens[0], "river");
  for (const { tokens } of sampleMany(["river"], "end")) {
    assert.equal(tokens.filter((token) => !isPunctuation(token)).at(-1), "river");
  }
  assert.equal(model.sampler(["fox"], { ...options, position: "end" }), null);
});

test("several words all appear in a sampled sentence", () => {
  for (const { tokens } of sampleMany(["fox", "river"])) {
    assert.ok(tokens.includes("fox"));
    assert.ok(tokens.some((token) => token.toLowerCase() === "river"));
  }
});

test("an unknown word has no sampler but gets suggestions", () => {
  assert.equal(model.sampler(["computer"], options), null);
  assert.deepEqual(model.suggest("rivver"), ["river"]);
});

test("segments trace copied stretches to their source", () => {
  const tokens = split("the lazy dog slept under the old tree in winter .");
  assert.deepEqual(model.segments(tokens), [
    { start: 0, length: 8, source: "fables" },
    { start: 8, length: 3, source: "notes" },
  ]);
  assert.ok(model.isCorpusSentence(split("River water is cold in winter .")));
  assert.ok(!model.isCorpusSentence(tokens));
});

test("probabilities are higher for words the context predicts", () => {
  const [, quick, fox] = model.probabilities(split("a quick fox ran ."));
  assert.ok(fox > quick);
  assert.ok(model.perplexity(split("the lazy dog slept .")) < model.perplexity(split("winter dog cold fox .")));
});

test("alternatives list what follows a context", () => {
  const { occurrences, options: found } = model.alternatives(split("the old tree"), 2, 2, true);
  assert.equal(occurrences, 4);
  assert.deepEqual(found, [{ word: "tree", share: 1 }]);
});

test("profile reports neighbours and sources", () => {
  const profile = model.profile("fox");
  assert.ok(profile);
  assert.equal(profile.count, 4);
  assert.deepEqual(profile.before[0], { word: "quick", count: 2 });
  assert.deepEqual(profile.sources, [
    { word: "fables", count: 3 },
    { word: "notes", count: 1 },
  ]);
  assert.equal(model.profile("computer"), null);
});

test("corpus statistics bucket sentence lengths", () => {
  const statistics = model.corpusStatistics();
  assert.equal(statistics.topWords[0].word, "the");
  assert.equal(statistics.sentenceLengths.reduce((sum, bucket) => sum + bucket.count, 0), 8);
  assert.deepEqual(statistics.sources.map((source) => source.word), ["fables", "notes"]);
});
