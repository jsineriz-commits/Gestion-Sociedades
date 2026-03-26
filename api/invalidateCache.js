// api/invalidateCache.js
const { cacheInvalidate } = require('./_lib/cache');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    cacheInvalidate();
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[api/invalidateCache]', e);
    res.status(500).json({ error: e.message });
  }
};
