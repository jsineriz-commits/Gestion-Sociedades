// api/getDashboardData.js
const { getDashboardData } = require('./_lib/logic');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const email      = (req.query.email || '').trim();
    const selectedAC = (req.query.ac    || '').trim();
    const data = await getDashboardData(email, selectedAC || null);
    res.status(200).json(data);
  } catch (e) {
    console.error('[api/getDashboardData]', e);
    res.status(500).json({ error: e.message });
  }
};
