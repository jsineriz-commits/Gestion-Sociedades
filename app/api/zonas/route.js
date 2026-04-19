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

    // Header en fila 1 (índice 0), datos desde fila 2
    const data = rows.slice(1);

    // Columnas (0-based):
    // A=0 Provincia, B=1 Departamento, C=2 ID, D=3 Zona (puede estar truncada), E=4 Responsable depto
    // H=7 Zona COMPLETA (lista de zonas únicas), I=8 Deptos count, J=9 Base Operativa, K=10 ID, L=11 Responsable zona
    const iProvA = 0, iDeptB = 1, iIdC = 2, iZonaD = 3, iRespE = 4;
    const iZonaH = 7, iBaseJ = 9, iRespL = 11;

    // ── Paso 1: construir el diccionario de zonas completas (col H) con responsables (col L) ──
    // Col H puede tener truncamiento visual pero aquí leemos el valor real de la celda
    const zonasConResp = {};   // zona completa → responsable
    const zonaBase    = {};    // zona completa → base operativa
    const zonasH = [];

    data.forEach(row => {
      const z = String(row[iZonaH] || '').trim();
      const r = String(row[iRespL] || '').trim();
      const b = String(row[iBaseJ] || '').trim();
      if (z) {
        if (!zonasConResp[z]) {
          zonasConResp[z] = r;
          zonaBase[z]     = b;
          zonasH.push(z);
        }
      }
    });

    // Zonas únicas ordenadas (desde col H — nombres completos)
    const zonasOrdenadas = [...new Set(zonasH)].filter(Boolean).sort();

    // ── Paso 2: función para resolver zona truncada de col D → zona completa de col H ──
    // La col D puede devolver el valor completo — lo testeamos primero contra col H exacto.
    // Si no matchea exacto, buscamos por prefijo más largo.
    function resolveZona(rawD) {
      const z = String(rawD || '').trim();
      if (!z) return '';
      // Exacto
      if (zonasConResp[z]) return z;
      // Normalizar y buscar prefijo
      const zUp = z.toUpperCase();
      let best = '', bestLen = 0;
      for (const zh of zonasOrdenadas) {
        const zhUp = zh.toUpperCase();
        if (zhUp.startsWith(zUp) || zUp.startsWith(zhUp)) {
          if (zhUp.length > bestLen) { best = zh; bestLen = zhUp.length; }
        }
      }
      return best || z; // Si no encontró coincidencia, devolver el valor original
    }

    // ── Paso 3: construir deptoMap con zonas resueltas ──
    // Clave = nombre depto en MAYÚSCULAS (para matching con normDepto del frontend)
    const deptoMap    = {};
    const zonasSet    = new Set();

    data.forEach(row => {
      const prov = String(row[iProvA] || '').trim().toUpperCase();
      const dept = String(row[iDeptB] || '').trim().toUpperCase();
      const id   = row[iIdC];
      const zona = resolveZona(row[iZonaD]);
      const resp = String(row[iRespE] || '').trim();

      if (!dept || !prov) return;

      deptoMap[dept] = { provincia: prov, zona, id, responsable: resp };
      if (zona) zonasSet.add(zona);
    });

    // ── Paso 4: deptos agrupados por zona ──
    const zonaDeptos = {};
    Object.entries(deptoMap).forEach(([dept, info]) => {
      const z = info.zona;
      if (!z) return;
      if (!zonaDeptos[z]) zonaDeptos[z] = [];
      zonaDeptos[z].push(dept);
    });

    // ── Paso 5: provincias únicas ──
    const provincias = [...new Set(
      data.map(r => String(r[iProvA] || '').trim().toUpperCase()).filter(Boolean)
    )].sort();

    const result = {
      deptoMap,        // DEPTO → { provincia, zona (completa), id, responsable }
      zonasConResp,    // zona → responsable
      zonaBase,        // zona → base operativa
      zonaDeptos,      // zona → [deptos]
      provincias,
      zonasOrdenadas,  // zonas únicas ordenadas con nombre completo
    };

    cache = result;
    cacheTs = Date.now();

    console.log(`[/api/zonas] OK: ${Object.keys(deptoMap).length} deptos, ${zonasOrdenadas.length} zonas`);
    return NextResponse.json(result);

  } catch (err) {
    console.error('[/api/zonas] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
