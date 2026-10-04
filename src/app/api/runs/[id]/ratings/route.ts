import { rateSentence } from "@/lib/runs";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, context: RouteContext<"/api/runs/[id]/ratings">) {
  const limited = rateLimit(request, "rate");
  if (limited) return limited;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const index = Number(body?.index);
  const rating = Number(body?.rating);
  if (!Number.isInteger(index) || ![1, -1, 0].includes(rating)) {
    return Response.json({ error: "Send a sentence index and a rating of 1, -1 or 0." }, { status: 400 });
  }
  const run = await rateSentence(id, index, rating as 1 | -1 | 0);
  if (!run) return Response.json({ error: "That sentence no longer exists." }, { status: 404 });
  return Response.json({ ratings: run.ratings });
}
