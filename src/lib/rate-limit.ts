type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;

export const checkRateLimit = (key: string) => {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  bucket.count += 1;

  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }

  return {
    allowed: bucket.count <= MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - bucket.count),
  };
};

export const clearRateLimit = (key: string) => {
  buckets.delete(key);
};
