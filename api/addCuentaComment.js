// api/addCuentaComment.js
const { addCuentaComment } = require('./_lib/sheets');

// Fallback en memoria para testing local sin credenciales Google
const LOCAL_COMMENTS = [];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { cuit, comentario } = req.body || {};
    if (!cuit || !comentario) return res.status(400).json({ error: 'Faltan campos: cuit y comentario son requeridos' });

    try {
      // Intentar guardar en Sheets (funciona en Vercel con credenciales)
      const result = await addCuentaComment(cuit, comentario);
      return res.status(200).json({ ok: true, ...result });
    } catch (sheetsErr) {
      // Fallback local: guardar en memoria (solo para testing)
      console.warn('[addCuentaComment] Sheets no disponible, usando memoria local:', sheetsErr.message);
      const now = new Date();
      const fechaStr = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const entry = { cuit: String(cuit).trim(), fecha: fechaStr, comentario: String(comentario).trim() };
      LOCAL_COMMENTS.push(entry);
      console.log(`[LOCAL] Comentario guardado en memoria: CUIT ${cuit} | ${fechaStr}`);
      return res.status(200).json({ ok: true, localOnly: true, ...entry });
    }
  } catch (e) {
    console.error('[api/addCuentaComment]', e.message);
    res.status(500).json({ error: e.message });
  }
};

// Exportar para que getCuentasComments pueda fusionar comentarios locales
module.exports.LOCAL_COMMENTS = LOCAL_COMMENTS;
