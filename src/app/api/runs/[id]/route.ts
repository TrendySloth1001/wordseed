import { deleteRun, getRun } from "@/lib/runs";
import { rateLimit } from "@/lib/rate-limit";

const missing = () => Response.json({ error: "That run no longer exists." }, { status: 404 });

export async function GET(request: Request, context: RouteContext<"/api/runs/[id]">) {
  const limited = rateLimit(request, "lookup");
  if (limited) return limited;
  const { id } = await context.params;
  const run = await getRun(id);
  return run ? Response.json(run) : missing();
}

export async function DELETE(request: Request, context: RouteContext<"/api/runs/[id]">) {
  const limited = rateLimit(request, "rate");
  if (limited) return limited;
  const { id } = await context.params;
  return (await deleteRun(id)) ? Response.json({ deleted: id }) : missing();
}
