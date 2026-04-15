import { NextResponse } from 'next/server';
import { readSnapshot } from '@/lib/utils/snapshot';
import { ACS_OFICINA, OFICINA_ID as _OFICINA_ID, REPRESENTANTE_OFICINA as _REP_OFICINA } from '@/lib/data/constants';
import { formatMetabaseData } from '@/lib/api/metabase-server';

// ─── Config (importado desde lib/constants.ts) ──────────────────────────────
export const OPERADORES_RIO4 = ACS_OFICINA.map(a => ({
    nombre: a.nombre, id: a.id, iniciales: a.iniciales, color: a.colorGrad,
}));

const OFICINA_ID = _OFICINA_ID;
const REPRESENTANTE_OFICINA = _REP_OFICINA;
const DATA_TTL_MS = 15 * 60 * 1000;   // Caché de datos: 15 minutos
const SESSION_TTL_MS = 110 * 60 * 1000; // Caché sesión: 110 minutos

// ─── Caché en memoria ──────────────────────────────────────────────────────
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


// ─── Helpers ──────────────────────────────────────────────────────────────


// ─── Sesión MB1 (Lotes / Ofertas) ───────────────────────────────────────────
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

// ─── Sesión MB2 (Q95 — ClickHouse) ──────────────────────────────────────────
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

// ─── Q95 (ClickHouse/MB2) — reemplaza card 4553 ──────────────────────────────
// Normaliza los campos de Q95 para que sean compatibles con el dashboard
function normalizeQ95Row(row: any): any {
    // Detectar si cada lado tiene comercial (AC o Repre) — aplica a todos los canales
    const hasVend = !!(
        (row.AC_Vend      && String(row.AC_Vend).trim())      ||
        (row.repre_vendedor && String(row.repre_vendedor).trim())
    );
    const hasComp = !!(
        (row.AC_Comp       && String(row.AC_Comp).trim())       ||
        (row.repre_comprador && String(row.repre_comprador).trim())
    );
    const res = Number(row.resultado_final) || 0;

    // Regla: si ambos lados tienen comercial → 2/3 venta + 1/3 compra
    //        si solo un lado → ese lado se lleva el 100%
    //        si ninguno      → directa, sin asignación regional
    const factorVend = hasVend ? (hasComp ? 2 / 3 : 1) : 0;
    const factorComp = hasComp ? (hasVend ? 1 / 3 : 1) : 0;

    return {
        ...row,
        // Mapeo de nombres para compatibilidad con el dashboard
        estado_general: row.ESTADO || row.estado_general || null,
        estado_tropas:  row.Estado_Trop || row.estado_tropas || null,
        // resultado_regional correcto — aplica para Repre, Comisionista y Regional (AC)
        resultado_regional_vendedor:  res * factorVend,
        resultado_regional_comprador: res * factorComp,
    };
}

