import { ACS_OFICINA, OFICINA_ID as _OFICINA_ID, REPRESENTANTE_OFICINA as _REP_OFICINA } from '@/lib/data/constants';
import { formatMetabaseData } from '@/lib/api/metabase-server';

export const OPERADORES_RIO4 = ACS_OFICINA.map(a => ({
    nombre: a.nombre, id: a.id, iniciales: a.iniciales, color: a.colorGrad,
}));

const OFICINA_ID = _OFICINA_ID;
const REPRESENTANTE_OFICINA = _REP_OFICINA;
const DATA_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 110 * 60 * 1000;

let cachedToken: string | null = null;
let tokenExpiry = 0;

interface CacheEntry {
    data: any;
    expiry: number;
    isRefreshing: boolean;
}
let dataCaches: Record<string, CacheEntry> = {};

let globalRawCache: {
    lotes: any[] | null;
    ofertas: any[] | null;
    expiry: number;
    isRefreshing: boolean;
} = { lotes: null, ofertas: null, expiry: 0, isRefreshing: false };

async function getSession(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
    const sessionRes = await fetch(`${process.env.METABASE_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: process.env.METABASE_USERNAME, password: process.env.METABASE_PASSWORD }),
        cache: 'no-store',
    });
    if (!sessionRes.ok) throw new Error('Fallo autenticación Metabase');
    const { id: token } = await sessionRes.json();
    cachedToken = token;
    tokenExpiry = Date.now() + SESSION_TTL_MS;
    return token;
}

let cachedToken2: string | null = null;
let tokenExpiry2 = 0;
async function getSession2(): Promise<string> {
    if (cachedToken2 && Date.now() < tokenExpiry2) return cachedToken2;
    const sessionRes = await fetch(`${(process.env.METABASE2_URL || '').trim()}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: (process.env.METABASE2_USERNAME || '').trim(),
            password: (process.env.METABASE2_PASSWORD || '').trim(),
        }),
        cache: 'no-store',
    });
    if (!sessionRes.ok) throw new Error('Fallo autenticación Metabase2');
    const { id: token } = await sessionRes.json();
    cachedToken2 = token;
    tokenExpiry2 = Date.now() + SESSION_TTL_MS;
    return token;
}

