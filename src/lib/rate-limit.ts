type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;

/**
 * `max` lets a caller pick its own budget (e.g. a 6-digit code wants a more
 * forgiving allowance than a password guess).
 */
export const checkRateLimit = (key: string, max = MAX_ATTEMPTS) => {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: max - 1 };
  }

  bucket.count += 1;

  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }

  return {
    allowed: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
  };
};

/** Reads the budget without spending it, so a correct answer is never locked out. */
export const peekRateLimit = (key: string, max = MAX_ATTEMPTS) => {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= Date.now()) {
    return { allowed: true, remaining: max };
  }
  return {
    allowed: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
  };
};

export const clearRateLimit = (key: string) => {
  buckets.delete(key);
};
