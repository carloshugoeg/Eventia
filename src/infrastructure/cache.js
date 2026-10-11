export function createTtlCache(ttlMs) {
  if (!ttlMs) return { get() {}, set() {}, clear() {} };
  const entries = new Map();
  return {
    get(key, now = Date.now()) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expires <= now) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value, now = Date.now()) {
      entries.set(key, { value, expires: now + ttlMs });
    },
    clear() {
      entries.clear();
    }
  };
}
