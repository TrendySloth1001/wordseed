import assert from "node:assert/strict";
import { test } from "node:test";
import { readingEase, syllables } from "../src/lib/readability";
import { detokenize, prepareSentences, tokenize } from "../src/lib/text";
import { inflect, relatedForms } from "../src/lib/word-forms";

test("tokenize splits sentences and keeps punctuation as tokens", () => {
  assert.deepEqual(tokenize("The cat sat down. Did it purr, though?"), [
    ["The", "cat", "sat", "down", "."],
    ["Did", "it", "purr", ",", "though", "?"],
  ]);
});

test("tokenize joins a lowercase continuation to the sentence before it", () => {
  assert.deepEqual(tokenize('"What is this!" he cried at last.'), [
    ["What", "is", "this", ",", "he", "cried", "at", "last", "."],
  ]);
});

test("tokenize keeps abbreviations, contractions and hyphens inside one sentence", () => {
  assert.deepEqual(tokenize("Mr. Darcy didn't see the well-known man."), [
    ["Mr", "Darcy", "didn't", "see", "the", "well-known", "man", "."],
  ]);
});

test("tokenize skips headings, short fragments and non-Latin text", () => {
  assert.deepEqual(tokenize("CHAPTER ONE.\n\nYes.\n\nОн пришёл домой вчера."), []);
});

test("prepareSentences lowercases a sentence-initial common word but keeps names", () => {
  const sentences = prepareSentences(["The dog saw Anna here. Anna saw the dog there."]);
  assert.equal(sentences[0][0], "the");
  assert.equal(sentences[1][0], "Anna");
});

test("detokenize attaches punctuation and capitalises the first letter", () => {
  assert.equal(detokenize(["well", ",", "it", "works", "!"]), "Well, it works!");
});

test("inflect builds regular forms", () => {
  assert.deepEqual(inflect("stop"), ["stops", "stoped", "stoping", "stopped", "stopping"]);
  assert.deepEqual(inflect("carry"), ["carries", "carried", "carrying"]);
  assert.deepEqual(inflect("make"), ["makes", "maked", "making"]);
});

test("relatedForms reaches base and irregular forms", () => {
  assert.ok(relatedForms("running").includes("run"));
  assert.ok(relatedForms("running").includes("ran"));
  assert.ok(relatedForms("cities").includes("city"));
  assert.ok(relatedForms("went").includes("go"));
  assert.ok(!relatedForms("run").includes("run"));
});

test("syllables counts vowel groups with a silent final e", () => {
  assert.equal(syllables("cat"), 1);
  assert.equal(syllables("make"), 1);
  assert.equal(syllables("water"), 2);
  assert.equal(syllables("beautiful"), 3);
});

test("readingEase rates short plain sentences as easier", () => {
  const easy = readingEase(["the", "cat", "sat", "on", "the", "mat", "."]);
  const hard = readingEase("international organisations consider environmental responsibilities".split(" "));
  assert.ok(easy > 90);
  assert.ok(hard < 0);
});

test("tokenize spells out e.g. and i.e. instead of splitting on their dots", () => {
  assert.deepEqual(tokenize("Use a tool, e.g. a hammer, i.e. something heavy."), [
    ["Use", "a", "tool", ",", "for", "example", ",", "a", "hammer", ",", "that", "is", ",", "something", "heavy", "."],
  ]);
});

test("findPassage locates tokenised wording in the original punctuation", async () => {
  const { findPassage, paragraphs, isHeading, sourceTitle } = await import("../src/lib/source-reader");
  const blocks = paragraphs('CHAPTER I\n\n“Well,” said Mr. Darcy,\n“it didn’t rain.”\n\nIt rained later.');
  assert.deepEqual(blocks, ["CHAPTER I", "“Well,” said Mr. Darcy, “it didn’t rain.”", "It rained later."]);
  const passage = findPassage(blocks, "said Mr Darcy , it didn't rain");
  assert.deepEqual(passage && blocks[1].slice(passage.start, passage.end), "said Mr. Darcy, “it didn’t rain");
  assert.equal(findPassage(blocks, "rain")?.paragraph, 1); // not "rained"
  assert.equal(findPassage(blocks, "rained", 1)?.paragraph, 2);
  assert.equal(findPassage(blocks, "snow"), null);
  assert.ok(isHeading(blocks[0]) && !isHeading(blocks[2]));
  assert.equal(sourceTitle("pride-and-prejudice"), "Pride and prejudice");
});
