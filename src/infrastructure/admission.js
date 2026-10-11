export function createRateLimiter({ limit, windowMs }) {
  const buckets = new Map();
  return {
    take(key, now = Date.now()) {
      if (buckets.size > 5000) {
        for (const [name, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(name);
      }
      const current = buckets.get(key);
      if (!current || current.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, retryAfter: 0 };
      }
      if (current.count >= limit) {
        return { ok: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
      }
      current.count += 1;
      return { ok: true, retryAfter: 0 };
    }
  };
}

export function createAdmission(limit) {
  let active = 0;
  return {
    tryEnter() {
      if (active >= limit) return false;
      active += 1;
      return true;
    },
    leave() {
      if (active > 0) active -= 1;
    }
  };
}
