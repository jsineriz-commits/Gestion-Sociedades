// api/_lib/cache.js
// Cache en memoria - persiste entre invocaciones "calientes" de la misma instancia Vercel.
// En frío (cold start) se regenera. Para producción con alta carga, reemplazar con Upstash Redis.

const _store = new Map();
const CACHE_TTL_MS = 7200 * 1000; // 2 horas (igual que en Apps Script)

function cacheSet(key, data) {
  _store.set(key, {
    data,
    expires: Date.now() + CACHE_TTL_MS,
  });
}

function cacheGet(key) {
  const entry = _store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    _store.delete(key);
    return null;
  }
  return entry.data;
}

function cacheInvalidate() {
  _store.clear();
}

module.exports = { cacheSet, cacheGet, cacheInvalidate };
