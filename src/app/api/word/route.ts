import { getModel } from "@/lib/corpus";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, "lookup");
  if (limited) return limited;
  const word = new URL(request.url).searchParams.get("word")?.trim() ?? "";
  const profile = word ? (await getModel()).profile(word) : null;
  if (!profile) return Response.json({ error: `"${word}" is not in the corpus.` }, { status: 404 });
  return Response.json(profile);
}
