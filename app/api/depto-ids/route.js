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
    const mergeData = (mergeRows || []).slice(1);

    const idToInfo      = {};
    const nameToId      = {};
    const normDeptToId  = {};
    const mergeCoords   = []; // [{id, lat, lng}] para matching por coordenadas

    mergeData.forEach(row => {
      // Coordenadas: preferir col C/D (Depto_Lat/Lng), fallback a col A/B (Y/XCNTRD)
      const lat = parseFloat(String(row[2] || row[0] || '').replace(',', '.')) || 0;
      const lng = parseFloat(String(row[3] || row[1] || '').replace(',', '.')) || 0;
      const prov = String(row[4] || '').trim().toUpperCase();
      const dept = String(row[6] || '').trim().toUpperCase();
      const id   = Number(row[10]);

      if (!id || !dept) return;

      idToInfo[id] = { prov, dept, lat, lng };

      const key = norm(prov) + '|' + norm(dept);
      nameToId[key] = id;
      if (!normDeptToId[norm(dept)]) normDeptToId[norm(dept)] = id;

      // Array de coordenadas para nearest-neighbor matching
      if (lat !== 0 && lng !== 0) {
        mergeCoords.push({ id, lat, lng });
      }
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

    // ── Hoja "GADM - Match Deptos" — matches manuales (cols F + G) ───
    // Col A=0 Provincia GADM, B=1 Depto GADM (NAME_2), E=4 GID_2
    // Col F=5 → partido BC (partido_establecimiento_senasa)
    // Col G=6 → provincia BC (para desambiguar el lookup)
    let gadmMatchRows = [];
    try { gadmMatchRows = await getSheetData('GADM - Match Deptos'); }
    catch(e) { console.warn('[depto-ids] No se pudo leer GADM - Match Deptos:', e.message); }

    const gadmMatchData = (gadmMatchRows || []).slice(1); // skip header
    let manualMatches = 0;
    // gadmRawToNorm: nombre GADM crudo (col B) → nombre normalizado (col D)
    const gadmRawToNorm = {};
    // gadmToRoster: nombre GADM crudo (col B) → { rosterDept (col H), rosterProv (col I) }
    //   Para que getZona() pueda buscar en deptoMap con el nombre de Roster-Regiones
    const gadmToRoster = {};

    gadmMatchData.forEach(row => {
      const gadmProv   = String(row[0] || '').trim(); // col A: prov GADM (ej. "BuenosAires")
      const gadmDept   = String(row[1] || '').trim(); // col B: depto GADM (ej. "NuevedeJulio")
      const normDept   = String(row[3] || '').trim(); // col D: depto normalizado
      const bcDept     = String(row[5] || '').trim(); // col F → nombre en query Metabase
      const bcProv     = String(row[6] || '').trim(); // col G → provincia en query Metabase
      const rosterDept = String(row[7] || '').trim(); // col H → nombre en Roster-Regiones (NUEVO)
      const rosterProv = String(row[8] || '').trim(); // col I → provincia en Roster-Regiones (NUEVO)

      // gadmRawToNorm: col B → col D (para traducción de nombres en getFeatureKey)
      if (gadmDept && normDept && gadmDept !== normDept) {
        gadmRawToNorm[gadmDept] = normDept;
      }
      // gadmToRoster: col B → col H/I (para getZona busque en deptoMap con nombre de Roster)
      if (gadmDept && rosterDept) {
        gadmToRoster[gadmDept] = { rosterDept, rosterProv: rosterProv || bcProv || gadmProv };
      }

      if (!bcDept || !gadmDept) return; // solo filas con datos en col F

      // Buscar DEPTO_ID: primero prov+partido, luego solo partido
      const bcKey = norm(bcProv || gadmProv) + '|' + norm(bcDept);
      const id    = bcLookup[bcKey] || bcDeptOnly[norm(bcDept)];
      if (!id) return;

      // Agregar al nameToId usando normGadm (CamelCase-aware) para que coincida con MapaTab
      // normGadm("BuenosAires") = "BUENOS AIRES", normGadm("NuevedeJulio") = "NUEVE DE JULIO"
      const gadmKey = normGadm(gadmProv) + '|' + normGadm(gadmDept);
      if (!nameToId[gadmKey]) {
        nameToId[gadmKey] = id;
        if (!normDeptToId[normGadm(gadmDept)]) normDeptToId[normGadm(gadmDept)] = id;
        if (!idToInfo[id]) {
          idToInfo[id] = { prov: norm(bcProv || gadmProv), dept: norm(bcDept), lat: 0, lng: 0 };
        }
        manualMatches++;
      }
    });

    console.log(`[depto-ids] +${manualMatches} matches manuales desde GADM-Match Deptos`);

    const result = {
      idToInfo,        // DEPTO_ID → { prov, dept, lat, lng }
      nameToId,        // norm(prov)+'|'+norm(dept) → DEPTO_ID
      normDeptToId,    // norm(dept) → DEPTO_ID (fallback)
      bcLookup,        // norm(prov)+'|'+norm(partido) → DEPTO_ID
      bcDeptOnly,      // norm(partido) → DEPTO_ID (fallback)
      mergeCoords,     // [{id, lat, lng}] para matching por coordenadas con GADM
      gadmRawToNorm,   // nombre GADM crudo → nombre normalizado (col D)
      gadmToRoster,    // nombre GADM crudo → { rosterDept, rosterProv } (col H/I) para getZona()
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

// ── Normalización local (sin CamelCase split) — para nombres ya normalizados —
function norm(str) {
  return String(str || '').toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, ' ')
    .replace(/\bGRAL\b/g, 'GENERAL').replace(/\bCNEL\b/g, 'CORONEL')
    .replace(/\bSTA\b/g, 'SANTA').replace(/\bSTO\b/g, 'SANTO')
    .replace(/\bTTE\b/g, 'TENIENTE').replace(/\bPTE\b/g, 'PRESIDENTE')
    .replace(/(\w+?)DEL\b/g,'$1 DEL')
    .replace(/(\w+?)DE\b/g,'$1 DE')
    .replace(/(\w+?)LAS\b/g,'$1 LAS')
    .replace(/(\w+?)LOS\b/g,'$1 LOS')
    .replace(/\s+/g, ' ').trim();
}
// ── normGadm: igual que MapaTab’s norm() — CamelCase split + preposiciones + abrev. ──
// DEBE ser idéntica a la función norm() de MapaTab.js para que gadmKey == idKey en getFeatureKey
function normGadm(str) {
  let s = String(str||'').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2');
  return s.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, ' ')
    .replace(/\bGRAL\b/g, 'GENERAL').replace(/\bCNEL\b/g, 'CORONEL')
    .replace(/\bSTA\b/g, 'SANTA').replace(/\bSTO\b/g, 'SANTO')
    .replace(/\bTTE\b/g, 'TENIENTE').replace(/\bPTE\b/g, 'PRESIDENTE')
    // Mismo fix de preposiciones que MapaTab.js norm(): "NUEVEDE" → "NUEVE DE"
    .replace(/(\w+?)DEL\b/g,'$1 DEL')
    .replace(/(\w+?)DE\b/g,'$1 DE')
    .replace(/(\w+?)LAS\b/g,'$1 LAS')
    .replace(/(\w+?)LOS\b/g,'$1 LOS')
    .replace(/\s+/g, ' ').trim();
}