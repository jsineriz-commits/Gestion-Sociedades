// api/getDeptoGeoJSON.js
const { getDeptoGeoJSON } = require('./_lib/logic');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const geojson = await getDeptoGeoJSON();
    res.status(200).json(geojson);
  } catch (e) {
    console.error('[api/getDeptoGeoJSON]', e);
    res.status(500).json({ error: e.message });
  }
};
