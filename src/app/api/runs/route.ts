import { listRuns } from "@/lib/runs";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, "lookup");
  if (limited) return limited;
  return Response.json(await listRuns());
}
