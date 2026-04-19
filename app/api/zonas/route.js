import { NextResponse } from 'next/server';
import { getSheetData } from '../../../lib/sheets.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

let cache = null;
let cacheTs = 0;
const TTL = 60 * 60 * 1000; // 1 hora

export async function GET() {
  try {
    if (cache && Date.now() - cacheTs < TTL) {
      return NextResponse.json(cache);
    }

    // Probar ambas variantes del nombre del tab
    let rows = await getSheetData('Roster-Regiones');
    if (!rows || rows.length < 2) rows = await getSheetData('roster-regiones');
    if (!rows || rows.length < 2) {
      return NextResponse.json({ error: 'Hoja Roster-Regiones no encontrada' }, { status: 500 });
    }

    const data = rows.slice(1); // skip header row 1

    // Columnas (0-based):
    // A=0 Provincia, B=1 Departamento, C=2 ID (DEPTO_ID), D=3 Zona (puede truncarse), E=4 Responsable depto
    // H=7 Zona COMPLETA (lista resumen), I=8 Deptos count, J=9 Base Operativa, K=10 ID zona, L=11 Responsable zona
    const iProvA=0, iDeptB=1, iIdC=2, iZonaD=3, iRespE=4;
    const iZonaH=7, iBaseJ=9, iRespL=11;

    // ── Paso 1: Zonas completas desde col H + responsable col L ──────
    const zonasConResp = {}; // zona → responsable
    const zonaBase     = {}; // zona → base operativa
    const zonasH       = [];
    data.forEach(row => {
      const z = String(row[iZonaH] || '').trim();
      const r = String(row[iRespL] || '').trim();
      const b = String(row[iBaseJ] || '').trim();
      if (z && !zonasConResp[z]) {
        zonasConResp[z] = r;
        zonaBase[z]     = b;
        zonasH.push(z);
      }
    });
    const zonasOrdenadas = [...new Set(zonasH)].filter(Boolean).sort();

    // ── Paso 2: Función para resolver zona de col D → nombre completo ──
    function resolveZona(rawD) {
      const z = String(rawD || '').trim();
      if (!z) return '';
      if (zonasConResp[z]) return z; // exacto
      const zUp = z.toUpperCase();
      let best = '', bestLen = 0;
      for (const zh of zonasOrdenadas) {
        const zhUp = zh.toUpperCase();
        if (zhUp.startsWith(zUp) || zUp.startsWith(zhUp)) {
          if (zhUp.length > bestLen) { best = zh; bestLen = zhUp.length; }
        }
      }
      return best || z;
    }

    // ── Paso 3: deptoMap con ID numérico como clave primaria ─────────
    // deptoMap (por nombre, para compatibilidad con GADM): DEPT_UPPER → { id, provincia, zona, responsable }
    const deptoMap    = {};
    // idToZona: DEPTO_ID → zona (matching robusto por ID)
    const idToZona    = {};
    // idToInfo: DEPTO_ID → { provincia, departamento, zona, responsable }
    const idToInfo    = {};
    const zonasSet    = new Set();

    data.forEach(row => {
      const prov = String(row[iProvA] || '').trim().toUpperCase();
      const dept = String(row[iDeptB] || '').trim().toUpperCase();
      const id   = Number(row[iIdC]) || null;
      const zona = resolveZona(row[iZonaD]);
      const resp = String(row[iRespE] || '').trim();

      if (!dept || !prov) return;

      const info = { id, provincia: prov, zona, responsable: resp };
      deptoMap[dept] = info;
      if (id) {
        idToZona[id] = zona;
        idToInfo[id] = { provincia: prov, departamento: dept, zona, responsable: resp };
      }
      if (zona) zonasSet.add(zona);
    });

    // ── Paso 4: deptos agrupados por zona (usando nombres) ───────────
    const zonaDeptos = {};
    Object.entries(deptoMap).forEach(([dept, info]) => {
      const z = info.zona;
      if (!z) return;
      if (!zonaDeptos[z]) zonaDeptos[z] = [];
      zonaDeptos[z].push(dept);
    });

    // ── Paso 5: provincias únicas ─────────────────────────────────────
    const provincias = [...new Set(
      data.map(r => String(r[iProvA] || '').trim().toUpperCase()).filter(Boolean)
    )].sort();

    const result = {
      deptoMap,        // dept_name → { id, provincia, zona, responsable }
      idToZona,        // DEPTO_ID → zona (matching robusto)
      idToInfo,        // DEPTO_ID → { provincia, departamento, zona, responsable }
      zonasConResp,    // zona → responsable
      zonaBase,        // zona → base operativa
      zonaDeptos,      // zona → [dept_names]
      provincias,
      zonasOrdenadas,
    };

    cache = result;
    cacheTs = Date.now();

    console.log(`[/api/zonas] OK: ${Object.keys(deptoMap).length} deptos, ${Object.keys(idToZona).length} con ID, ${zonasOrdenadas.length} zonas`);
    return NextResponse.json(result);

  } catch (err) {
    console.error('[/api/zonas] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
