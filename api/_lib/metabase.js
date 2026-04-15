// api/_lib/metabase.js
const MB_URL = process.env.METABASE_BASE_URL || 'https://metabase.dcac.ar';
const API_KEY = process.env.METABASE_API_KEY || process.env.METABASE_PASSWORD || 'mb_OB8cA0XB9CFF8hy4eQFGGDtClBlqtkBIaz2I70Ry0tI=';

let mbCache = {};

// Lee la response completa usando Web Streams API para soportar payloads grandes (>50MB)
async function readResponseStream(response) {
  const reader = response.body.getReader();
  const chunks = [];
  let totalLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }
  // Concatenar todos los Uint8Arrays en uno solo
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8').decode(merged);
}

async function fetchMetabaseQuery(cardId, retries = 2) {
  const cacheKey = `mb_${cardId}`;
  const now = Date.now();
  if (mbCache[cacheKey] && now - mbCache[cacheKey].timestamp < 2 * 60 * 60 * 1000) {
    return mbCache[cacheKey].data;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000); // 55s timeout

      const res = await fetch(`${MB_URL}/api/card/${cardId}/query/json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const txt = await res.text();
        console.error(`Error fetching Metabase query ${cardId} (HTTP ${res.status}):`, txt.slice(0, 200));
        throw new Error(`HTTP ${res.status} en Metabase query ${cardId}`);
      }

      // Leer con streaming para soportar payloads grandes (Q188 ~147MB)
      const rawText = await readResponseStream(res);
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.error(`[Metabase] JSON truncado en query ${cardId}, intento ${attempt + 1}/${retries + 1}. Bytes recibidos: ${rawText.length}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw new Error(`JSON truncado en Metabase query ${cardId} tras ${retries + 1} intentos`);
      }

      mbCache[cacheKey] = { timestamp: now, data };
      return data;

    } catch (err) {
      if (err.name === 'AbortError') {
        console.error(`[Metabase] Timeout en query ${cardId}, intento ${attempt + 1}`);
      } else if (attempt >= retries) {
        throw err;
      } else {
        console.error(`[Metabase] Error en query ${cardId}, reintentando (${attempt + 1}/${retries}):`, err.message);
      }
      if (attempt < retries) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      else throw err;
    }
  }
}

