import { getModel } from "@/lib/corpus";
import { rateLimit } from "@/lib/rate-limit";

/** A handful of random words for the "Try" suggestions. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "lookup");
  if (limited) return limited;
  const count = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get("count")) || 40));
  return Response.json((await getModel()).randomWords(count));
}
