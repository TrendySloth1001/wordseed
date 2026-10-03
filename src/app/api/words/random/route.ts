import { getModel } from "@/lib/corpus";

/** A handful of random words for the "Try" suggestions. */
export async function GET(request: Request) {
  const count = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get("count")) || 40));
  return Response.json((await getModel()).randomWords(count));
}
