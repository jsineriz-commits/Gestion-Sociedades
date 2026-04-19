import { NextResponse } from 'next/server';
import { runMetabaseQuery } from '../../../lib/metabase.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

// Cache en memoria (30 min — Q188 no cambia tan seguido)
let cache = null;
let cacheTs = 0;
const TTL = 30 * 60 * 1000;

// Q188: Base Clave SENASA completa — sin filtro de provincia
const CARD_ID = 188;

export async function GET() {
  try {
    if (cache && Date.now() - cacheTs < TTL) {
      return NextResponse.json({ data: cache, cached: true });
    }

    console.log('[/api/mapa-data] Fetching Q188 completo...');
    const rows = await runMetabaseQuery(CARD_ID, []); // sin parámetros = toda Argentina
    cache = rows;
    cacheTs = Date.now();
    console.log(`[/api/mapa-data] ${rows.length} filas cargadas.`);
    return NextResponse.json({ data: rows, cached: false });
  } catch (err) {
    console.error('[/api/mapa-data] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
