import { parseGenerateRequest, UnknownWordError } from "@/lib/engine";
import { generate } from "@/lib/generate";

export async function POST(request: Request) {
  const parsed = parseGenerateRequest(await request.json().catch(() => null));
  if ("error" in parsed) return Response.json(parsed, { status: 400 });
  try {
    return Response.json(await generate(parsed.request));
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