async function fetchQ95(canalFilter?: string | null, targetYear?: number, acId?: string | number | null, timeframe: 'recent' | 'history' | 'all' = 'all'): Promise<any[]> {
    const token2 = await getSession2();
    if (!targetYear) targetYear = new Date().getFullYear();
    
    const fechaDesdeBase = `${targetYear - 1}-01-01`;
    const fechaDesdeRecent = `${targetYear}-01-01`; // Solo el año en curso para que el Dashboard pinte rápido

    let fechaDesde = timeframe === 'recent' ? fechaDesdeRecent : fechaDesdeBase;
    let fechaHasta = `${targetYear}-12-31`;
    let oldRows: any[] = [];

    if (timeframe !== 'recent') {
        try {
            const snap = await readSnapshot();
            if (snap && snap.cutoff_date && snap.cutoff_date >= fechaDesdeBase) {
                fechaDesde = snap.cutoff_date;
                
                // Extraer las filas del histórico y aplicar filtros locales
                let filteredSnap = snap.rows.filter(r => r.fecha_operacion >= fechaDesdeBase);

                if (canalFilter && canalFilter !== 'all') {
                    filteredSnap = filteredSnap.filter(r => r.Canal_Venta === canalFilter || r.Canal_compra === canalFilter);
                }
                if (acId) {
                    const acIdNum = Number(acId);
                    const { LINKED_AC_IDS } = await import('@/lib/data/usuarios');
                    const linkedIds = LINKED_AC_IDS?.[acIdNum] || [acIdNum];
                    filteredSnap = filteredSnap.filter((r: any) => 
                        linkedIds.some((id: number) => 
                            r.id_ac_vend === id || r.id_ac_comp === id || 
                            r.id_rep_vend === id || r.id_rep_comp === id
                        )
                    );
                }
                oldRows = filteredSnap.map(normalizeQ95Row);
            }
        } catch (err: any) {
            console.warn(`[Q95] Fallo al leer snapshot: ${err.message}. Buscando todo en Metabase.`);
        }
    }

    // Para la carga progresiva, si piden solo historia (history) devolvemos inmediatamente el snapshot viejo sin castigar a Metabase
    if (timeframe === 'history') {
        if (oldRows.length > 0) {
            return oldRows;
        }
        // Fallback: si no hay snapshot (ej. local o borrado), consultamos a Metabase SOLO por el año anterior
        fechaDesde = `${targetYear - 1}-01-01`;
        fechaHasta = `${targetYear - 1}-12-31`;
        // En el fallback de history también normalizamos al retornar
    }

    const params: any[] = [
        { type: 'category', target: ['variable', ['template-tag', 'fecha_desde']], value: fechaDesde },
        { type: 'category', target: ['variable', ['template-tag', 'fecha_hasta']], value: fechaHasta }
    ];
    // Solo filtrar por canal cuando NO hay acId específico.
    // Si hay acId, el filtro id_usuario es suficiente y cubre todas las tropas
    // del comercial sin importar el canal con el que operó en cada tropa.
    if (canalFilter && !acId) {
        params.push({ type: 'string/=', target: ['variable', ['template-tag', 'canal']], value: canalFilter });
    }
    if (acId) {
        const acIdNum = Number(acId);
        // Verificar si este AC tiene IDs vinculados (ej: Simon De Aduriz opera con 48871 y 306)
        const { LINKED_AC_IDS } = await import('@/lib/data/usuarios');
        const linkedIds = LINKED_AC_IDS[acIdNum];
        if (linkedIds && linkedIds.length > 1) {
            // Pasar array de IDs — el field filter id_usuario de Q95 acepta múltiples valores
            params.push({ type: 'category', target: ['dimension', ['template-tag', 'id_usuario']], value: linkedIds });
        } else {
            params.push({ type: 'category', target: ['variable', ['template-tag', 'id_usuario']], value: String(acId) });
        }
    }

    // Usamos /query/json — devuelve array JSON plano sin el cap de 2000 filas del endpoint /query
    console.time('Q95_mb_fetch');
    const res = await fetch(`${process.env.METABASE2_URL}/api/card/95/query/json?format_rows=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token2 },
        body: JSON.stringify({ parameters: params }),
        cache: 'no-store',
    });
    console.timeEnd('Q95_mb_fetch');
    if (!res.ok) throw new Error(`Q95 HTTP ${res.status}`);
    const data: any[] = await res.json();
    if (!Array.isArray(data)) throw new Error(`Q95: respuesta inesperada`);
    
    const recientesNormalizadas = data.map(normalizeQ95Row);
    const todasLasTropas = [...oldRows, ...recientesNormalizadas];
    return todasLasTropas;

}




async function getGlobalRaw(token: string) {
    const now = Date.now();
    if (globalRawCache.lotes && now < globalRawCache.expiry) {
        return { lotes: globalRawCache.lotes, ofertas: globalRawCache.ofertas! };
    }
    
    // In background o wait
    if (!globalRawCache.isRefreshing) {
        globalRawCache.isRefreshing = true;
        Promise.all([
            fetchCard(155, token), // Publicaciones (Metabase 2)
            fetchCard(128, token)  // Ofertas INV (Metabase 2)
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
    
    // Primera vez EVER, esperamos
    console.time('C155_mb_fetch');
    const fetch155 = fetchCard(155, token).finally(() => console.timeEnd('C155_mb_fetch'));
    console.time('C128_mb_fetch');
    const fetch128 = fetchCard(128, token).finally(() => console.timeEnd('C128_mb_fetch'));
    
    const [lotes, ofertas] = await Promise.all([
        fetch155,
        fetch128
    ]);
    globalRawCache.lotes = lotes;
    globalRawCache.ofertas = ofertas;
    globalRawCache.expiry = now + DATA_TTL_MS;
    globalRawCache.isRefreshing = false;
    return { lotes, ofertas };
}

async function getUserRaw(token: string, acId: string | number) {
    // Para un AC específico, usamos el filtro por ID ('usuario_id') en Metabase para traer solo sus datos
    const [lotes, ofertas] = await Promise.all([
        fetchCard(155, token, acId, 'id_usuario').catch(() => []),
        fetchCard(128, token, acId, 'usuario_id').catch(() => [])
    ]);
    return { lotes, ofertas };
}

function mapMetabaseLote(op: any) {
    return {
        ...op,
        id: op.id_lote || op.id || 0,
        categoria: op.categoria || op.Tipo || op.UN || 'S/D',
        peso: Number(op.kg) || 0,
        cabezas: Number(op.Cabezas || op.cabezas) || 0,
        raza: op.raza || '—',
        sociedad_vendedora: op.RS_Vendedora || op.sociedad_vendedora || '—',
        representante: op.repre_vendedor || op.representante || '—',
        operador: op.AC_Vend || op.usuario_op || op.usuario_acotz || op.operador || '—',
        vendedor_ac: op.AC_Vend || op.asociado_comercial || '—',
        comprador_ac: op.AC_Comp || '—',
        asociado_comercial: op.AC_Vend || op.asociado_comercial || '—',
        provincia: (op.origen || op.provincia || '').split(',').pop()?.trim() || '—',
        localidad: (op.origen || op.localidad || '').split(',')[0]?.trim() || '—',
        dia_hora_publicacion: op.fecha_publicaciones || op.fecha_operacion || op.dia_hora_publicacion || new Date().toISOString(),
        Estado_Pub: op.Estado_Trop || op.estado_tropas || op.ESTADO || op.Estado_Pub || 'Publicado',
    };
}


export async function fetchAndProcess(
    acId: string | null,
    acName: string | null,
    isAdminRequest: boolean = false,
    acIds?: string | null,   // canal-level: "id1,id2,id3"
    acNames?: string | null,  // canal-level: "Nombre1,Nombre2"
    canalFilter?: string | null,
    targetYear?: number,
    timeframe: 'recent' | 'history' | 'all' = 'all'
): Promise<any> {
    const token = await getSession();

    // ── Canal-level: múltiples IDs (oficina) ──────────────────────────────
    if (acIds) {
        const names = acNames ? acNames.split(',').filter(Boolean) : [];
        const namesSet = new Set(names.map(n => n.toLowerCase()));

        // El acName puede ser "Oficina Rio 4to" (una sola oficina seleccionada)
        // o una lista de miembros (cuando se filtra por canal "Oficina" general)
        // Para oficinas específicas, filtramos por Oficina_Venta / Oficina_Compra
        // que es exactamente lo que usa Power BI y evita incluir ops donde
        // los miembros actúan como representantes de clientes externos.
        const oficinaNombre = names.find(n => n.toLowerCase().startsWith('oficina'))?.trim() ?? null;

        const getLotesGlobalesPromise = timeframe === 'history' ? Promise.resolve({ lotes: [], ofertas: [] }) : getGlobalRaw(token);

        const [{ lotes: rawLotes, ofertas: rawOfertas }, rawOpsAll] = await Promise.all([
            getLotesGlobalesPromise,
            fetchQ95(null, targetYear, null, timeframe).catch(e => { console.error('Error fetchQ95 oficina:', e.message); return []; }),
        ]);

        const rawOpsOficina = rawOpsAll.filter((r: any) => {
            if (oficinaNombre) {
                // Oficina específica → filtrar por campos Oficina_Venta / Oficina_Compra (igual que Power BI)
                const ov = (r.Oficina_Venta || '').toLowerCase().trim();
                const oc = (r.Oficina_Compra || '').toLowerCase().trim();
                return ov === oficinaNombre.toLowerCase() || oc === oficinaNombre.toLowerCase();
            } else {
                // Canal "Oficina" general → filtrar por miembros (AC_Vend/AC_Comp exacto)
                const vend = (r.AC_Vend || '').toLowerCase().trim();
                const comp = (r.AC_Comp || '').toLowerCase().trim();
                const reprVend = (r.repre_vendedor || '').toLowerCase().trim();
                const reprComp = (r.repre_comprador || '').toLowerCase().trim();
                for (const n of namesSet) {
                    if (n.startsWith('oficina')) { if (reprVend === n || reprComp === n) return true; }
                    else {
                        const fn = n.split(' ')[0] || n;
                        if ((vend && (vend === n || vend.includes(fn))) || (comp && (comp === n || comp.includes(fn)))) return true;
                        if ((reprVend && reprVend.includes(fn)) || (reprComp && reprComp.includes(fn))) return true;
                    }
                }
                return false;
            }
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

    // ── Single AC o admin global ────────────────────────────────────────────
    
    // 3 queries esenciales para el Dashboard principal. Las dos primeras son masivas y globales (o específicas si hay acId)
    const acIdNum = acId ? parseInt(acId, 10) : undefined;
    
    // Si solicitan 'history', no requerimos Lotes/Ofertas nuevos
    const rawPromise = timeframe === 'history' 
        ? Promise.resolve({ lotes: [], ofertas: [] }) 
        : (acId ? getUserRaw(token, acId) : getGlobalRaw(token));

    const [{ lotes: rawLotes, ofertas: rawOfertas }, rawOpsAll] = await Promise.all([
        rawPromise,
        fetchQ95(canalFilter, targetYear, acIdNum, timeframe).catch(e => { console.error('Error fetchQ95 global:', e.message); return []; }),
    ]);
    
    // Post-filtrado por nombre: SOLO cuando no hay acId
    // Cuando hay acId, Q95 ya filtró por id_usuario — confiar en ese resultado
    let rawOpsOficina = rawOpsAll;
    if (acName && !acId) {
        const lowerName = acName.toLowerCase().trim();
        const isOficinaName = lowerName.startsWith('oficina');
        
        rawOpsOficina = rawOpsAll.filter((r: any) => {
            const vend = (r.AC_Vend || '').toLowerCase().trim();
            const comp = (r.AC_Comp || '').toLowerCase().trim();
            const reprVend = (r.repre_vendedor || '').toLowerCase().trim();
            const reprComp = (r.repre_comprador || '').toLowerCase().trim();

            if (isOficinaName) return reprVend === lowerName || reprComp === lowerName;
            
            // Match exacto por nombre completo (sin flex por primera palabra)
            const acMatch = (vend && vend === lowerName) || (comp && comp === lowerName);
            const reprMatch = (reprVend && reprVend === lowerName) || (reprComp && reprComp === lowerName);
            return acMatch || reprMatch;
        });
    }

    if (rawOfertas.length) {
        console.log('--- OFERTAS COLS ---', Object.keys(rawOfertas[0]));
    }
    // Filtrar lotes por oficina o de forma estricta por AC
    const nombresOp = new Set(OPERADORES_RIO4.map(o => o.nombre.toLowerCase()));

    // Nombres reales de ACs que aparecen en las ops de Metabase (más confiable que el nombre local)
    // Cuando hay acId, la card ya filtró por ID — usamos los nombres que devuelve para matchear lotes
    const actualAcNamesFromOps = new Set<string>();
    if (acId) {
        rawOpsOficina.forEach((o: any) => {
            if (o.AC_Vend) actualAcNamesFromOps.add((o.AC_Vend as string).trim().toLowerCase());
            if (o.AC_Comp) actualAcNamesFromOps.add((o.AC_Comp as string).trim().toLowerCase());
        });
    }

    // Lotes propios para KPIs y Dashboard
    const mappedRawLotes = rawLotes.map(mapMetabaseLote);
    const lotesPropios = mappedRawLotes.filter((l: any) => {
        if (isAdminRequest) return true;
        // Si acId está presente, rawLotes ya viene filtrado desde Metabase por getUserRaw
        if (acId) return true;
        
        if (acName) {
            const lowerName = acName.toLowerCase().trim();
            const isOficinaName = lowerName.startsWith('oficina');
            
            const vend = (l.vendedor_ac || l.asociado_comercial || '').toLowerCase().trim();
            const comp = (l.comprador_ac || '').toLowerCase().trim();
            const rep = (l.representante || '').toLowerCase().trim();
            const op = (l.operador || '').toLowerCase().trim();

            if (isOficinaName) {
                return rep === lowerName || vend === lowerName || comp === lowerName || op === lowerName;
            }

            // Match exacto (sin flex por primera palabra) para evitar cruces de datos
            const acMatch = vend === lowerName || comp === lowerName || op === lowerName;
            const reprMatch = rep === lowerName;
            return acMatch || reprMatch;
        }
        const rep = (l.representante || '').trim();
        const op = (l.operador || '').trim();
        return rep === REPRESENTANTE_OFICINA || nombresOp.has(op.toLowerCase());
    });

    // Para "Publicaciones" quieren ver TODOS los lotes globales.
    const lotesGlobales = mappedRawLotes;

    // Cruzar ofertas:
    // ¿Qué ofertas ve un usuario?
    // - Si es administrador (acName = null): Ve TODAS las ofertas.
    // - Si es comercial: Ve todas las ofertas sobre SUS PROPIOS lotes, Y también las ofertas que hicieron SUS CLIENTES en cualquier lote global.
    const idsLotesPropios = new Set(lotesPropios.map((l: any) => String(l.id)));
    
    const ofertasPermitidas = rawOfertas.filter((o: any) => {
        if (!acName) return true; // admin ve todo
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

    // Para empatar matemáticamente con "Estado Tropas", no descartamos basura ni ex-comerciales 
    // en la vista "Todos los Canales". Todo lo que viene de Q95 tributa al sumario maestro.
    const opsPermitidas = rawOpsOficina;

    return {
        lotes: lotesPropios, // Lotes del comercial para sus KPIs
        lotesGlobales: lotesGlobalesConOfertas, // Lotes de todo el sistema para la pestaña Publicaciones
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
    targetYear?: number,
    timeframe: 'recent' | 'history' | 'all' = 'all'
) {
    if (dataCaches[cacheKey]?.isRefreshing) return;
    
    if (!dataCaches[cacheKey]) {
        dataCaches[cacheKey] = { data: null, expiry: 0, isRefreshing: true };
    } else {
        dataCaches[cacheKey].isRefreshing = true;
    }

    try {
        const fresh = await fetchAndProcess(acId, acName, isAdminRequest, acIds, acNames, canal, targetYear, timeframe);
        dataCaches[cacheKey] = {
            data: fresh,
            expiry: Date.now() + DATA_TTL_MS,
            isRefreshing: false
        };
        console.log(`[Regional] Cache refreshed for ${cacheKey} at`, fresh._cachedAt);
    } catch (e: any) {
        dataCaches[cacheKey].isRefreshing = false;
        console.error(`[Regional] Background refresh failed for ${cacheKey}:`, e.message);
    }
}

// ─── Handler ──────────────────────────────────────────────────────────────
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const isAdmin = searchParams.get('isAdmin') === 'true';
        const acIds  = searchParams.get('acIds');   // canal-level: "id1,id2,..."
        const acNames = searchParams.get('acNames'); // canal-level: "Nombre1,Nombre2,..."
        
        const canal = searchParams.get('canal');

        const targetYear = searchParams.get('year') ? parseInt(searchParams.get('year') as string, 10) : new Date().getFullYear();
        const timeframe = (searchParams.get('timeframe') as 'recent' | 'history' | 'all') || 'all';

        const acId = !acIds ? searchParams.get('acId') : null;
        const acName = !acIds ? searchParams.get('acName') : null;
        const forceRefresh = searchParams.get('forceRefresh') === 'true';
        
        const cacheKeyBase = acIds
            ? `canal_${acIds.split(',').sort().join('_')}_${targetYear}`
            : acId ? `ac_${acId}_${targetYear}_${canal || ''}` : `global_${targetYear}_${canal || ''}`;
        
        const cacheKey = `${cacheKeyBase}_${timeframe}`;

        const now = Date.now();
        const cacheEntry = dataCaches[cacheKey];

        if (!forceRefresh && cacheEntry?.data && now < cacheEntry.expiry) {
            return NextResponse.json(cacheEntry.data, {
                headers: {
                    'X-Cache': 'HIT',
                    'X-Cache-Strategy': 'In-Memory',
                },
            });
        }

        if (cacheEntry?.data && now >= cacheEntry.expiry) {
            refreshInBackground(cacheKey, acId, acName, isAdmin, acIds, acNames, canal, targetYear, timeframe);
            return NextResponse.json(cacheEntry.data, {
                headers: { 'X-Cache': 'STALE', 'X-Revalidating': 'true' },
            });
        }

        const t0 = Date.now();
        const fresh = await fetchAndProcess(acId, acName, isAdmin, acIds, acNames, canal, targetYear, timeframe);
        const ms = Date.now() - t0;
        
        dataCaches[cacheKey] = {
            data: fresh,
            expiry: now + DATA_TTL_MS,
            isRefreshing: false
        };

        return NextResponse.json(fresh, {
            headers: { 
                'X-Cache-Strategy': 'In-Memory Miss / Snapshot Merge',
                'X-Response-Time-Ms': String(ms)
            },
        });

    } catch (err: any) {
        console.error('[Rio4 API]', err.message);
        // Limpiar token si hay error de auth
        cachedToken = null;
        tokenExpiry = 0;

        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
