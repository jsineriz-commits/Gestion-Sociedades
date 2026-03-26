// api/_lib/logic.js
// Lógica de negocio completa. Equivalente a Code.gs pero en Node.js async/await.

const { getSheetData, serialToDate, g } = require('./sheets');
const { cacheSet, cacheGet } = require('./cache');

// ─── Normalización de departamentos ────────────────────────────────────────────

const DEPTO_ALIASES = {
  '9 DE JULIO': 'NUEVE DE JULIO',
  '25 DE MAYO': 'VEINTICINCO DE MAYO',
  '12 DE OCTUBRE': 'DOCE DE OCTUBRE',
  '2 DE ABRIL': 'DOS DE ABRIL',
  '1 DE MAYO': 'PRIMERO DE MAYO',
  'BRANSEN': 'BRANDSEN',
  'CORONEL BRANDSEN': 'BRANDSEN',
  'CHICALCO': 'CHICAL CO',
  'MBUCURUYA': 'MBURUCUYA',
  'MAYOR LUIS JFONTANA': 'MAYOR LUIS J. FONTANA',
  'MAYOR LUIS J FONTANA': 'MAYOR LUIS J. FONTANA',
  'LEANDRO N ALEM': 'LEANDRO N. ALEM',
  'GENERAL MADARIAGA': 'GENERAL JUAN MADARIAGA',
  'GENERAL LAMADRID': 'GENERAL LA MADRID',
  'CORONEL ROSALES': 'CORONEL DE MARINA LEONARDO ROSALES',
  'CORONEL DE MARINA L ROSALES': 'CORONEL DE MARINA LEONARDO ROSALES',
  'AMEGHINO': 'FLORENTINO AMEGHINO',
  'GONZALES CHAVES': 'ADOLFO GONZALES CHAVES',
  'GONZALEZ CHAVES': 'ADOLFO GONZALEZ CHAVES',
  'PRESIDENTE ROQUE SAENZ PEA': 'PRESIDENTE ROQUE SAENZ PENA',
  'PRESIDENTE ROQUE SAENZ PENA': 'PRESIDENTE ROQUE SAENZ PENA',
  'CAUELAS': 'CANUELAS',
  'CANUELAS': 'CANUELAS',
  'LA BANDA': 'BANDA',
  'BANDA': 'BANDA',
  'EL TIGRE': 'TIGRE',
};

