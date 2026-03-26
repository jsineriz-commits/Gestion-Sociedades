// api/getTerritoryData.js
const { getTerritoryData } = require('./_lib/logic');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const ac   = (req.query.ac || '').trim();
    const data = await getTerritoryData(ac);
    res.status(200).json(data);
  } catch (e) {
    console.error('[api/getTerritoryData]', e);
    res.status(500).json({ error: e.message });
  }
};
