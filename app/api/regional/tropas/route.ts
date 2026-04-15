import { NextResponse } from 'next/server';

const CARD_ID = 95;
const DATA_TTL_MS = 60 * 60 * 1000; // 1 hora
const SESSION_TTL_MS = 110 * 60 * 1000;

// ─── Caché en memoria ──────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry = 0;

interface CacheEntry { data: any; expiry: number; isRefreshing: boolean; }
const dataCaches: Record<string, CacheEntry> = {};

function getMetabase2Config() {
    const url      = (process.env.METABASE2_URL      || '').trim();
    const username = (process.env.METABASE2_USERNAME || '').trim();
    const password = (process.env.METABASE2_PASSWORD || '').trim();
    if (!url || !password) throw new Error('Falta METABASE2_URL o METABASE2_PASSWORD en .env');
    return { url, username, password };
}

async function getSession(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
    const { url, username, password } = getMetabase2Config();
    const res = await fetch(`${url}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        cache: 'no-store',
    });
    if (!res.ok) throw new Error('Fallo autenticación Metabase2');
    const { id: token } = await res.json();
    cachedToken = token;
    tokenExpiry = Date.now() + SESSION_TTL_MS;
    return token;
}

// Mapeo de campos Q95 → nombres estándar de card 4553
const FIELD_MAP: Record<string, string> = {
    'Estado_Trop': 'estado_tropas',  // Q95 usa majúscula, 4553 usa minúscula
    'ESTADO':      'estado_general', // Q95: ESTADO → 4553: estado_general
};

function formatData(sourceObj: any): any[] {
    const rows = sourceObj?.rows;
    const cols = sourceObj?.cols || sourceObj?.columns;
    if (!rows || !cols) return [];
    const colNames = cols.map((c: any) => FIELD_MAP[c.name || c] || c.name || c);
    return rows.map((row: any[]) => {
        const obj: any = {};
        row.forEach((v, i) => { obj[colNames[i]] = v; });
        return obj;
    });
}


async function fetchTropas(
    canal: string | null,
    fechaDesde: string,
    fechaHasta: string,
    acId?: number | null,
): Promise<any[]> {
    const token = await getSession();
    const { url } = getMetabase2Config();

    const parameters: any[] = [
        { type: 'category', target: ['variable', ['template-tag', 'fecha_desde']], value: fechaDesde },
        { type: 'category', target: ['variable', ['template-tag', 'fecha_hasta']], value: fechaHasta },
    ];

    // Solo filtrar por canal cuando NO hay acId específico.
    // Si hay acId, el filtro id_usuario es suficiente y cubre todas las tropas
    // del comercial sin importar el canal con el que operó en cada tropa.
    if (canal && (!acId || isNaN(acId))) {
        parameters.push({ type: 'category', target: ['variable', ['template-tag', 'canal']], value: canal });
    }

    // Filtrar por ID de usuario directamente en Q95 para evitar cruce de datos por nombre
    if (acId && !isNaN(acId)) {
        parameters.push({ type: 'category', target: ['variable', ['template-tag', 'id_usuario']], value: String(acId) });
    }

    // /query/json no tiene el límite de 2000 filas de /query
    const res = await fetch(`${url}/api/card/${CARD_ID}/query/json?format_rows=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
        body: JSON.stringify({ parameters }),
        cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Q95 HTTP ${res.status}`);
    const data: any[] = await res.json();
    if (!Array.isArray(data)) throw new Error('Q95: respuesta inesperada');

    // /query/json devuelve objetos planos — aplicar FIELD_MAP a las claves
    return data.map(row => {
        const out: any = {};
        for (const [k, v] of Object.entries(row)) {
            out[FIELD_MAP[k] || k] = v;
        }
        return out;
    });
}

async function refreshInBackground(key: string, canal: string | null, desde: string, hasta: string, acId?: number | null) {
    if (dataCaches[key]?.isRefreshing) return;
    if (!dataCaches[key]) dataCaches[key] = { data: null, expiry: 0, isRefreshing: true };
    else dataCaches[key].isRefreshing = true;
    try {
        const tropas = await fetchTropas(canal, desde, hasta, acId);
        dataCaches[key] = { data: { tropas, _cachedAt: new Date().toISOString() }, expiry: Date.now() + DATA_TTL_MS, isRefreshing: false };
    } catch (e: any) {
        dataCaches[key].isRefreshing = false;
        console.error('[Tropas] Background refresh error:', e.message);
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const isAdmin = searchParams.get('isAdmin') === 'true';
        const acName = searchParams.get('acName');
        const acIdRaw = searchParams.get('acId');
        const acId = acIdRaw ? parseInt(acIdRaw, 10) : null;
        // canal: null = todos, 'Regional'|'Representante'|'Comisionista'|'Directo' = filter Q95
        // 'Oficina' = special: Q95 no tiene ese valor → filtramos por repre_vendedor/repre_comprador
        const canal = searchParams.get('canal');

        const hoy = new Date();
        const fechaDesde = searchParams.get('fecha_desde') || `${hoy.getFullYear()}-01-01`;
        const fechaHasta = searchParams.get('fecha_hasta') || hoy.toISOString().split('T')[0];

        // Oficina y Directo se resuelven server-side (Q95 no tiene esos template-tags):
        // - Oficina  → filtra por repre_vendedor/repre_comprador que empieza con "Oficina"
        // - Directo  → filtra por Canal_Venta === 'Directo' (o Canal_compra)
        const isOficinaCanal = canal === 'Oficina';
        const isDirectoCanal = canal === 'Directo';
        const needsPostFilterCanal = isOficinaCanal || isDirectoCanal;
        // Canales que Q95 entiende directamente: Regional, Representante, Comisionista
        const q95Canal = needsPostFilterCanal ? null : canal;

        // Si hay acId, usamos caché por ID (no compartido entre usuarios)
        // Si no hay acId (admin global o canal), usamos caché global por canal+período
        const cacheKey = acId && !isNaN(acId)
            ? `ac_${acId}_${q95Canal || 'all'}_${fechaDesde}_${fechaHasta}`
            : `canal_${q95Canal || 'all'}_${fechaDesde}_${fechaHasta}`;

        const now = Date.now();
        const entry = dataCaches[cacheKey];

        let tropas: any[];

        // HIT o STALE → usar datos en caché
        if (entry?.data?.tropas && now < entry.expiry) {
            tropas = entry.data.tropas;
        } else if (entry?.data?.tropas && now >= entry.expiry) {
            refreshInBackground(cacheKey, q95Canal, fechaDesde, fechaHasta, acId);
            tropas = entry.data.tropas;
        } else {
            // MISS → fetchar de Metabase (con acId si está disponible)
            tropas = await fetchTropas(q95Canal, fechaDesde, fechaHasta, acId);
            dataCaches[cacheKey] = { data: { tropas, _cachedAt: new Date().toISOString() }, expiry: now + DATA_TTL_MS, isRefreshing: false };
        }

        // Post-filter por canal especial
        if (isOficinaCanal) {
            tropas = tropas.filter((t: any) => {
                const rv = (t.repre_vendedor || '').toLowerCase();
                const rc = (t.repre_comprador || '').toLowerCase();
                return rv.startsWith('oficina') || rc.startsWith('oficina');
            });
        } else if (isDirectoCanal) {
            tropas = tropas.filter((t: any) =>
                t.Canal_Venta === 'Directo' || t.Canal_compra === 'Directo'
            );
        }

        // Post-filter por nombre: SOLO cuando no hay acId
        // Cuando hay acId, Q95 ya filtró por id_usuario — confiar en ese resultado
        let filtered = tropas;
        if (!isAdmin && !acId && acName) {
            const nameLower = acName.toLowerCase().trim();
            const isOficinaName = nameLower.startsWith('oficina');

            filtered = tropas.filter((t: any) => {
                const vend = (t.AC_Vend || '').toLowerCase().trim();
                const comp = (t.AC_Comp || '').toLowerCase().trim();
                const reprVend = (t.repre_vendedor || '').toLowerCase().trim();
                const reprComp = (t.repre_comprador || '').toLowerCase().trim();

                if (isOficinaName) {
                    return reprVend === nameLower || reprComp === nameLower;
                }

                // Match exacto por nombre completo
                const acMatch = (vend && vend === nameLower) || (comp && comp === nameLower);
                const reprMatch = (reprVend && reprVend === nameLower) || (reprComp && reprComp === nameLower);
                return acMatch || reprMatch;
            });
        }

        const result = {
            tropas: filtered,
            total: tropas.length,
            filteredCount: filtered.length,
            _cachedAt: dataCaches[cacheKey]?.data?._cachedAt || new Date().toISOString(),
        };

        return NextResponse.json(result, {
            headers: { 'X-Cache': entry?.data ? 'HIT' : 'MISS' },
        });

    } catch (err: any) {
        console.error('[Tropas API]', err.message);
        cachedToken = null; tokenExpiry = 0;
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
