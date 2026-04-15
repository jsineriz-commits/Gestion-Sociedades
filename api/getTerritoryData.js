// api/getTerritoryData.js
const { getTerritoryData } = require('./_lib/logic');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const ac   = (req.query.ac || '').trim();
    const data = await getTerritoryData(ac);
    
    // Limitar acSocieties en la vista global para no serializar 200k filas al browser.
    // El mapa usa allByDepto (agregado por depto), no las filas individuales.
    // acSocieties solo se usa para la tabla de sociedades del AC, que tiene sentido con un AC seleccionado.
    if (!ac || ac === '* TODOS *') {
      data.acSocieties = data.acSocieties.slice(0, 500);
    }
    
    res.status(200).json(data);
  } catch (e) {
    console.error('[api/getTerritoryData]', e);
    res.status(500).json({ error: e.message });
  }
};
