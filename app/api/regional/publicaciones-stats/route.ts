import { NextResponse } from 'next/server';

const CARD_ID = 95;
const DATA_TTL_MS = 20 * 60 * 1000;
const SESSION_TTL_MS = 110 * 60 * 1000;

let cachedToken: string | null = null;
let tokenExpiry = 0;
const dataCache: Record<string, { data: any; expiry: number }> = {};

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
    if (!res.ok) throw new Error('Fallo auth Metabase2');
    const { id: token } = await res.json();
    cachedToken = token;
    tokenExpiry = Date.now() + SESSION_TTL_MS;
    return token;
}

function formatData(sourceObj: any): any[] {
    const rows = sourceObj?.rows;
    const cols = sourceObj?.cols || sourceObj?.columns;
    if (!rows || !cols) return [];
    const colNames = cols.map((c: any) => c.name || c);
    return rows.map((row: any[]) => {
        const obj: any = {};
        row.forEach((v, i) => { obj[colNames[i]] = v; });
        return obj;
    });
}

function normalizeUN(tipo: string): string {
    const u = (tipo || '').toUpperCase().trim();
    if (u === 'FAENA' || u === 'FAE') return 'Faena';
    if (u === 'INVERNADA' || u === 'INV') return 'Invernada';
    if (u === 'INVERNADA NEO') return 'Inv. Neo';
    if (u === 'CRÍA' || u === 'CRIA') return 'Cría';
    if (u === 'MAG') return 'MAG';
    return tipo || 'Otros';
}

function parseDateLocal(s: string | null): Date | null {
    if (!s) return null;
    const d = typeof s === 'string' && s.includes('T') ? new Date(s) : new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
}

function computeStats(rows: any[], hoy: Date) {
    const startOfDay    = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const startOfWeek   = (d: Date) => { const day = d.getDay(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day === 0 ? 6 : day - 1)); };
    const startOfMonth  = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const startOfPrevM  = (d: Date) => new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const endOfPrevM    = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59);

    const hoyStart  = startOfDay(hoy);
    const semStart  = startOfWeek(hoy);
    const mesStart  = startOfMonth(hoy);
    const prevStart = startOfPrevM(hoy);
    const prevEnd   = endOfPrevM(hoy);

    const empty = () => ({ cabezas: 0, byUN: {} as Record<string, number> });
    const acc = { hoy: empty(), semana: empty(), mes: empty(), prevMes: empty() };

    for (const row of rows) {
        const fechaPub = parseDateLocal(row.fecha_publicaciones);
        if (!fechaPub) continue;

        const cabezas = Number(row.Cabezas) || 0;
        const un = normalizeUN(row.Tipo || row.UN || '');

        const add = (bucket: typeof acc.hoy) => {
            bucket.cabezas += cabezas;
            bucket.byUN[un] = (bucket.byUN[un] || 0) + cabezas;
        };

        if (fechaPub >= hoyStart) add(acc.hoy);
        if (fechaPub >= semStart)  add(acc.semana);
        if (fechaPub >= mesStart)  add(acc.mes);
        if (fechaPub >= prevStart && fechaPub <= prevEnd) add(acc.prevMes);
    }

    return acc;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const isAdmin  = searchParams.get('isAdmin') === 'true';
        const acName   = searchParams.get('acName');
        const acIdRaw  = searchParams.get('acId');
        const acId     = acIdRaw ? parseInt(acIdRaw, 10) : null;
        const canal    = searchParams.get('canal') || 'Regional';

        const hoy = new Date();
        // Traemos 2 meses: desde el 1ro del mes anterior hasta hoy
        const prevMonthStart = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const fechaDesde = prevMonthStart.toISOString().split('T')[0];
        const fechaHasta = hoy.toISOString().split('T')[0];

        // cacheKey por acId si está disponible para evitar cruce entre usuarios
        const cacheKey = acId && !isNaN(acId)
            ? `pub_${canal}_ac${acId}_${fechaDesde}`
            : `pub_${canal}_${acName || 'all'}_${fechaDesde}`;
        const now = Date.now();
        const entry = dataCache[cacheKey];

        let rows: any[];

        if (entry?.data && now < entry.expiry) {
            rows = entry.data;
        } else {
            const token = await getSession();
            const { url } = getMetabase2Config();

            const parameters: any[] = [
                { type: 'date/single', target: ['variable', ['template-tag', 'fecha_desde']], value: fechaDesde },
                { type: 'date/single', target: ['variable', ['template-tag', 'fecha_hasta']], value: fechaHasta },
            ];
            // Solo filtrar por canal cuando NO hay acId específico.
            // Si hay acId, el filtro id_usuario es suficiente y cubre todas las tropas
            // del comercial sin importar el canal con el que operó en cada tropa.
            if (canal && (!acId || isNaN(acId))) {
                parameters.push({ type: 'string/=', target: ['variable', ['template-tag', 'canal']], value: canal });
            }
            // Filtrar por ID de usuario en Q95 para evitar cruce de datos por nombre
            if (acId && !isNaN(acId)) {
                parameters.push({ type: 'category', target: ['variable', ['template-tag', 'id_usuario']], value: String(acId) });
            }

            const res = await fetch(`${url}/api/card/${CARD_ID}/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
                body: JSON.stringify({ parameters }),
                cache: 'no-store',
            });
            const raw = await res.json();
            if (raw.error) throw new Error(raw.error);
            rows = raw.data ? formatData(raw.data) : [];
            dataCache[cacheKey] = { data: rows, expiry: now + DATA_TTL_MS };
        }

        // Filtrar SOLO lado venta (AC_Vend) y por comercial específico
        let filtered = rows.filter((r: any) => r.AC_Vend && r.AC_Vend.trim() !== '');

        // Post-filtro por nombre: SOLO cuando no hay acId
        // Cuando hay acId, Q95 ya filtró por id_usuario — confiar en ese resultado
        if (!isAdmin && !acId && acName) {
            const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            const nameLower = norm(acName);
            filtered = filtered.filter((r: any) => {
                const vend = norm(r.AC_Vend);
                return vend === nameLower;
            });
        }

        const stats = computeStats(filtered, hoy);

        return NextResponse.json({ stats, _cachedAt: new Date().toISOString() });
    } catch (err: any) {
        console.warn('[PubStats] MB2 no disponible:', err.message);
        cachedToken = null; tokenExpiry = 0;
        // Devolver stats vacías en lugar de 500 para no romper el UI
        return NextResponse.json({ stats: null, error: err.message, _unavailable: true });
    }
}
