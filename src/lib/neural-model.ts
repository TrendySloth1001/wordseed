// Inference for the small LSTM language model trained by ml/train.py.
//
// The network is trained on sentences rewritten around a pivot word:
//   pivot, words after it ..., <sep>, words before it in reverse ..., <end>
// so, given only a seed word, it writes the rest of the sentence to the right
// and then the beginning of the sentence right-to-left.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isTerminal, type Candidate, type Position } from "./text";

const UNKNOWN = 1;
const SEPARATOR = 2;
const END = 3;
const SPECIALS = 4;
const TOP_K = 40;
/** added to the logit of a requested word that is not in the sentence yet */
const TARGET_BONUS = 4;

type Manifest = {
  vocabulary: string[];
  hidden: number;
  perplexity: number;
};

export type NeuralSampleOptions = {
  temperature: number;
  maxTokens: number;
  position: Position;
};

export class NeuralModel {
  readonly vocabulary: string[];
  readonly perplexity: number;

  private hidden: number;
  private embedding: Float32Array;
  private inputWeights: Float32Array;
  private hiddenWeights: Float32Array;
  private gateBias: Float32Array;
  private outputBias: Float32Array;
  private lookup = new Map<string, number[]>();
  private terminals: number[] = [];

  private constructor(manifest: Manifest, weights: Float32Array) {
    const size = manifest.vocabulary.length;
    const hidden = manifest.hidden;
    this.vocabulary = manifest.vocabulary;
    this.perplexity = manifest.perplexity;
    this.hidden = hidden;

    let offset = 0;
    const take = (length: number) => weights.subarray(offset, (offset += length));
    this.embedding = take(size * hidden);
    this.inputWeights = take(4 * hidden * hidden);
    this.hiddenWeights = take(4 * hidden * hidden);
    this.gateBias = take(4 * hidden);
    this.outputBias = take(size);

    for (let id = SPECIALS; id < size; id++) {
      const token = this.vocabulary[id];
      if (isTerminal(token)) this.terminals.push(id);
      const key = token.toLowerCase();
      const variants = this.lookup.get(key);
      if (variants) variants.push(id);
      else this.lookup.set(key, [id]);
    }
  }

