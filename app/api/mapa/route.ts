import { NextResponse } from 'next/server';
import { formatMetabaseData } from '@/lib/api/metabase-server';

// ─── Caché en memoria ────────────────────────────────────────────────────────
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos
let cachedToken: string | null = null;
let tokenExpiry = 0;

interface MapCache {
  data: any;
  expiry: number;
}
const mapCache: Record<string, MapCache> = {};

// ─── Mapeo de código de provincia Metabase → frontend (GeoJSON) ──────────────
const PROV_CODE_MAP: Record<string, string> = {
  'BUE': 'BA',   // Buenos Aires
  'ERI': 'ER',   // Entre Ríos
  'MIS': 'MIS',
  'COR': 'COR',
  'SDE': 'SDE',
  'CBA': 'CBA',
  'SFE': 'SFE',
  'CHA': 'CHA',
  'FOR': 'FOR',
  'LPA': 'LPA',
  'SAL': 'SAL',
  'JUJ': 'JUJ',
  'TUC': 'TUC',
  'CAT': 'CAT',
  'MZA': 'MZA',
  'SLU': 'SLU',
  'SJU': 'SJU',
  'CABA': 'CABA',
  'NQN': 'NQN',
  'RN': 'RN',
  'CHU': 'CHU',
  'TDF': 'TDF',
  'LRJ': 'LRJ',
};

// ─── Auth Metabase ────────────────────────────────────────────────────────────
async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${process.env.METABASE_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.METABASE_USERNAME,
      password: process.env.METABASE_PASSWORD,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Auth Metabase fallo: ${res.status}`);
  const { id } = await res.json();
  cachedToken = id;
  tokenExpiry = Date.now() + 110 * 60 * 1000;
  return id;
}

// ─── Fetch de query Metabase sin parámetros ───────────────────────────────────
async function fetchQuery(queryId: number, token: string): Promise<any[]> {
  const res = await fetch(
    `${process.env.METABASE_URL}/api/card/${queryId}/query/json?format_rows=false`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
      body: JSON.stringify({ constraints: { 'max-results': 1_000_000 } }),
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    // Fallback al endpoint /query (returns cols+rows format)
    const res2 = await fetch(`${process.env.METABASE_URL}/api/card/${queryId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
      body: JSON.stringify({ constraints: { 'max-results': 1_000_000 } }),
      cache: 'no-store',
    });
    if (!res2.ok) throw new Error(`Q${queryId} HTTP ${res2.status}`);
    const raw = await res2.json();
    if (raw.error) throw new Error(raw.error);
    return formatMetabaseData(raw.data) || [];
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    // Podría venir en formato {data: {rows, cols}}
    const fmt = formatMetabaseData((data as any).data || data);
    return fmt || [];
  }
  return data;
}

// ─── Normalizar nombre de departamento ───────────────────────────────────────
function normDepto(s: string): string {
  return (s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ─── Procesar Q188 + Q189 → datos por depto ──────────────────────────────────
async function buildMapData(token: string) {
  const cacheKey = 'mapa_global';
  const cached = mapCache[cacheKey];
  if (cached && Date.now() < cached.expiry) return cached.data;

  console.time('[mapa] Q188+Q189');
  const [q188, q189] = await Promise.all([
    fetchQuery(188, token),
    fetchQuery(189, token),
  ]);
  console.timeEnd('[mapa] Q188+Q189');

  // Index Q189 por st.cuit
  const q189Map: Record<string, any> = {};
  const acSet = new Set<string>();
  for (const r of q189) {
    const cuit = String((r as any)['st.cuit'] || (r as any).cuit || '').trim();
    if (cuit) q189Map[cuit] = r;
    const ac = String((r as any).asociado_comercial || '').trim();
    if (ac && ac !== 'null') acSet.add(ac);
  }

  const allByDepto: Record<string, {
    soc: number; qtotal: number; qvaca: number; qoperada: number;
    admTotal: number; admAct: number;
  }> = {};

  const acByDepto: Record<string, Record<string, number>> = {};

  const acSocieties: Array<{
    cuit: string; nombre: string; ac: string;
    deptoKey: string; kt: number; kv: number;
  }> = [];

  for (const row of q188 as any[]) {
    const cuit = String(row.cuit || '').trim();
    if (!cuit) continue;

    const deptoRaw = row.partido_registro_dcac || row.partido_establecimiento_senasa || '';
    const provRaw = String(row.prov_registro_dcac || row.prov_establecimiento_senasa || '').toUpperCase();
    const deptoClean = normDepto(deptoRaw);
    if (!deptoClean) continue;

    const provCode = PROV_CODE_MAP[provRaw] || provRaw;
    const deptoKey = `${deptoClean}|${provCode}`;

    const ac = String(q189Map[cuit]?.asociado_comercial || '').trim() || 'SIN ASIGNAR';
    const qt = parseFloat(row.total_bovinos) || 0;
    const qv = parseFloat(row.total_vacas) || 0;
    const oper = parseFloat(row.cabezas_operadas_dcac) || 0;

    if (!allByDepto[deptoKey]) {
      allByDepto[deptoKey] = { soc: 0, qtotal: 0, qvaca: 0, qoperada: 0, admTotal: 0, admAct: 0 };
    }
    allByDepto[deptoKey].soc++;
    allByDepto[deptoKey].qtotal += qt;
    allByDepto[deptoKey].qvaca += qv;
    allByDepto[deptoKey].qoperada += oper;
    if (row.existe_en_dcac === 'SI') {
      allByDepto[deptoKey].admTotal++;
      if (q189Map[cuit]?.Ult_act) allByDepto[deptoKey].admAct++;
    }

    if (!acByDepto[deptoKey]) acByDepto[deptoKey] = {};
    acByDepto[deptoKey][ac] = (acByDepto[deptoKey][ac] || 0) + 1;

    acSocieties.push({
      cuit,
      nombre: row.razon_social || '',
      ac,
      deptoKey,
      kt: qt,
      kv: qv,
    });
  }

  const result = {
    allByDepto,
    acByDepto,
    acSocieties: acSocieties.slice(0, 500), // cap para response size
    acList: Array.from(acSet).sort(),
    _generatedAt: new Date().toISOString(),
  };

  mapCache[cacheKey] = { data: result, expiry: Date.now() + CACHE_TTL_MS };
  return result;
}

// ─── Handler GET ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const token = await getToken();
    const data = await buildMapData(token);
    return NextResponse.json(data, {
      headers: { 'X-Cache': mapCache['mapa_global'] ? 'HIT' : 'MISS' },
    });
  } catch (err: any) {
    console.error('[api/mapa]', err.message);
    cachedToken = null;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