function normSrv(s) {
  if (!s) return '';
  let str = String(s).toUpperCase()
    .replace(/Ã'/g, 'N')
    .replace(/PEA/g, 'PENA')
    .replace(/AUELAS/g, 'ANUELAS')
    .replace(/LA BANDA/g, 'BANDA')
    .replace(/[\u00e0-\u00e5\u00e2\u00e4]/g, 'A')
    .replace(/[\u00e8-\u00eb]/g, 'E')
    .replace(/[\u00ec-\u00ef]/g, 'I')
    .replace(/[\u00f2-\u00f6]/g, 'O')
    .replace(/[\u00f9-\u00fc]/g, 'U')
    .replace(/[\u00c0-\u00c5\u00c2\u00c4]/g, 'A')
    .replace(/[\u00c8-\u00cb]/g, 'E')
    .replace(/[\u00cc-\u00cf]/g, 'I')
    .replace(/[\u00d2-\u00d6]/g, 'O')
    .replace(/[\u00d9-\u00dc]/g, 'U')
    .replace(/[^A-Z0-9 ]/g, '')
    .trim();
  return DEPTO_ALIASES[str] || str;
}

// ─── getACs ────────────────────────────────────────────────────────────────────

async function getACs() {
  const data = await getSheetData('aux');
  const acSet = new Set();
  for (let i = 1; i < data.length; i++) {
    const nombre = String(g(data[i], 14)).trim();
    if (nombre) acSet.add(nombre);
  }
  return Array.from(acSet).sort();
}

// ─── buildGlobalMaps (con caché 2h) ───────────────────────────────────────────
// Construye mapas globales que NO dependen del AC seleccionado.
// Equivale a la función buildGlobalMaps() del .gs original.

async function buildGlobalMaps() {
  const cached = cacheGet('global');
  if (cached) return cached;

  console.log('[logic] buildGlobalMaps: cache miss, leyendo Sheets...');

  // ── 1. AUX ──────────────────────────────────────────────────────────────────
  const emailToNameMap = {};
  const acIdToNameMap = {};
  const dAux = await getSheetData('aux');
  for (let i = 1; i < dAux.length; i++) {
    const row = dAux[i];
    const acEmail = String(g(row, 20)).trim().toLowerCase();
    const acNm    = String(g(row, 14)).trim();
    const acId    = String(g(row, 0)).trim();
    if (acEmail && acNm) emailToNameMap[acEmail] = acNm;
    if (acId    && acNm) acIdToNameMap[acId]     = acNm;
  }

  const cleanNm = (val, id) => {
    const raw = String(val || '').trim();
    if (raw === '' || raw === '0' || raw === '-' || (raw !== '' && !isNaN(raw))) {
      return (id && acIdToNameMap[id]) ? acIdToNameMap[id] : 'SIN ASIGNAR';
    }
    return raw;
  };

  // ── 2. DATOS_METABASE ────────────────────────────────────────────────────────
  const admGlobalMap = {};
  const dAdm = await getSheetData('Datos_Metabase');
  for (let i = 1; i < dAdm.length; i++) {
    const row   = dAdm[i];
    const cuit  = String(g(row, 1)).trim();
    const colC  = String(g(row, 2)).trim();  // Nombre sociedad
    const colF  = String(g(row, 5)).trim();  // AC Nombre
    const acIdDm = String(g(row, 3)).trim(); // AC ID
    const colAG = g(row, 32);               // Última actividad (serial)
    if (!cuit) continue;

    let actDate = null;
    const dateObj = serialToDate(colAG);
    if (dateObj)                          actDate = dateObj.getTime();
    else if (String(colAG).trim() !== '') actDate = 1;

    const acNomFinal = cleanNm(colF, acIdDm);
    if (!admGlobalMap[cuit]) {
      admGlobalMap[cuit] = { actDate: null, nom: colC, acNom: acNomFinal };
    }
    if (actDate && (!admGlobalMap[cuit].actDate || admGlobalMap[cuit].actDate < actDate)) {
      admGlobalMap[cuit].actDate = actDate;
      if (colC) admGlobalMap[cuit].nom = colC;
    }
  }

  // ── 2.5 LEADS: cuitToDeptoMap ────────────────────────────────────────────────
  const cuitToDeptoMap = {};
  const dLeads = await getSheetData('Leads');
  for (let i = 1; i < dLeads.length; i++) {
    const row   = dLeads[i];
    const lCuit  = String(g(row, 11)).trim();
    const lDepto = normSrv(g(row, 16));
    const lProv  = String(g(row, 15)).trim().toUpperCase();
    if (lCuit && lDepto) {
      cuitToDeptoMap[lCuit] = lDepto + (lProv ? '|' + lProv : '');
    }
  }

  // ── 3. COMENTARIOS ──────────────────────────────────────────────────────────
  const commentsSet = {};
  const dCom = await getSheetData('Comentarios');
  for (let i = 1; i < dCom.length; i++) {
    const row   = dCom[i];
    const idA   = String(g(row, 0)).trim();
    const idB   = String(g(row, 1)).trim();
    const txtCom = String(g(row, 5) || '').trim() || 'Comentario registrado';
    if (idA.length > 2) commentsSet[idA] = txtCom;
    if (idB.length > 2) commentsSet[idB] = txtCom;
  }

  // ── 4. BC NUEVA ─────────────────────────────────────────────────────────────
  const allByDepto = {};
  const deptoAcMap = {};
  const bcRaw      = [];
  const dBc = await getSheetData('BC Nueva');

  for (let i = 1; i < dBc.length; i++) {
    const row       = dBc[i];
    const cuitSoc   = String(g(row, 1)).trim();
    const qtotal    = parseFloat(g(row, 2)) || 0;
    const qvaca     = parseFloat(g(row, 3)) || 0;
    let   depto     = normSrv(g(row, 23));
    let   provCode  = String(g(row, 22)).trim().toUpperCase();
    const acIdVal   = String(g(row, 14)).trim();
    const acNombre  = String(g(row, 15)).trim();
    const nombreSoc = String(g(row, 0)).trim();

    if (!depto) continue;
    if (provCode === 'MDZ') provCode = 'MZA';
    if (depto === 'TIGRE' && provCode !== 'BA') provCode = 'BA';
    const deptoKey = depto + (provCode ? '|' + provCode : '');

    cuitToDeptoMap[cuitSoc] = deptoKey; // BC tiene prioridad sobre Leads para ubicación

    if (!allByDepto[deptoKey]) {
      allByDepto[deptoKey] = { soc: 0, qtotal: 0, qvaca: 0, qoperada: 0, admTotal: 0, admAct: 0 };
    }
    allByDepto[deptoKey].soc++;
    allByDepto[deptoKey].qtotal += qtotal;
    allByDepto[deptoKey].qvaca  += qvaca;

    if (admGlobalMap[cuitSoc]) {
      allByDepto[deptoKey].admTotal++;
      if (admGlobalMap[cuitSoc].actDate) allByDepto[deptoKey].admAct++;
    }

    bcRaw.push({ c: cuitSoc, n: nombreSoc, d: deptoKey, qt: qtotal, qv: qvaca, a: acIdVal, an: acNombre });
  }

  // ── 4.5 deptoAcMap + completar admStats para cuits que no están en BC ────────
  const bcCuitSet = new Set(bcRaw.map(r => r.c));

  for (const c in admGlobalMap) {
    const depK = cuitToDeptoMap[c] || 'SIN UBICACION';
    const acN  = admGlobalMap[c].acNom || 'SIN ASIGNAR';

    if (!deptoAcMap[depK]) deptoAcMap[depK] = {};
    deptoAcMap[depK][acN] = (deptoAcMap[depK][acN] || 0) + 1;

    if (!allByDepto[depK]) {
      allByDepto[depK] = { soc: 0, qtotal: 0, qvaca: 0, qoperada: 0, admTotal: 0, admAct: 0 };
    }
    // Solo contar en admTotal si NO está en BC (los que están ya se contaron arriba)
    if (!bcCuitSet.has(c)) {
      allByDepto[depK].admTotal++;
      if (admGlobalMap[c].actDate) allByDepto[depK].admAct++;
    }
  }

  // ── 5. OPS: enriquecer qoperada ─────────────────────────────────────────────
  const dOps = await getSheetData('OPS');
  for (let i = 1; i < dOps.length; i++) {
    const row = dOps[i];
    const q   = parseFloat(g(row, 9))  || 0;
    const dep = normSrv(g(row, 19));
    if (!dep) continue;
    for (const key in allByDepto) {
      if (key.split('|')[0] === dep) allByDepto[key].qoperada += q;
    }
  }

  const result = { emailToNameMap, acIdToNameMap, admGlobalMap, commentsSet, allByDepto, deptoAcMap, bcRaw };
  cacheSet('global', result);
  console.log('[logic] buildGlobalMaps: completado y cacheado.');
  return result;
}

// ─── getTerritoryData ──────────────────────────────────────────────────────────
// Equivale a getTerritoryData() del .gs original.
// Datos territoriales: lee Leads en vivo, todo lo demás del caché.

async function getTerritoryData(acName) {
  const isAdmin = (!acName || acName === '* TODOS *');

  const gMaps = await buildGlobalMaps();
  const { emailToNameMap, acIdToNameMap, admGlobalMap, commentsSet, allByDepto, bcRaw } = gMaps;

  // ── Leer LEADS en vivo ────────────────────────────────────────────────────────
  const dLeads = await getSheetData('Leads');
  const crmSet        = {};
  const cuitToEmailMap = {};
  const acLeadsRaw    = [];

  // Pasada 1: crmSet + cuitToEmailMap
  for (let i = 1; i < dLeads.length; i++) {
    const row   = dLeads[i];
    const cuit  = String(g(row, 11)).trim();
    const email = String(g(row, 2)).trim().toLowerCase();
    if (cuit && email) {
      cuitToEmailMap[cuit] = email;
      const leadNm = emailToNameMap[email] || '';
      if (isAdmin || leadNm === acName) crmSet[cuit] = true;
    }
  }

  // Pasada 2: acLeadsRaw (detalle para el panel de zona)
  for (let i = 1; i < dLeads.length; i++) {
    const row        = dLeads[i];
    const lId        = String(g(row, 0)).trim();
    const fAsig      = serialToDate(g(row, 1));
    const lEmail     = String(g(row, 2)).trim().toLowerCase();
    const lCuit      = String(g(row, 11)).trim();
    const lProv      = String(g(row, 15)).trim().toUpperCase();
    const lDepto     = normSrv(g(row, 16));

    if (!fAsig || !lEmail) continue;

    const lDeptoKey  = (lDepto || 'SIN UBICACION') + (lProv ? '|' + lProv : '');
    const lAcNom     = emailToNameMap[lEmail] || '';
    const lNombreSoc = String(g(row, 12)).trim() || String(g(row, 10)).trim();
    const cTxt       = commentsSet[lId] || null;
    const aObj       = admGlobalMap[lCuit] || { actDate: 0, nom: '' };
    const aDate      = aObj.actDate || 0;

    acLeadsRaw.push({
      ac:     lAcNom,
      nom:    lNombreSoc,
      nomMet: aObj.nom || '',
      cuit:   lCuit,
      dep:    lDeptoKey,
      ts:     fAsig.getTime(),
      cTxt,
      pTs:    (aDate > fAsig.getTime()) ? aDate : null,
    });
  }

  // ── admSet ────────────────────────────────────────────────────────────────────
  const admSet = {};
  for (const c in admGlobalMap) {
    const acNomMeta = admGlobalMap[c].acNom || '';
    if (acNomMeta && (isAdmin || acNomMeta === acName)) admSet[c] = true;
  }

  // ── acSocieties, acByDepto, liveDeptoAcMap, acAdmByDepto ────────────────────
  const acSocieties   = [];
  const acByDepto     = {};
  const liveDeptoAcMap = {};
  const acAdmByDepto  = {};
  const bcSet         = {};

  // Mapa rápido CUIT → fila BC
  const bcCuitMap = {};
  for (const r of bcRaw) {
    if (r.c) bcCuitMap[r.c] = r;
    if (!liveDeptoAcMap[r.d]) liveDeptoAcMap[r.d] = {};
    const rAcNom = emailToNameMap[cuitToEmailMap[r.c]] || r.an || acIdToNameMap[r.a] || r.a || 'SIN ASIGNAR';
    liveDeptoAcMap[r.d][rAcNom] = (liveDeptoAcMap[r.d][rAcNom] || 0) + 1;
  }

  for (const cuit in admSet) {
    if (!cuit) continue;
    const rowBc  = bcCuitMap[cuit];
    const metaObj = admGlobalMap[cuit] || { nom: 'Sociedad sin nombre' };

    const soc = {
      nombre: metaObj.nom || (rowBc ? rowBc.n : 'Sin nombre (Cuit: ' + cuit + ')'),
      cuit,
      depto:  rowBc ? rowBc.d.split('|')[0]      : '-',
      prov:   rowBc ? (rowBc.d.split('|')[1] || '') : '',
      qtotal: rowBc ? rowBc.qt : 0,
      qvaca:  rowBc ? rowBc.qv : 0,
      inBc:   !!rowBc,
      inAdm:  true,
    };
    acSocieties.push(soc);

    if (rowBc) {
      bcSet[cuit] = true;
      const dKey = rowBc.d;
      if (!acByDepto[dKey])    acByDepto[dKey]    = { soc: 0, qtotal: 0, qvaca: 0 };
      if (!acAdmByDepto[dKey]) acAdmByDepto[dKey] = { soc: 0 };
      acByDepto[dKey].soc++;
      acByDepto[dKey].qtotal += rowBc.qt;
      acByDepto[dKey].qvaca  += rowBc.qv;
      acAdmByDepto[dKey].soc++;
    }
  }

  // ── Venn ──────────────────────────────────────────────────────────────────────
  const stats = { onlyBc: 0, onlyCrm: 0, onlyAdm: 0, bcAdm: 0, bcCrm: 0, crmAdm: 0, all3: 0, totBc: 0, totCrm: 0, totAdm: 0 };
  const allCuits = {};
  for (const c in crmSet) allCuits[c] = true;
  for (const c in admSet)  allCuits[c] = true;
  for (const c in bcSet)   allCuits[c] = true;

  for (const c in allCuits) {
    if (!c) continue;
    const inBc  = !!bcSet[c];
    const inCrm = !!crmSet[c];
    const inAdm = !!admSet[c];
    if (inBc)  stats.totBc++;
    if (inCrm) stats.totCrm++;
    if (inAdm) stats.totAdm++;
    if      (inBc  && !inCrm && !inAdm) stats.onlyBc++;
    else if (!inBc &&  inCrm && !inAdm) stats.onlyCrm++;
    else if (!inBc && !inCrm &&  inAdm) stats.onlyAdm++;
    else if (inBc  &&  inAdm && !inCrm) stats.bcAdm++;
    else if (inBc  &&  inCrm && !inAdm) stats.bcCrm++;
    else if (!inBc &&  inCrm &&  inAdm) stats.crmAdm++;
    else if (inBc  &&  inCrm &&  inAdm) stats.all3++;
  }

  let totalSoc = 0;
  for (const k in allByDepto) totalSoc += allByDepto[k].soc;

  return {
    acSocieties,
    acByDepto,
    allByDepto,
    totalBcNueva:  { soc: totalSoc },
    vennStats:     stats,
    acLeadsRaw,
    deptoAcMap:    liveDeptoAcMap,
    acAdmByDepto,
  };
}

// ─── getDashboardData ──────────────────────────────────────────────────────────
// Equivale a getDashboardData() del .gs original.
// emailManual se pasa desde el cliente (ya no hay Session.getActiveUser).

async function getDashboardData(emailManual, selectedAC) {
  const emailUsuario = (emailManual || '').toLowerCase().trim();

  let nombreAC = selectedAC || '';
  const isAdmin = (nombreAC === '* TODOS *' || nombreAC === 'TOTAL EMPRESA' || !nombreAC);

  // Si no es admin y no viene selectedAC, buscar el AC del email en aux
  if (!isAdmin && emailUsuario && !selectedAC) {
    const dAux = await getSheetData('aux');
    for (let i = 1; i < dAux.length; i++) {
      if (String(g(dAux[i], 20)).trim().toLowerCase() === emailUsuario) {
        nombreAC = String(g(dAux[i], 14)).trim();
        break;
      }
    }
  }

  const dashboard = {
    nombre: isAdmin ? '* TODOS *' : nombreAC,
    email:  emailUsuario,
    crm:  { leads: 0, tareas: 0, agenda: 0, comentarios: 0, descartes: 0 },
    base: { cabezasOfrecidas: 0, ofertasConcretadas: 0, ofertasPublicadas: 0 },
    ops:  { cabezasCompradas: 0, cabezasVendidas: 0, cargasAsistidas: 0, operaciones: 0 },
  };

  const contarCRM = async (nombreHoja, idx) => {
    const data = await getSheetData(nombreHoja);
    let count = 0;
    for (let i = 1; i < data.length; i++) {
      if (isAdmin || String(g(data[i], idx)).trim().toLowerCase() === emailUsuario) count++;
    }
    return count;
  };

  [
    dashboard.crm.leads,
    dashboard.crm.tareas,
    dashboard.crm.agenda,
    dashboard.crm.comentarios,
    dashboard.crm.descartes,
  ] = await Promise.all([
    contarCRM('Leads',       2),
    contarCRM('Tareas',      2),
    contarCRM('Agenda',      2),
    contarCRM('Comentarios', 2),
    contarCRM('Descartes',   2),
  ]);

  // BASE
  const dBase = await getSheetData('BASE');
  for (let i = 1; i < dBase.length; i++) {
    const row     = dBase[i];
    const estadoB = String(g(row, 3)).trim();
    const cabezas = parseFloat(g(row, 4)) || 0;
    const acBase  = String(g(row, 5)).trim();
    if (isAdmin || acBase === nombreAC) {
      dashboard.base.cabezasOfrecidas += cabezas;
      if (estadoB === 'Concretada')  dashboard.base.ofertasConcretadas++;
      if (estadoB === 'Publicado')   dashboard.base.ofertasPublicadas++;
    }
  }

  // OPS
  const dOps = await getSheetData('OPS');
  for (let i = 1; i < dOps.length; i++) {
    const row    = dOps[i];
    const acVend = String(g(row, 6)).trim();
    const acComp = String(g(row, 8)).trim();
    const q      = parseFloat(g(row, 9)) || 0;
    const acCarg = String(g(row, 22)).trim();
    let   part   = false;
    if (isAdmin || acVend === nombreAC) { dashboard.ops.cabezasVendidas  += q; part = true; }
    if (isAdmin || acComp === nombreAC) { dashboard.ops.cabezasCompradas += q; part = true; }
    if (isAdmin || acCarg === nombreAC) { dashboard.ops.cargasAsistidas++; }
    if (part) dashboard.ops.operaciones++;
  }

  return dashboard;
}

// ─── getDeptoGeoJSON ───────────────────────────────────────────────────────────
// Descarga (o devuelve del caché) el GeoJSON de departamentos argentinos.

async function getDeptoGeoJSON() {
  const cached = cacheGet('geojson');
  if (cached) return cached;

  const urls = [
    'https://raw.githubusercontent.com/mgaitan/departamentos_argentina/master/departamentos-argentina.json',
    'https://apis.datos.gob.ar/georef/api/departamentos?formato=geojson&max=600',
    'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/argentina-departamentos.geojson',
  ];

  let geojson = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      geojson = await res.json();
      break;
    } catch (e) {
      console.warn('[logic] GeoJSON URL falló:', url, e.message);
    }
  }

  if (!geojson) throw new Error('No se pudo obtener el GeoJSON de ninguna fuente.');

  // Limpiar propiedades para reducir payload (solo si no es Topology)
  if (geojson.type !== 'Topology' && Array.isArray(geojson.features)) {
    geojson.features = geojson.features.map(f => {
      const p = f.properties || {};
      return {
        ...f,
        properties: {
          nombre:   p.nombre   || p.name       || p.departamento || '',
          provincia: p.provincia || p.provincia_nombre || p.PROVINCIA || '',
        },
      };
    });
  }

  cacheSet('geojson', geojson);
  return geojson;
}

module.exports = { getACs, buildGlobalMaps, getTerritoryData, getDashboardData, getDeptoGeoJSON };
