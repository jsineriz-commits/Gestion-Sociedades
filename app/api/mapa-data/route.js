import { NextResponse } from 'next/server';

export const dynamic    = 'force-dynamic';
export const maxDuration = 90;

let cache   = null;
let cacheTs = 0;
const TTL   = 30 * 60 * 1000;

const CARD_ID    = 202; // Deptos Agregado: provincia, partido_domicilio_est, total_establecimientos, total_bovinos, total_vacas
const BASE_URL   = (process.env.METABASE_URL || '').replace(/\/$/, '');
const API_KEY    = process.env.METABASE_API_KEY || '';  // preferido si está
const MB_USER    = process.env.METABASE_USERNAME || '';
const MB_PASS    = process.env.METABASE_PASSWORD || '';

// ── Session cache ────────────────────────────────────────────────────
let _session    = null;
let _sessionExp = 0;

async function getToken() {
  if (API_KEY) return null; // usar API key directamente, sin sesión
  if (_session && Date.now() < _sessionExp) return _session;
  const r = await fetch(`${BASE_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: MB_USER, password: MB_PASS }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Auth Metabase ${r.status}: ${(await r.text()).slice(0,200)}`);
  const d = await r.json();
  if (!d.id) throw new Error('Metabase no devolvió token');
  _session    = d.id;
  _sessionExp = Date.now() + 25 * 60 * 1000;
  return _session;
}

async function fetchQ201() {
  if (!BASE_URL) throw new Error('METABASE_URL no configurado');

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  } else {
    const token = await getToken();
    headers['X-Metabase-Session'] = token;
  }

  const body = new URLSearchParams({ parameters: JSON.stringify([]) });
  const url  = `${BASE_URL}/api/card/${CARD_ID}/query/json`;

  console.log(`[mapa-data] POST ${url} (auth: ${API_KEY ? 'api-key' : 'session'}) - card ${CARD_ID}`);

  const r = await fetch(url, {
    method: 'POST',
    headers,
    body: body.toString(),
    signal: AbortSignal.timeout(85000),
  });

  const text = await r.text();

  if (!r.ok) {
    throw new Error(`Metabase Q${CARD_ID} HTTP ${r.status}: ${text.slice(0, 400)}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no es JSON válido: ${text.slice(0, 300)}`);
  }

  // Metabase a veces devuelve error embebido en JSON
  if (data?.status === 'failed' || data?.error) {
    throw new Error(`Metabase error en query: ${JSON.stringify(data).slice(0, 400)}`);
  }

  // /query/json devuelve array, /query devuelve {data:{rows,cols}}
  if (Array.isArray(data)) return data;

  // Fallback: formato nativo de Metabase
  if (data?.data?.rows && data?.data?.cols) {
    const cols = data.data.cols.map(c => c.name);
    return data.data.rows.map(row => {
      const obj = {};
      cols.forEach((k, i) => { obj[k] = row[i]; });
      return obj;
    });
  }

  throw new Error(`Formato inesperado de Metabase: ${JSON.stringify(data).slice(0, 300)}`);
}

export async function GET() {
  try {
    if (cache && Date.now() - cacheTs < TTL) {
      return NextResponse.json({ data: cache, cached: true, count: cache.length });
    }

    console.log('[mapa-data] Fetching Q201...');
    const rows = await fetchQ201();
    cache   = rows;
    cacheTs = Date.now();
    console.log(`[mapa-data] ${rows.length} filas OK`);
    return NextResponse.json({ data: rows, cached: false, count: rows.length });

  } catch (err) {
    console.error('[mapa-data] ERROR:', err.message);
    // Devolver el error detallado para facilitar el diagnóstico
    return NextResponse.json({ error: err.message, card: CARD_ID }, { status: 500 });
  }
}
