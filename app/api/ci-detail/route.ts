import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/ci-detail?id_tropa=29848
 *
 * Optimizado v3 — Q4568 ahora tiene {{id_tropa}} como parámetro en Metabase.
 * Metabase filtra directo en la DB → solo llegan las filas de esa tropa (~5-50 rows).
 * Caché por tropa: 10 minutos.
 */

const METABASE2_URL = process.env.METABASE2_URL || 'https://metabase.dcac.ar';
const METABASE2_USERNAME = process.env.METABASE2_USERNAME || 'sdewey@decampoacampo.com';
const METABASE2_PASSWORD = process.env.METABASE2_PASSWORD || 'Gallardo@25';

const SESSION_TTL = 110 * 60 * 1000; // 110 min
const DETAIL_TTL = 10 * 60 * 1000; // 10 min por tropa

// ─── Session cache ───────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExp = 0;

async function getSession(): Promise<string> {
    if (cachedToken && Date.now() < tokenExp) return cachedToken;
    const res = await fetch(`${METABASE2_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: METABASE2_USERNAME,
            password: METABASE2_PASSWORD,
        }),
        cache: 'no-store',
    });
    if (!res.ok) throw new Error('Metabase auth failed');
    const { id } = await res.json();
    cachedToken = id;
    tokenExp = Date.now() + SESSION_TTL;
    return id;
}

// ─── Row parser ──────────────────────────────────────────────────────────────
function parse(raw: any): any[] {
    const data = raw?.data ?? raw;
    const rawRows = data?.rows;
    const rawCols = data?.cols ?? data?.columns;
    if (!rawRows?.length || !rawCols?.length) return [];
    const cols = rawCols.map((c: any) => c.name ?? c);
    return rawRows.map((row: any[]) => {
        const obj: any = {};
        row.forEach((v, i) => { obj[cols[i]] = v; });
        return obj;
    });
}

// ─── Fetch Q147: detalle de sociedades para una tropa ────────────────────────
// Con filtro id_usuario: Card 147 aplica WHERE dinámico que filtra por AC comprador.
// Sin id_usuario (admin): WHERE 1=1 → devuelve TODAS las sociedades habilitadas.
async function fetchQ147ForTropa(token: string, idTropa: string, idUsuario?: string): Promise<any[]> {
    const params: any[] = [
        {
            type: 'category',
            target: ['variable', ['template-tag', 'id_tropa']],
            value: String(idTropa),
        },
    ];

    // Solo mandar id_usuario si se especificó (AC individual o vista AC)
    // Sin él, Metabase aplica WHERE 1=1 → todas las sociedades (vista admin)
    if (idUsuario && !isNaN(Number(idUsuario)) && Number(idUsuario) > 0) {
        params.push({
            type: 'category',
            target: ['variable', ['template-tag', 'id_usuario']],
            value: String(idUsuario),
        });
    }

    const body = { parameters: params };
    console.log(`[ci-detail] Card 147 id_tropa=${idTropa} id_usuario=${idUsuario ?? 'all'}`);

    // /query/json devuelve array plano y omite el cap de 2000 filas de /query
    const res = await fetch(`${METABASE2_URL}/api/card/147/query/json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Metabase-Session': token,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
    });
    if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.error(`[ci-detail] Card 147 HTTP ${res.status}:`, errBody.slice(0, 300));
        throw new Error(`Card 147 HTTP ${res.status}`);
    }
    const raw = await res.json();
    if (!Array.isArray(raw)) {
        if (raw?.error) throw new Error(raw.error);
        return [];
    }
    console.log(`[ci-detail] Card 147 id_tropa=${idTropa} id_usuario=${idUsuario ?? 'all'} → ${raw.length} sociedades`);
    return raw;
}

