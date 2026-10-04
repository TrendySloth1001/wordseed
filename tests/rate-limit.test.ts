import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { clientAddress, LIMITS, rateLimit, resetRateLimits } from "../src/lib/rate-limit";

const from = (address: string) => new Request("http://test/api/word", { headers: { "x-forwarded-for": address } });

beforeEach(() => resetRateLimits());

test("allows requests up to the limit, then answers 429 with Retry-After", async () => {
  const { requests } = LIMITS.upload;
  const now = 1_000_000;
  for (let i = 0; i < requests; i++) assert.equal(rateLimit(from("1.1.1.1"), "upload", now + i), null);
  const blocked = rateLimit(from("1.1.1.1"), "upload", now + requests);
  assert.ok(blocked);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("Retry-After"), "60");
  assert.match((await blocked.json()).error, /going a bit fast/);
});

test("counts each visitor and each kind of call separately", () => {
  const now = 2_000_000;
  for (let i = 0; i < LIMITS.upload.requests; i++) rateLimit(from("1.1.1.1"), "upload", now);
  assert.ok(rateLimit(from("1.1.1.1"), "upload", now));
  assert.equal(rateLimit(from("2.2.2.2"), "upload", now), null);
  assert.equal(rateLimit(from("1.1.1.1"), "lookup", now), null);
});

test("the window slides: old requests stop counting after a minute", () => {
  const now = 3_000_000;
  for (let i = 0; i < LIMITS.upload.requests; i++) rateLimit(from("1.1.1.1"), "upload", now);
  assert.ok(rateLimit(from("1.1.1.1"), "upload", now + 59_000));
  assert.equal(rateLimit(from("1.1.1.1"), "upload", now + 60_001), null);
});

test("reads the first forwarded address", () => {
  assert.equal(clientAddress(from("9.9.9.9, 10.0.0.1")), "9.9.9.9");
  assert.equal(clientAddress(new Request("http://test/")), "local");
});