async function fetchCard(cardId: number, sessionToken: string, paramValue?: string | number, paramName: string = 'filtro_usuario'): Promise<any[]> {
    const body: any = {
        constraints: { 'max-results': 1_000_000 },
    };
    if (paramValue !== undefined) {
        body.parameters = [{ type: 'category', target: ['variable', ['template-tag', paramName]], value: String(paramValue) }];
    }
    const res = await fetch(`${process.env.METABASE_URL}/api/card/${cardId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': sessionToken },
        body: JSON.stringify(body),
        cache: 'no-store',
    });
    const raw = await res.json();
    if (raw.error) throw new Error(raw.error);
    let data: any[] | null = null;
    if (raw.data) data = formatMetabaseData(raw.data);
    else if (raw.rows) data = formatMetabaseData(raw);
    return data || [];
}

function normalizeQ95Row(row: any): any {
    return {
        ...row,
        estado_general: row.ESTADO || row.estado_general || null,
        estado_tropas:  row.Estado_Trop || row.estado_tropas || null,
        resultado_regional_vendedor:
            (row.AC_Vend && String(row.AC_Vend).trim()) ||
            (row.repre_vendedor && String(row.repre_vendedor).includes('Oficina'))
                ? (Number(row.resultado_final) || 0) * (2 / 3)
                : 0,
        resultado_regional_comprador:
            (row.AC_Comp && String(row.AC_Comp).trim()) ||
            (row.repre_comprador && String(row.repre_comprador).includes('Oficina'))
                ? (Number(row.resultado_final) || 0) * (1 / 3)
                : 0,
    };
}

async function fetchQ95(canalFilter?: string | null, targetYear?: number): Promise<any[]> {
    const token2 = await getSession2();
    if (!targetYear) targetYear = new Date().getFullYear();
    const fechaDesde = `${targetYear - 1}-01-01`;
    const fechaHasta = `${targetYear}-12-31`;

    const params: any[] = [
        { type: 'date/single', target: ['variable', ['template-tag', 'fecha_desde']], value: fechaDesde },
        { type: 'date/single', target: ['variable', ['template-tag', 'fecha_hasta']], value: fechaHasta }
    ];
    if (canalFilter) {
        params.push({ type: 'string/=', target: ['variable', ['template-tag', 'canal']], value: canalFilter });
    }

    const res = await fetch(`${process.env.METABASE2_URL}/api/card/95/query/json?format_rows=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token2 },
        body: JSON.stringify({ parameters: params }),
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Q95 HTTP ${res.status}`);
    const data: any[] = await res.json();
    if (!Array.isArray(data)) throw new Error(`Q95: respuesta inesperada`);
    return data.map(normalizeQ95Row);
}

async function getGlobalRaw(token: string) {
    const now = Date.now();
    if (globalRawCache.lotes && now < globalRawCache.expiry) {
        return { lotes: globalRawCache.lotes, ofertas: globalRawCache.ofertas! };
    }
    
    if (!globalRawCache.isRefreshing) {
        globalRawCache.isRefreshing = true;
        Promise.all([
            fetchCard(127, token),
            fetchCard(128, token)
        ]).then(([lotes, ofertas]) => {
            globalRawCache.lotes = lotes;
            globalRawCache.ofertas = ofertas;
            globalRawCache.expiry = Date.now() + DATA_TTL_MS;
            globalRawCache.isRefreshing = false;
        }).catch(e => {
            globalRawCache.isRefreshing = false;
            console.error("[Rio4] Error al actualizar globalRawCache en background:", e);
        });
    }

    if (globalRawCache.lotes) {
        return { lotes: globalRawCache.lotes, ofertas: globalRawCache.ofertas! };
    }
    
    const [lotes, ofertas] = await Promise.all([
        fetchCard(4635, token),
        fetchCard(4637, token)
    ]);
    globalRawCache.lotes = lotes;
    globalRawCache.ofertas = ofertas;
    globalRawCache.expiry = now + DATA_TTL_MS;
    globalRawCache.isRefreshing = false;
    return { lotes, ofertas };
}

async function getUserRaw(token: string, acId: string | number) {
    const [lotes, ofertas] = await Promise.all([
        fetchCard(127, token, acId, 'usuario_id').catch(() => []),
        fetchCard(128, token, acId, 'usuario_id').catch(() => [])
    ]);
    return { lotes, ofertas };
}

export async function fetchAndProcess(
    acId: string | null,
    acName: string | null,
    isAdminRequest: boolean = false,
    acIds?: string | null,
    acNames?: string | null,
    canalFilter?: string | null,
    targetYear?: number
): Promise<any> {
    const token = await getSession();

    const isOficinaCanal = canalFilter === 'Oficina';
    const isDirectoCanal = canalFilter === 'Directo';
    const q95Canal = (isOficinaCanal || isDirectoCanal) ? null : canalFilter;

    if (acIds) {
        const ids = acIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
        const names = acNames ? acNames.split(',').filter(Boolean) : [];
        const namesSet = new Set(names.map(n => n.toLowerCase()));

        const [{ lotes: rawLotes, ofertas: rawOfertas }, rawOpsAll] = await Promise.all([
            getGlobalRaw(token),
            fetchQ95(q95Canal, targetYear).catch(e => { console.error('Error fetchQ95 canal:', e.message); return []; }),
        ]);

        const rawOpsOficina = rawOpsAll.filter((r: any) => {
            const vend = (r.AC_Vend || '').toLowerCase().trim();
            const comp = (r.AC_Comp || '').toLowerCase().trim();
            const reprVend = (r.repre_vendedor || '').toLowerCase().trim();
            const reprComp = (r.repre_comprador || '').toLowerCase().trim();
            
            for (const n of namesSet) {
                const isOficinaName = n.startsWith('oficina');
                if (isOficinaName) {
                    if (reprVend === n || reprComp === n) return true;
                } else {
                    const reprMatch = (reprVend && reprVend.includes(n)) || (reprComp && reprComp.includes(n));
                    const acMatch = (vend && (vend === n || vend.includes(n))) ||
                                    (comp && (comp === n || comp.includes(n)));
                    if (acMatch || reprMatch) return true;
                }
            }
            return false;
        });

        const lotesPropios = rawLotes.filter((l: any) => {
            if (namesSet.size === 0) return false;
            return namesSet.has((l.vendedor_ac || '').toLowerCase()) || namesSet.has((l.comprador_ac || '').toLowerCase());
        });

        const idsLotesPropios = new Set(lotesPropios.map((l: any) => String(l.id)));
        const ofertasPermitidas = rawOfertas.filter((o: any) => idsLotesPropios.has(String(o.id_lote)));
        const ofertasPorLote: Record<string, any[]> = {};
        ofertasPermitidas.forEach((o: any) => {
            const k = String(o.id_lote);
            if (!ofertasPorLote[k]) ofertasPorLote[k] = [];
            ofertasPorLote[k].push(o);
        });

        const lotesGlobalesConOfertas = rawLotes.map((l: any) => ({
            ...l,
            ofertas: ofertasPorLote[String(l.id)] || [],
            cant_ofertas: (ofertasPorLote[String(l.id)] || []).length,
        }));

        return {
            lotes: lotesPropios,
            lotesGlobales: lotesGlobalesConOfertas,
            ofertas: ofertasPermitidas,
            opsOficina: rawOpsOficina,
            operadores: OPERADORES_RIO4,
            _cachedAt: new Date().toISOString(),
        };
    }

    const paramId = acId ? parseInt(acId, 10) : undefined;

    const [{ lotes: rawLotes, ofertas: rawOfertas }, rawOpsAll] = await Promise.all([
        acId ? getUserRaw(token, acId) : getGlobalRaw(token),
        fetchQ95(q95Canal, targetYear).catch(e => { console.error('Error fetchQ95 global:', e.message); return []; }),
    ]);
    
    let rawOpsOficina = rawOpsAll;
    if (acName) {
        const lowerName = acName.toLowerCase().trim();
        const isOficinaName = lowerName.startsWith('oficina');
        
        rawOpsOficina = rawOpsAll.filter((r: any) => {
            const vend = (r.AC_Vend || '').toLowerCase().trim();
            const comp = (r.AC_Comp || '').toLowerCase().trim();
            const reprVend = (r.repre_vendedor || '').toLowerCase().trim();
            const reprComp = (r.repre_comprador || '').toLowerCase().trim();

            if (isOficinaName) return reprVend === lowerName || reprComp === lowerName;
            
            const reprMatch = (reprVend && reprVend.includes(lowerName)) || (reprComp && reprComp.includes(lowerName));
            const acMatch = (vend && (vend === lowerName || vend.includes(lowerName))) ||
                            (comp && (comp === lowerName || comp.includes(lowerName)));
            return acMatch || reprMatch;
        });
    }

    if (rawOfertas.length) {
        console.log('--- OFERTAS COLS ---', Object.keys(rawOfertas[0]));
    }
    const nombresOp = new Set(OPERADORES_RIO4.map(o => o.nombre.toLowerCase()));

    const actualAcNamesFromOps = new Set<string>();
    if (acId) {
        rawOpsOficina.forEach((o: any) => {
            if (o.AC_Vend) actualAcNamesFromOps.add((o.AC_Vend as string).trim().toLowerCase());
            if (o.AC_Comp) actualAcNamesFromOps.add((o.AC_Comp as string).trim().toLowerCase());
        });
    }

    const lotesPropios = rawLotes.filter((l: any) => {
        if (isAdminRequest) return true;
        if (acId) return true;
        
        if (acName) {
            return l.vendedor_ac === acName || l.comprador_ac === acName;
        }
        const rep = (l.representante || '').trim();
        const op = (l.operador || '').trim();
        return rep === REPRESENTANTE_OFICINA || nombresOp.has(op.toLowerCase());
    });

    const lotesGlobales = rawLotes;

    const idsLotesPropios = new Set(lotesPropios.map((l: any) => String(l.id)));
    
    const ofertasPermitidas = rawOfertas.filter((o: any) => {
        if (!acName) return true;
        const esMiLote = idsLotesPropios.has(String(o.id_lote));
        const miClienteOferto = o.operador === acName;
        return esMiLote || miClienteOferto;
    });

    const ofertasPorLote: Record<string, any[]> = {};
    ofertasPermitidas.forEach((o: any) => {
        const k = String(o.id_lote);
        if (!ofertasPorLote[k]) ofertasPorLote[k] = [];
        ofertasPorLote[k].push(o);
    });

    const lotesGlobalesConOfertas = lotesGlobales.map((l: any) => ({
        ...l,
        ofertas: ofertasPorLote[String(l.id)] || [],
        cant_ofertas: (ofertasPorLote[String(l.id)] || []).length,
    }));

    const opsPermitidas = rawOpsOficina;

    return {
        lotes: lotesPropios,
        lotesGlobales: lotesGlobalesConOfertas,
        ofertas: ofertasPermitidas,
        opsOficina: opsPermitidas,
        operadores: OPERADORES_RIO4,
        _cachedAt: new Date().toISOString(),
    };
}

async function refreshInBackground(
    cacheKey: string,
    acId: string | null,
    acName: string | null,
    isAdminRequest: boolean = false,
    acIds?: string | null,
    acNames?: string | null,
    canal?: string | null,
    targetYear?: number
) {
    if (dataCaches[cacheKey]?.isRefreshing) return;
    
    if (!dataCaches[cacheKey]) {
        dataCaches[cacheKey] = { data: null, expiry: 0, isRefreshing: true };
    } else {
        dataCaches[cacheKey].isRefreshing = true;
    }

    try {
        const fresh = await fetchAndProcess(acId, acName, isAdminRequest, acIds, acNames, canal, targetYear);
        dataCaches[cacheKey] = {
            data: fresh,
            expiry: Date.now() + DATA_TTL_MS,
            isRefreshing: false
        };
        console.log(`[Rio4] Cache refreshed for ${cacheKey} at`, fresh._cachedAt);
    } catch (e: any) {
        dataCaches[cacheKey].isRefreshing = false;
        console.error(`[Rio4] Background refresh failed for ${cacheKey}:`, e.message);
    }
}

export async function getDashboardData(searchParams: URLSearchParams, forceRefresh = false) {
    try {
        const isAdmin = searchParams.get('isAdmin') === 'true';
        const acIds  = searchParams.get('acIds');
        const acNames = searchParams.get('acNames');
        const canal = searchParams.get('canal');
        const targetYear = searchParams.get('year') ? parseInt(searchParams.get('year') as string, 10) : new Date().getFullYear();
        const acId = !acIds ? searchParams.get('acId') : null;
        const acName = !acIds ? searchParams.get('acName') : null;
        
        const cacheKey = acIds
            ? `canal_${acIds.split(',').sort().join('_')}_${targetYear}`
            : acId ? `ac_${acId}_${targetYear}` : `global_${targetYear}`;

        const now = Date.now();
        const cacheEntry = dataCaches[cacheKey];

        if (!forceRefresh && cacheEntry?.data && now < cacheEntry.expiry) {
            return {
                data: cacheEntry.data,
                status: 'HIT',
                ageHeader: String(Math.round((now - new Date(cacheEntry.data._cachedAt).getTime()) / 1000)) + 's'
            };
        }

        if (cacheEntry?.data && now >= cacheEntry.expiry) {
            refreshInBackground(cacheKey, acId, acName, isAdmin, acIds, acNames, canal, targetYear);
            return { data: cacheEntry.data, status: 'STALE', revalidating: true };
        }

        const fresh = await fetchAndProcess(acId, acName, isAdmin, acIds, acNames, canal, targetYear);
        dataCaches[cacheKey] = {
            data: fresh,
            expiry: now + DATA_TTL_MS,
            isRefreshing: false
        };

        return { data: fresh, status: 'MISS' };
    } catch (err: any) {
        cachedToken = null;
        tokenExpiry = 0;
        throw err;
    }
}
