import { NextResponse } from 'next/server';

const CARD_ID_Q152 = 152;
const SESSION_TTL_MS = 110 * 60 * 1000;
const DATA_TTL_MS = 10 * 60 * 1000; // 10 min — asignaciones cambian con más frecuencia

const MB2_URL  = (process.env.METABASE2_URL      || '').trim();
const MB2_USER = (process.env.METABASE2_USERNAME  || '').trim();
const MB2_PASS = (process.env.METABASE2_PASSWORD  || '').trim();

let cachedToken: string | null = null;
let tokenExpiry = 0;
let cachedData: { data: any[]; expiry: number } | null = null;

async function getSession(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
    const res = await fetch(`${MB2_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: MB2_USER, password: MB2_PASS }),
        cache: 'no-store',
    });
    if (!res.ok) throw new Error('Fallo autenticación MB2 (asignaciones)');
    const { id: token } = await res.json();
    cachedToken = token;
    tokenExpiry = Date.now() + SESSION_TTL_MS;
    return token;
}

async function fetchQ152(idUsuario?: string): Promise<any[]> {
    const token = await getSession();

    const parameters: any[] = [];
    if (idUsuario) {
        parameters.push({
            type: 'category',
            target: ['variable', ['template-tag', 'id_usuario']],
            value: idUsuario,
        });
    }

    // MB2 usa /query/json — devuelve array plano sin cap de 2000 filas
    const res = await fetch(`${MB2_URL}/api/card/${CARD_ID_Q152}/query/json?format_rows=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
        body: JSON.stringify({ parameters }),
        cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Q152 HTTP ${res.status}`);
    const raw = await res.json();
    if (raw?.error) throw new Error(raw.error);
    if (!Array.isArray(raw)) {
        console.error('[Asignaciones] Respuesta inesperada de MB2:', JSON.stringify(raw).slice(0, 200));
        return [];
    }
    return raw;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const idUsuario = searchParams.get('id_usuario') || undefined;
        const cuit      = searchParams.get('cuit')       || undefined;
        const acFilter  = searchParams.get('ac')         || undefined;

        // Cache solo cuando no se filtra por id_usuario
        const now = Date.now();
        if (!idUsuario && cachedData && now < cachedData.expiry) {
            let items = cachedData.data;
            if (cuit)     items = items.filter(i => String(i.cuit) === cuit);
            if (acFilter) items = items.filter(i => (i.AC || '').toLowerCase().includes(acFilter.toLowerCase()));
            return NextResponse.json({ asignaciones: items, _cached: true });
        }

        const all = await fetchQ152(idUsuario);

        if (!idUsuario) {
            cachedData = { data: all, expiry: now + DATA_TTL_MS };
        }

        let items = all;
        if (cuit)     items = items.filter(i => String(i.cuit) === cuit);
        if (acFilter) items = items.filter(i => (i.AC || '').toLowerCase().includes(acFilter.toLowerCase()));

        return NextResponse.json({ asignaciones: items, total: all.length });
    } catch (err: any) {
        console.error('[Asignaciones API]', err.message);
        cachedToken = null; tokenExpiry = 0;
        return NextResponse.json({ error: err.message, asignaciones: [] }, { status: 500 });
    }
}