// ─── Deduplicar por (id_tropa, sociedad) ─────────────────────────────────────
/**
 * Múltiples CIs en la misma tropa para la misma sociedad → merge en 1 fila:
 *   rendimientos:       "5% / 6.5% / 8%"  (distintos, ordenados)
 *   oferto_ci:          MAX  (si alguna CI ofertó → true)
 *   compro_al_vendedor: MAX
 *   cant_visitas:       MAX
 *   fecha_habilitacion: MIN no-null
 *   ult_vista:          MAX (más reciente)
 *   resto:              primera fila (constantes de tropa / sociedad)
 */
function dedup(rows: any[]): any[] {
    const byKey = new Map<string, any[]>();
    for (const r of rows) {
        const key = `${r.id_tropa}||${r.id_sociedad_compradora ?? r.sociedad_compradora}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push(r);
    }

    return Array.from(byKey.values()).map(group => {
        if (group.length === 1) return group[0];

        const base = { ...group[0] };

        const rends = [...new Set(
            group.map(r => r.rendimiento_esperado).filter(v => v != null)
        )].sort((a, b) => Number(a) - Number(b));
        base.rendimientos = rends.length ? rends.map(r => `${r}%`).join(' / ') : null;

        base.oferto_ci = group.some(r => !!r.oferto_ci);
        base.compro_al_vendedor = group.some(r => !!r.compro_al_vendedor);
        base.cant_visitas = Math.max(...group.map(r => Number(r.cant_visitas ?? 0)));

        const fechasHab = group.map(r => r.fecha_habilitacion).filter(v => v && v !== '0000-00-00 00:00:00');
        base.fecha_habilitacion = fechasHab.length ? fechasHab.sort()[0] : null;

        const ultVistas = group.map(r => r.ult_vista).filter(Boolean);
        base.ult_vista = ultVistas.length ? ultVistas.sort().at(-1) : null;

        return base;
    });
}

// ─── Caché por tropa ─────────────────────────────────────────────────────────
const tropaCache = new Map<string, { data: any[]; exp: number }>();

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const idTropa = req.nextUrl.searchParams.get('id_tropa');
    const idUsuario = req.nextUrl.searchParams.get('id_usuario') ?? undefined;
    if (!idTropa) return NextResponse.json({ error: 'Falta id_tropa' }, { status: 400 });

    // Cache separada por tropa + usuario (admin ve todas; AC ve solo sus clientes)
    const cacheKey = idUsuario ? `tropa_${idTropa}_user_${idUsuario}` : `tropa_${idTropa}_all`;

    // Caché hit (10 min) — respuesta instantánea en clicks repetidos
    const hit = tropaCache.get(cacheKey);
    if (hit && Date.now() < hit.exp) {
        return NextResponse.json({ sociedades: hit.data, _cache: 'HIT', _count: hit.data.length });
    }

    try {
        const token = await getSession();
        const rawRows = await fetchQ147ForTropa(token, idTropa, idUsuario);
        const sociedades = dedup(rawRows);

        console.log(`[ci-detail] id_tropa=${idTropa} id_usuario=${idUsuario ?? 'all'}: ${rawRows.length} raw → ${sociedades.length} dedup`);

        if (!rawRows.length) {
            console.warn(`[ci-detail] Sin resultados para tropa ${idTropa} usuario ${idUsuario ?? 'all'}. Revisar filtros en Q147.`);
        }

        // Guardar en caché + limpiar entradas vencidas
        const now = Date.now();
        tropaCache.set(cacheKey, { data: sociedades, exp: now + DETAIL_TTL });
        for (const [k, v] of tropaCache.entries()) {
            if (now >= v.exp) tropaCache.delete(k);
        }

        return NextResponse.json({ sociedades, _cache: 'MISS', _count: sociedades.length });

    } catch (err: any) {
        console.error('[ci-detail] Error:', err.message);
        // Si hay datos viejos en caché los devolvemos antes que un error
        const stale = tropaCache.get(cacheKey);
        if (stale) {
            return NextResponse.json({ sociedades: stale.data, _cache: 'STALE-ERROR', _count: stale.data.length });
        }
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
