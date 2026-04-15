// api/addCuentaComment.js
const { addCuentaComment } = require('./_lib/sheets');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { cuit, comentario } = req.body || {};
    if (!cuit || !comentario) return res.status(400).json({ error: 'Faltan campos: cuit y comentario son requeridos' });
    const result = await addCuentaComment(cuit, comentario);
    res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('[api/addCuentaComment]', e.message);
    res.status(500).json({ error: e.message });
  }
};