  /** Loads the trained model, or returns null when it has not been trained. */
  static async load(directory: string): Promise<NeuralModel | null> {
    try {
      const manifest: Manifest = JSON.parse(
        await readFile(path.join(directory, "model.json"), "utf8"),
      );
      const buffer = await readFile(path.join(directory, "model.bin"));
      const weights = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
      return new NeuralModel(manifest, weights.slice());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  has(word: string): boolean {
    return this.lookup.has(word.toLowerCase());
  }

  /** Samples one sentence around words[0]; null when the attempt ran too long. */
  sample(words: string[], options: NeuralSampleOptions): Candidate | null {
    const { hidden, vocabulary } = this;
    const targets = words.map((word) => this.lookup.get(word.toLowerCase()) ?? []);
    let remaining = targets.slice(1);

    const h = new Float32Array(hidden);
    const c = new Float32Array(hidden);
    const logits = new Float32Array(vocabulary.length);

    // The vocabulary is ordered by frequency, so [0] is the commonest casing.
    const seed = targets[0][0];
    const after: number[] = [];
    const before: number[] = [];
    let logProbability = 0;
    let steps = 0;
    let input = seed;
    let backward = false;

    for (;;) {
      this.step(input, h, c, logits);
      if (after.length + before.length > options.maxTokens) return null;

      let next: number;
      if (!backward && after.length > 0 && this.terminals.includes(after.at(-1)!)) {
        // A sentence-final mark is always followed by the separator.
        next = SEPARATOR;
        backward = true;
      } else {
        const first = backward ? before.length === 0 : after.length === 0;
        const allowed = (id: number): boolean => {
          if (id < SPECIALS) {
            if (id !== END || !backward) return false;
            return !(first && options.position === "middle") && remaining.length === 0;
          }
          const terminal = this.terminals.includes(id);
          if (backward) return !terminal && !(first && options.position === "start");
          if (first && options.position === "end") return terminal;
          if (first && options.position === "middle") return !terminal;
          return true;
        };
        for (const variants of remaining) {
          for (const id of variants) logits[id] += TARGET_BONUS;
        }
        const choice = this.choose(logits, options.temperature, allowed);
        if (choice === null) return null;
        next = choice.id;
        logProbability += choice.logProbability;
        steps++;
        remaining = remaining.filter((variants) => !variants.includes(next));
      }

      if (next === END) break;
      if (next !== SEPARATOR) (backward ? before : after).push(next);
      input = next;
    }

    const ids = [...before.reverse(), seed, ...after];
    return {
      tokens: ids.map((id) => vocabulary[id]),
      score: logProbability / Math.max(steps, 1),
    };
  }

  /** One LSTM step: updates h and c in place and fills `logits`. */
  private step(input: number, h: Float32Array, c: Float32Array, logits: Float32Array): void {
    const { hidden, embedding, inputWeights, hiddenWeights, gateBias, outputBias } = this;
    const x = embedding.subarray(input * hidden, (input + 1) * hidden);
    const gates = new Float32Array(4 * hidden);
    for (let row = 0; row < 4 * hidden; row++) {
      let sum = gateBias[row];
      const base = row * hidden;
      for (let k = 0; k < hidden; k++) {
        sum += inputWeights[base + k] * x[k] + hiddenWeights[base + k] * h[k];
      }
      gates[row] = sum;
    }
    // PyTorch gate order: input, forget, cell, output.
    for (let k = 0; k < hidden; k++) {
      const i = sigmoid(gates[k]);
      const f = sigmoid(gates[hidden + k]);
      const g = Math.tanh(gates[2 * hidden + k]);
      const o = sigmoid(gates[3 * hidden + k]);
      c[k] = f * c[k] + i * g;
      h[k] = o * Math.tanh(c[k]);
    }
    // The output layer shares its weights with the embedding.
    // Four running sums keep this loop, the hot spot of inference, fast; the
    // hidden size is a multiple of four.
    for (let id = 0; id < logits.length; id++) {
      const base = id * hidden;
      let s0 = outputBias[id];
      let s1 = 0;
      let s2 = 0;
      let s3 = 0;
      for (let k = 0; k < hidden; k += 4) {
        s0 += embedding[base + k] * h[k];
        s1 += embedding[base + k + 1] * h[k + 1];
        s2 += embedding[base + k + 2] * h[k + 2];
        s3 += embedding[base + k + 3] * h[k + 3];
      }
      logits[id] = s0 + s1 + s2 + s3;
    }
  }

  /** Top-k sampling with temperature over the allowed tokens. */
  private choose(
    logits: Float32Array,
    temperature: number,
    allowed: (id: number) => boolean,
  ): { id: number; logProbability: number } | null {
    logits[UNKNOWN] = -Infinity;
    const top: number[] = [];
    let max = -Infinity;
    for (let id = 0; id < logits.length; id++) {
      const value = logits[id];
      if (value > max) max = value;
      if (top.length === TOP_K && value <= logits[top[TOP_K - 1]]) continue;
      if (!allowed(id)) continue;
      let slot = top.length < TOP_K ? top.length : TOP_K - 1;
      while (slot > 0 && logits[top[slot - 1]] < value) {
        top[slot] = top[slot - 1];
        slot--;
      }
      top[slot] = id;
    }
    if (top.length === 0) return null;

    let normaliser = 0;
    for (let id = 0; id < logits.length; id++) normaliser += Math.exp(logits[id] - max);
    const logNormaliser = max + Math.log(normaliser);

    const weights = top.map((id) => Math.exp((logits[id] - logits[top[0]]) / temperature));
    let threshold = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
    let chosen = top[top.length - 1];
    for (let i = 0; i < top.length; i++) {
      threshold -= weights[i];
      if (threshold <= 0) {
        chosen = top[i];
        break;
      }
    }
    return { id: chosen, logProbability: logits[chosen] - logNormaliser };
  }
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}
