// api/getCuentasComments.js
const { getCuentasComments } = require('./_lib/sheets');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    let comments = [];
    try {
      comments = await getCuentasComments();
    } catch (sheetsErr) {
      console.warn('[getCuentasComments] Sheets no disponible (credenciales faltantes):', sheetsErr.message);
      // En local sin credenciales retorna vacío en vez de 500
      return res.status(200).json([]);
    }
    res.status(200).json(comments);
  } catch (e) {
    console.error('[api/getCuentasComments]', e.message);
    res.status(500).json({ error: e.message });
  }
};
