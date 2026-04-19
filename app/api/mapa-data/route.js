import { NextResponse } from 'next/server';
import { runMetabaseQuery } from '../../../lib/metabase.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

// Cache en memoria (30 min)
let cache = null;
let cacheTs = 0;
const TTL = 30 * 60 * 1000;

// Q201: Padrón SENASA × Base DCAC — tiene lat/lng reales, provincia completa, partido_domicilio_est
const CARD_ID = 201;

export async function GET() {
  try {
    if (cache && Date.now() - cacheTs < TTL) {
      return NextResponse.json({ data: cache, cached: true });
    }

    console.log('[/api/mapa-data] Fetching Q201...');
    const rows = await runMetabaseQuery(CARD_ID, []);
    cache = rows;
    cacheTs = Date.now();
    console.log(`[/api/mapa-data] ${rows.length} filas cargadas.`);
    return NextResponse.json({ data: rows, cached: false });
  } catch (err) {
    console.error('[/api/mapa-data] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
