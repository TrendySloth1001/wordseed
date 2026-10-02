import { generate, MAX_COUNT, MAX_WORDS, UnknownWordError } from "@/lib/generate";
import type { Engine } from "@/lib/run-types";
import { LENGTHS, WORD, type Length, type Position, type Readability } from "@/lib/text";

const POSITIONS: Position[] = ["any", "start", "middle", "end"];
const ENGINES: Engine[] = ["markov", "neural"];
const READABILITY: Readability[] = ["any", "easy", "hard"];

function invalid(error: string) {
  return Response.json({ error }, { status: 400 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const words: string[] = Array.isArray(body?.words)
    ? body.words.filter((word: unknown) => typeof word === "string").map((word: string) => word.trim())
    : [];
  if (words.length < 1 || words.length > MAX_WORDS || !words.every((word) => WORD.test(word))) {
    return invalid(`Enter one to ${MAX_WORDS} words, separated by spaces.`);
  }

  const engine: Engine = ENGINES.includes(body.engine) ? body.engine : "markov";
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT.markov) {
    return invalid(`Count must be a whole number from 1 to ${MAX_COUNT.markov}.`);
  }

  const creativity = Number(body.creativity ?? 0.5);
  if (!(creativity >= 0 && creativity <= 1)) return invalid("Creativity must be between 0 and 1.");

  const length: Length = Object.hasOwn(LENGTHS, body.length) ? body.length : "any";
  const position: Position = POSITIONS.includes(body.position) ? body.position : "any";

  try {
    return Response.json(
      await generate({
        words,
        count,
        engine,
        creativity,
        length,
        position,
        readability: READABILITY.includes(body.readability) ? body.readability : "any",
        grammar: body.grammar !== false,
      }),
    );
  } catch (error) {
    if (error instanceof UnknownWordError) {
      return Response.json(
        { error: error.message, word: error.word, suggestions: error.suggestions },
        { status: 404 },
      );
    }
    throw error;
  }
}
