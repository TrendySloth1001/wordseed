// Per-visitor rate limits for the API, a sliding window of one minute per IP
// address. Counts live in this server's memory: exact on a single server, and
// per instance on a host like Vercel, where several instances can run (enough
// to stop a runaway script; a host-level firewall rule is the global answer).

export type Limit = { requests: number; perMs: number };

const MINUTE = 60_000;

/** How many requests each kind of call allows per visitor, by cost. */
export const LIMITS = {
  /** writing sentences: the expensive one */
  generate: { requests: 20, perMs: MINUTE },
  /** the neural model is far slower, so it has its own, tighter budget too */
  neural: { requests: 6, perMs: MINUTE },
  /** recomputing one sentence's probabilities, sources and tags */
  explain: { requests: 60, perMs: MINUTE },
  /** saving a rating */
  rate: { requests: 60, perMs: MINUTE },
  /** quick lookups: word info, random words, passages, corpus statistics */
  lookup: { requests: 120, perMs: MINUTE },
  /** adding or removing text, which retrains the model */
  upload: { requests: 5, perMs: MINUTE },
  /** the corpus and model files saved for offline use (one save is about 20 files) */
  offline: { requests: 60, perMs: MINUTE },
} satisfies Record<string, Limit>;

export type LimitName = keyof typeof LIMITS;

// Timestamps of recent requests, per limit and visitor. Kept on globalThis so
// the dev server's module reloads do not reset everyone's counts.
const store = globalThis as typeof globalThis & { rateLimitHits?: Map<string, number[]> };
const hits = (store.rateLimitHits ??= new Map<string, number[]>());
let calls = 0;

/** The visitor's address, as reported by the host's proxy; "local" without one. */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

/**
 * Records one request and decides whether it may go ahead. Returns null when
 * it may, or a 429 response to send back when the visitor is over the limit.
 */
export function rateLimit(request: Request, name: LimitName, now = Date.now()): Response | null {
  const { requests, perMs } = LIMITS[name];
  const key = `${name}:${clientAddress(request)}`;
  const recent = (hits.get(key) ?? []).filter((time) => time > now - perMs);

  if (recent.length >= requests) {
    hits.set(key, recent);
    const retryAfter = Math.max(1, Math.ceil((recent[0] + perMs - now) / 1000));
    return Response.json(
      {
        error: `You're going a bit fast. Please wait ${retryAfter} second${retryAfter === 1 ? "" : "s"} and try again.`,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "RateLimit-Limit": String(requests),
          "RateLimit-Remaining": "0",
          "RateLimit-Reset": String(retryAfter),
        },
      },
    );
  }

  recent.push(now);
  hits.set(key, recent);
  // Now and then, forget visitors who have gone quiet, so memory stays small.
  if (++calls % 500 === 0) {
    for (const [other, times] of hits) {
      if (times.every((time) => time <= now - MINUTE * 10)) hits.delete(other);
    }
  }
  return null;
}

/** Forgets every count (for tests). */
export function resetRateLimits() {
  hits.clear();
}
