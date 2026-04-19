import { NextResponse } from 'next/server';
import { getSheetData } from '../../../lib/sheets.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

let cache = null;
let cacheTs = 0;
const TTL = 2 * 60 * 60 * 1000; // 2 horas

export async function GET() {
  try {
    if (cache && Date.now() - cacheTs < TTL) {
      return NextResponse.json(cache);
    }

    // Leer ambas hojas en paralelo
    const [mergeRows, bcIdRows] = await Promise.all([
      getSheetData('Merge Partido_Departamento'),
      getSheetData('BC - ID'),
    ]);

    // ── Hoja "Merge Partido_Departamento" ────────────────────────────
    // Cols (0-based): A=0 YCNTRD, B=1 XCNTRD, C=2 Depto_Latitud, D=3 Depto_Longitud,
    //                 E=4 PROVINCIA, F=5 PROV, G=6 DEPARTAMTO, H=7 CABECERA,
    //                 I=8 PERIMETRO, J=9 SUP__HAS_, K=10 DEPTO_ID, L=11 LINK, M=12 AREA
    const mergeData = (mergeRows || []).slice(1); // saltar header

    // idToInfo: DEPTO_ID → { prov, dept, lat, lng }
    const idToInfo = {};
    // nameToId: norm(prov+dept) → DEPTO_ID  (para matchear GADM)
    const nameToId = {};
    // normDept: norm(dept) → DEPTO_ID (fallback cuando prov no matchea)
    const normDeptToId = {};

    mergeData.forEach(row => {
      const lat   = parseFloat(String(row[2] || '').replace(',', '.')) || 0;
      const lng   = parseFloat(String(row[3] || '').replace(',', '.')) || 0;
      const prov  = String(row[4] || '').trim().toUpperCase();
      const dept  = String(row[6] || '').trim().toUpperCase();
      const id    = Number(row[10]);

      if (!id || !dept) return;

      idToInfo[id] = { prov, dept, lat, lng };

      const key = norm(prov) + '|' + norm(dept);
      nameToId[key] = id;
      // También por solo dept (fallback)
      if (!normDeptToId[norm(dept)]) normDeptToId[norm(dept)] = id;
    });

    // ── Hoja "BC - ID" ───────────────────────────────────────────────
    // Cols (0-based): A=0 [concat prov+partido], B=1 provincia, C=2 partido,
    //                 D=3 Part_Raster, E=4 ID_DEPTO
    const bcData = (bcIdRows || []).slice(1);

    // bcLookup: norm(prov) + '|' + norm(partido) → DEPTO_ID
    const bcLookup = {};
    // también por solo partido (fallback)
    const bcDeptOnly = {};

    bcData.forEach(row => {
      const prov    = String(row[1] || '').trim().toUpperCase();
      const partido = String(row[2] || '').trim().toUpperCase();
      const id      = Number(row[4]);

      if (!id || !partido) return;

      const key = norm(prov) + '|' + norm(partido);
      bcLookup[key] = id;
      if (!bcDeptOnly[norm(partido)]) bcDeptOnly[norm(partido)] = id;
    });

    const result = {
      idToInfo,        // DEPTO_ID → { prov, dept, lat, lng }
      nameToId,        // norm(prov)+'|'+norm(dept) → DEPTO_ID  (para GADM)
      normDeptToId,    // norm(dept) → DEPTO_ID (fallback)
      bcLookup,        // norm(prov)+'|'+norm(partido) → DEPTO_ID  (para Q188)
      bcDeptOnly,      // norm(partido) → DEPTO_ID (fallback Q188)
    };

    cache = result;
    cacheTs = Date.now();

    console.log(`[/api/depto-ids] OK: ${Object.keys(idToInfo).length} deptos en Merge, ${Object.keys(bcLookup).length} en BC-ID`);
    return NextResponse.json(result);

  } catch (err) {
    console.error('[/api/depto-ids] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Normalización local ─────────────────────────────────────────────
function norm(str) {
  return String(str || '').toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, ' ')
    .replace(/\bGRAL\b/g, 'GENERAL').replace(/\bCNEL\b/g, 'CORONEL')
    .replace(/\bSTA\b/g, 'SANTA').replace(/\bSTO\b/g, 'SANTO')
    .replace(/\bTTE\b/g, 'TENIENTE').replace(/\bPTE\b/g, 'PRESIDENTE')
    .replace(/\s+/g, ' ').trim();
}
