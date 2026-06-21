export function createDedupeStore(ttlMs) {
  const entries = new Map();

  return {
    rememberIfNew(key, now = Date.now()) {
      prune(now);
      if (entries.has(key)) return false;
      entries.set(key, now);
      return true;
    },
    prune,
    size() {
      prune(Date.now());
      return entries.size;
    }
  };

  function prune(now) {
    for (const [key, ts] of entries.entries()) {
      if ((now - ts) > ttlMs) {
        entries.delete(key);
      }
    }
  }
}