// Transform mapping de departamentos Senasa/Prov a formato esperado por Frontend
function normDepto(s) {
  if (!s) return '';
  return String(s).toUpperCase()
    .replace(/Ã'/g, 'N').replace(/PEA/g, 'PENA').replace(/AUELAS/g, 'ANUELAS')
    .replace(/[\u00e0-\u00e5\u00c0-\u00c5]/g, 'A')
    .replace(/[\u00e8-\u00eb\u00c8-\u00cb]/g, 'E')
    .replace(/[\u00ec-\u00ef\u00cc-\u00cf]/g, 'I')
    .replace(/[\u00f2-\u00f6\u00d2-\u00d6]/g, 'O')
    .replace(/[\u00f9-\u00fc\u00d9-\u00dc]/g, 'U')
    .replace(/[^A-Z0-9 ]/g, '')
    .trim();
}

// Mapeo de códigos de provincia de Metabase → códigos del frontend (GeoJSON)
const PROV_CODE_MAP = {
  'BUE': 'BA',   // Buenos Aires
  'ERI': 'ER',   // Entre Ríos
  'MIS': 'MIS',  // Misiones (igual)
  'COR': 'COR',  // Corrientes (igual)
  'SDE': 'SDE',  // Santiago del Estero (igual)
  'CBA': 'CBA',  // Córdoba (igual)
  'SFE': 'SFE',  // Santa Fe (igual)
  'CHA': 'CHA',  // Chaco (igual)
  'FOR': 'FOR',  // Formosa (igual)
  'LPA': 'LPA',  // La Pampa (igual)
  'SAL': 'SAL',  // Salta (igual)
  'JUJ': 'JUJ',  // Jujuy (igual)
  'TUC': 'TUC',  // Tucumán (igual)
  'CAT': 'CAT',  // Catamarca (igual)
  'MZA': 'MZA',  // Mendoza (igual)
  'SLU': 'SLU',  // San Luis (igual)
  'SJU': 'SJU',  // San Juan (igual)
  'CABA': 'CABA',// Ciudad Autónoma de Buenos Aires
  'NQN': 'NQN',  // Neuquén
  'RN': 'RN',    // Río Negro
  'CHU': 'CHU',  // Chubut
  'TDF': 'TDF',  // Tierra del Fuego
  'LRJ': 'LRJ',  // La Rioja
};

async function processMetabaseMapData(acName, isAdmin) {
  // Traer secuencialmente para evitar race conditions en respuestas grandes
  const q188 = await fetchMetabaseQuery(188);
  const q189 = await fetchMetabaseQuery(189);
  const q190 = await fetchMetabaseQuery(190);

  // Construir mapa de usuarios (ac)
  const cuitToAcInfo = {};
  for (const r of q190) {
    const cuit = String(r.cuit_sociedad || '').trim();
    if (cuit) {
      if (!cuitToAcInfo[cuit]) cuitToAcInfo[cuit] = [];
      const nombreAc = `${r.nombre || ''} ${r.apellido || ''}`.trim();
      cuitToAcInfo[cuit].push(nombreAc || 'Sin Nombre');
    }
  }

  // Mapear q189 extra
  const q189Map = {};
  for (const r of q189) {
    const c = String(r.cuit_sociedad || r.CUIT || '').trim();
    if (c) q189Map[c] = r;
  }

  const acSocieties = [];
  const acByDepto = {};
  const allByDepto = {};
  const liveDeptoAcMap = {};
  const acAdmByDepto = {};
  let totalSoc = 0;

  for (const row of q188) {
    const cuit = String(row.cuit || '').trim();
    if (!cuit) continue;

    const deptoRaw = row.partido_registro_dcac || row.partido_establecimiento_senasa || '';
    const provRaw = row.prov_registro_dcac || row.prov_establecimiento_senasa || '';
    const deptoClean = normDepto(deptoRaw);
    if (!deptoClean) continue;

    // Traducir código de provincia de Metabase al código que usa el frontend (ej: BUE → BA)
    const provCode = PROV_CODE_MAP[String(provRaw).toUpperCase()] || String(provRaw).toUpperCase();
    const deptoKey = deptoClean + (provCode ? '|' + provCode : '');
    
    // Obtener ACs
    const myAcs = cuitToAcInfo[cuit] || [];
    const mainAc = myAcs.length > 0 ? myAcs[0] : 'SIN ASIGNAR';

    const belongsToAc = isAdmin || myAcs.some(a => a.toLowerCase().includes(acName.toLowerCase()));

    // Construir métricas deptos global
    if (!allByDepto[deptoKey]) {
      allByDepto[deptoKey] = { soc: 0, qtotal: 0, qvaca: 0, qoperada: 0, admTotal: 0, admAct: 0 };
    }
    const qv = parseFloat(row.total_vacas) || 0;
    const qt = parseFloat(row.total_bovinos) || 0;
    const oper = parseFloat(row.cabezas_operadas_dcac) || 0;

    allByDepto[deptoKey].soc++;
    allByDepto[deptoKey].qtotal += qt;
    allByDepto[deptoKey].qvaca += qv;
    allByDepto[deptoKey].qoperada += oper;
    
    if (row.existe_en_dcac === 'SI') {
      allByDepto[deptoKey].admTotal++;
      if (q189Map[cuit] && q189Map[cuit].Ult_act) allByDepto[deptoKey].admAct++;
    }

    // Guardar live maps
    if (!liveDeptoAcMap[deptoKey]) liveDeptoAcMap[deptoKey] = {};
    liveDeptoAcMap[deptoKey][mainAc] = (liveDeptoAcMap[deptoKey][mainAc] || 0) + 1;

    // Si pertenece al AC seleccionado
    if (belongsToAc) {
      acSocieties.push({
        nombre: row.razon_social || row.razon_social_senasa,
        cuit: cuit,
        depto: deptoClean,
        prov: provRaw,
        qtotal: qt,
        qvaca: qv,
        inBc: true,
        inAdm: row.existe_en_dcac === 'SI'
      });

      if (!acByDepto[deptoKey]) acByDepto[deptoKey] = { soc: 0, qtotal: 0, qvaca: 0 };
      acByDepto[deptoKey].soc++;
      acByDepto[deptoKey].qtotal += qt;
      acByDepto[deptoKey].qvaca += qv;

      if (!acAdmByDepto[deptoKey]) acAdmByDepto[deptoKey] = { soc: 0 };
      if (row.existe_en_dcac === 'SI') acAdmByDepto[deptoKey].soc++;
    }
    
    totalSoc++;
  }

  return {
    acSocieties,
    acByDepto,
    allByDepto,
    totalBcNueva: { soc: totalSoc },
    vennStats: { totBc: totalSoc, totCrm: 0, totAdm: 0, onlyBc: 0, onlyCrm: 0, onlyAdm: 0, bcAdm: 0, bcCrm: 0, crmAdm: 0, all3: 0 },
    acLeadsRaw: [], // Pendiente de migrar logic para tabla de zona específica inferior
    deptoAcMap: liveDeptoAcMap,
    acAdmByDepto,
    regionMap: {},
    deptoToRegion: {}
  };
}

module.exports = {
  fetchMetabaseQuery,
  processMetabaseMapData
};
