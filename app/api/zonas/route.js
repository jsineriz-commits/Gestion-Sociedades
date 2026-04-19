import { NextResponse } from 'next/server';
import { getSheetData } from '../../../lib/sheets.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Cache en memoria (se renueva con cada cold start de Vercel)
let cache = null;
let cacheTs = 0;
const TTL = 60 * 60 * 1000; // 1 hora

export async function GET() {
  try {
    if (cache && Date.now() - cacheTs < TTL) {
      return NextResponse.json(cache);
    }

    // Leer hoja Roster-Regiones
    // Col A=Provincia, B=Departamento, C=ID, D=Zona, E=Responsable
    // Col H=Zona (lista de zonas únicas), Col L=Responsable de zona
    const rows = await getSheetData('Roster-Regiones');
    if (!rows || rows.length < 2) {
      return NextResponse.json({ error: 'Sin datos en Roster-Regiones' }, { status: 500 });
    }

    const header = rows[0];
    const data   = rows.slice(1);

    // Índices (0-based): A=0, B=1, C=2, D=3, E=4, H=7, L=11
    const iProvA  = 0, iDeptB = 1, iIdC = 2, iZonaD = 3, iRespE = 4;
    const iZonaH  = 7, iRespL = 11;

    // Mapa depto → { provincia, zona, id, responsable }
    const deptoMap = {};
    // Mapa provincia → Set de zonas
    const provZonas = {};
    // Set de zonas únicas desde col D
    const zonasSet = new Set();

    data.forEach(row => {
      const prov  = String(row[iProvA]  || '').trim().toUpperCase();
      const dept  = String(row[iDeptB]  || '').trim().toUpperCase();
      const id    = row[iIdC];
      const zona  = String(row[iZonaD]  || '').trim();
      const resp  = String(row[iRespE]  || '').trim();

      if (!dept || !prov) return;

      deptoMap[dept] = { provincia: prov, zona, id, responsable: resp };

      if (zona) {
        zonasSet.add(zona);
        if (!provZonas[prov]) provZonas[prov] = new Set();
        provZonas[prov].add(zona);
      }
    });

    // Lista de zonas con responsable desde col H y L
    const zonasConResp = {};
    data.forEach(row => {
      const z = String(row[iZonaH] || '').trim();
      const r = String(row[iRespL] || '').trim();
      if (z) zonasConResp[z] = r;
    });

    // Deptos agrupados por zona
    const zonaDeptos = {};
    Object.entries(deptoMap).forEach(([dept, info]) => {
      const z = info.zona;
      if (!z) return;
      if (!zonaDeptos[z]) zonaDeptos[z] = [];
      zonaDeptos[z].push(dept);
    });

    // Provincias únicas
    const provincias = [...new Set(data.map(r => String(r[iProvA] || '').trim().toUpperCase()).filter(Boolean))].sort();

    const result = {
      deptoMap,          // depto (normalizado) → { provincia, zona, id, responsable }
      zonasConResp,      // zona → responsable
      zonaDeptos,        // zona → [deptos]
      provincias,        // lista de provincias
      zonasOrdenadas: [...zonasSet].sort(),
    };

    cache = result;
    cacheTs = Date.now();

    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/zonas] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
