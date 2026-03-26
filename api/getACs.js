// api/getACs.js
const { getACs } = require('./_lib/logic');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const acs = await getACs();
    res.status(200).json(acs);
  } catch (e) {
    console.error('[api/getACs]', e);
    res.status(500).json({ error: e.message });
  }
};
