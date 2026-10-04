import { rateLimit } from "@/lib/rate-limit";
import { explainSentence } from "@/lib/runs";

export async function GET(
  request: Request,
  context: RouteContext<"/api/runs/[id]/sentences/[index]">,
) {
  const limited = rateLimit(request, "explain");
  if (limited) return limited;
  const { id, index } = await context.params;
  const detail = await explainSentence(id, Number(index));
  if (!detail) return Response.json({ error: "That sentence no longer exists." }, { status: 404 });
  return Response.json(detail);
}
