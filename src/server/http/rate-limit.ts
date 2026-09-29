/**
 * Fixed-window in-memory rate limiter.
 * Good for a single instance; for horizontal scaling implement the same
 * interface on Redis (INCR + EXPIRE) and swap `store`.
 */
type Bucket = { count: number; resetAt: number };
const g = globalThis as unknown as { __rl?: Map<string, Bucket> };
const store = (g.__rl ??= new Map<string, Bucket>());

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let b = store.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    store.set(key, b);
  }
  b.count++;
  if (store.size > 50_000) {
    for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
  }
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt };
}

export function resetRateLimits() {
  store.clear();
}
