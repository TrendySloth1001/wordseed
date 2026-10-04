import { readSource } from "@/lib/corpus";
import { findPassage, paragraphs } from "@/lib/source-reader";
import { rateLimit } from "@/lib/rate-limit";

/** The paragraph of a source in which a phrase first occurs. */
export async function GET(request: Request, context: RouteContext<"/api/sources/[name]">) {
  const limited = rateLimit(request, "lookup");
  if (limited) return limited;
  const { name } = await context.params;
  const find = new URL(request.url).searchParams.get("find")?.slice(0, 300) ?? "";
  const text = await readSource(decodeURIComponent(name));
  if (text === null) return Response.json({ error: "No such source." }, { status: 404 });

  const blocks = paragraphs(text);
  const passage = findPassage(blocks, find);
  if (!passage) return Response.json({ error: "That wording was not found." }, { status: 404 });
  return Response.json({ ...passage, text: blocks[passage.paragraph] });
}
