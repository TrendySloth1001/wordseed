import { parseGenerateRequest, UnknownWordError } from "@/lib/engine";
import { READ_ONLY } from "@/lib/deployment";
import { generate } from "@/lib/generate";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimit(request, "generate");
  if (limited) return limited;
  const parsed = parseGenerateRequest(await request.json().catch(() => null));
  if ("error" in parsed) return Response.json(parsed, { status: 400 });
  if (parsed.request.engine === "neural") {
    const slow = rateLimit(request, "neural");
    if (slow) return slow;
  }
  try {
    const { run, traces } = await generate(parsed.request);
    // Without server storage the browser keeps the run, so it also needs the
    // traces that explaining a sentence later depends on.
    return Response.json(READ_ONLY ? { ...run, traces } : run);
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
