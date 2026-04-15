import { NextResponse } from 'next/server';
import { ACS_OFICINA, OFICINA_ID as _OFICINA_ID } from '@/lib/data/constants';
import { formatMetabaseData } from '@/lib/api/metabase-server';
import fs from 'fs';
import path from 'path';

const OFICINA_ID = _OFICINA_ID;
const DATA_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 110 * 60 * 1000;
const GS_TTL_MS = 60 * 60 * 1000; // 1 hora

const METABASE_URL = (process.env.METABASE_URL || '').trim();
const METABASE_USERNAME = (process.env.METABASE_USERNAME || '').trim();
const METABASE_PASSWORD = (process.env.METABASE_PASSWORD || '').trim();
const METABASE2_URL = (process.env.METABASE2_URL || 'https://metabase.dcac.ar').trim();
const METABASE2_USERNAME = (process.env.METABASE2_USERNAME || '').trim();
const METABASE2_PASSWORD = (process.env.METABASE2_PASSWORD || '').trim();

// Google Sheets — planilla con datos crediticios
const CREDIT_SHEET_ID    = '16QnVp-Sl1Q8sfQh4kQPep55bmAN1zrT5AWz3XpSeqwU';
const CREDIT_PERF_GID    = '1514823656'; // Tab: Credit Performance (NOSIS, FACT, JD)
const BASE_CLAVE_GID     = '530222821';  // Tab: Base Clave (K, Kv, PorcU)

// Google Sheets — planilla SACs (aprobaciones)
const SAC_SHEET_ID       = '1bxZGicvfQaAebCtBuzP53064whf-Ir2_RmJBQkRBrxU';
const SAC_GID            = '610073088';  // Tab: SACs (col R=CUIT, col V=Respuesta, col W=Crédito)

// ─── Caché en memoria ──────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry = 0;
let cachedTokenMB2: string | null = null;
let tokenExpiryMB2 = 0;

interface CacheEntry {
    data: any;
    expiry: number;
    isRefreshing: boolean;
}
let dataCaches: Record<string, CacheEntry> = {};

// Caché Google Sheet
let gsCache: Record<string, any> | null = null;
let gsCacheExpiry = 0;

// Caché BC estático
let bcFullCache: Record<string, any> | null = null;

// ─── Google Sheets ──────────────────────────────────────────────────────────
async function fetchGoogleSheetData(): Promise<Record<string, any>> {
    const now = Date.now();
    if (gsCache && now < gsCacheExpiry) return gsCache;

    try {
        const googleKey  = (process.env.Google_key  || '').trim();
        const googleMail = (process.env.Google_mail || '').trim();
        if (!googleKey || !googleMail) {
            console.warn('[Secundario] Google_key o Google_mail no configurados, sin datos crediticios');
            return {};
        }

        const { google } = await import('googleapis');
        const privateKey = googleKey.replace(/\\n/g, '\n');
        const auth = new google.auth.JWT({
            email: googleMail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });
        const sheets = google.sheets({ version: 'v4', auth });

        // Resolver GIDs → nombres reales de tabs (planilla Credit Performance)
        const meta = await sheets.spreadsheets.get({ spreadsheetId: CREDIT_SHEET_ID });
        const sheetsList = meta.data.sheets || [];
        const getSheetName = (gid: string, shList: any[]): string | null => {
            const s = shList.find((s: any) => String(s.properties?.sheetId) === gid);
            return s?.properties?.title || null;
        };

        const creditPerfName = getSheetName(CREDIT_PERF_GID, sheetsList);

        if (!creditPerfName) console.error(`[Secundario] Tab Credit Performance no encontrado (GID ${CREDIT_PERF_GID})`);

        const result: Record<string, any> = {};

        // ── 1. Credit Performance: gs_nosis (col AL), gs_fact (col AH), gs_credito_jd (col AU) ──
        if (creditPerfName) {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: CREDIT_SHEET_ID,
                range: `${creditPerfName}!A:AU`,
            });
            const rows = res.data.values || [];
            if (rows.length >= 2) {
                const headers = rows[0].map((h: string) => String(h || '').trim().toUpperCase());
                // CUIT: hay 2 cols con ese nombre — usamos la última (idx ~45, junto a JD HABILITADA)
                const idxCuit    = headers.reduce((last: number, h: string, i: number) => h === 'CUIT' ? i : last, -1);
                // NOSIS REAL: match exacto para no capturar "DELTA NOSIS SEM" u otras variantes
                const idxNosis   = headers.findIndex((h: string) => h === 'NOSIS REAL');
                const idxFact    = headers.findIndex((h: string) => h.includes('FACT ESTIMADA') || h === 'FACT');
                const idxCredito = headers.findIndex((h: string) => h.includes('JD HABILITADA') || h.includes('JD HAB'));

                console.log(`[Secundario] Credit Performance cols: CUIT=${idxCuit}("${headers[idxCuit]}") NOSIS=${idxNosis}("${headers[idxNosis]}") FACT=${idxFact}("${headers[idxFact]}") JD=${idxCredito}("${headers[idxCredito]}")`);
                // Dump de headers alrededor de las cols esperadas (AH=33, AL=37, AU=46) para diagnóstico
                const diagCols = [33, 34, 35, 36, 37, 38, 39, 45, 46, 47];
                console.log('[Secundario] Headers en cols clave:', diagCols.map(i => `[${i}]="${headers[i] || ''}"`).join(' '));

                for (let i = 1; i < rows.length; i++) {
                    const row  = rows[i];
                    const cuit = String(row[idxCuit] || '').replace(/\D/g, '');
                    if (!cuit) continue;
                    if (!result[cuit]) result[cuit] = {};
                    result[cuit].gs_nosis     = idxNosis   >= 0 ? (row[idxNosis]   || null) : null;
                    result[cuit].gs_fact      = idxFact    >= 0 ? (row[idxFact]    || null) : null;
                    result[cuit].gs_credito_jd = idxCredito >= 0
                        ? (parseFloat(String(row[idxCredito] || '').replace(/[^0-9.-]/g, '')) || null)
                        : null;
                }
                // Muestra las primeras 3 entradas para validar
                const sampleKeys = Object.keys(result).slice(0, 3);
                sampleKeys.forEach(k => console.log(`[Secundario] Muestra CUIT ${k}:`, JSON.stringify(result[k])));
                console.log(`[Secundario] Credit Performance: ${Object.keys(result).length} CUITs`);
            }
        }

        // ── 2. SAC: planilla separada (SAC_SHEET_ID)
        //    col R (idx 17) = CUIT, col V (idx 21) = Respuesta, col W (idx 22) = Crédito (jaulas dobles)
        try {
            const sacMeta = await sheets.spreadsheets.get({ spreadsheetId: SAC_SHEET_ID });
            const sacSheetsList = sacMeta.data.sheets || [];
            const sacName = getSheetName(SAC_GID, sacSheetsList);
            if (!sacName) {
                console.error(`[Secundario] Tab SACs no encontrado en planilla SAC (GID ${SAC_GID})`);
            } else {
                const sacRes = await sheets.spreadsheets.values.get({
                    spreadsheetId: SAC_SHEET_ID,
                    range: `${sacName}!A:W`,
                });
                const sacRows = sacRes.data.values || [];
                let sacCount = 0;
                // Fila 0 = header; iteramos desde 1
                for (let i = 1; i < sacRows.length; i++) {
                    const row    = sacRows[i];
                    const cuit   = String(row[17] || '').replace(/\D/g, ''); // col R = índice 17
                    const status = String(row[21] || '').trim().toUpperCase(); // col V = índice 21
                    if (!cuit) continue;
                    if (status === 'APROBADO') {
                        if (!result[cuit]) result[cuit] = {};
                        result[cuit].gs_sac = '\u2705';
                        // Cantidad de crédito otorgado (jaulas dobles) — col W = índice 22
                        const creditoRaw = parseFloat(String(row[22] || '').replace(/[^0-9.-]/g, ''));
                        result[cuit].gs_sac_credito = isNaN(creditoRaw) ? null : creditoRaw;
                        sacCount++;
                    }
                }
                console.log(`[Secundario] SAC: ${sacCount} sociedades con SAC APROBADO`);
            }
        } catch (sacErr: any) {
            console.error('[Secundario] Error leyendo planilla SACs:', sacErr.message);
        }

        // ── 3. Base Clave: K (col C / Q TOTAL), Kv (col D / Q VACAS), PorcU (col I / KPI dCaC) ──
        const baseClaveSheetName = getSheetName(BASE_CLAVE_GID, sheetsList);
        if (!baseClaveSheetName) {
            console.error(`[Secundario] Tab Base Clave no encontrado (GID ${BASE_CLAVE_GID})`);
        } else {
            const bcRes = await sheets.spreadsheets.values.get({
                spreadsheetId: CREDIT_SHEET_ID,
                range: `${baseClaveSheetName}!A:I`,
            });
            const bcRows = bcRes.data.values || [];
            // Col B (idx 1) = CUIT, Col C (idx 2) = Q TOTAL, Col D (idx 3) = Q VACAS, Col I (idx 8) = KPI dCaC
            // Saltamos fila 0 (header)
            let bcCount = 0;
            for (let i = 1; i < bcRows.length; i++) {
                const row  = bcRows[i];
                const cuit = String(row[1] || '').replace(/\D/g, ''); // col B
                if (!cuit) continue;
                const kRaw  = parseFloat(String(row[2] || '').replace(/[^0-9.-]/g, '')); // col C
                const kvRaw = parseFloat(String(row[3] || '').replace(/[^0-9.-]/g, '')); // col D
                // PorcU: el KPI puede venir como 75 (%) o 0.75 (decimal); normalizamos a decimal
                const puStr = String(row[8] || '').replace(/%/g, '').trim();              // col I
                const puRaw = parseFloat(puStr.replace(/[^0-9.-]/g, ''));
                if (!result[cuit]) result[cuit] = {};
                if (!isNaN(kRaw))  { result[cuit].K    = kRaw;  bcCount++; }
                if (!isNaN(kvRaw)) { result[cuit].Kv   = kvRaw; }
                if (!isNaN(puRaw)) { result[cuit].PorcU = puRaw > 1 ? puRaw / 100 : puRaw; }
            }
            console.log(`[Secundario] Base Clave: ${bcCount} filas con K procesadas`);
        }

        gsCache = result;
        gsCacheExpiry = now + GS_TTL_MS;
        console.log(`[Secundario] Google Sheets cargados: ${Object.keys(result).length} CUITs totales`);
        return result;
    } catch (e: any) {
        console.error('[Secundario] Error fetching Google Sheet:', e.message);
        return {};
    }
}

// ─── BC estático ────────────────────────────────────────────────────────────
function getBcFull(): Record<string, any> {
    if (bcFullCache) return bcFullCache;
    const bcResult: Record<string, any> = {};
    try {
        const staticDataFile = path.join(process.cwd(), 'data_3507.json');
        if (fs.existsSync(staticDataFile)) {
            const bcData = JSON.parse(fs.readFileSync(staticDataFile, 'utf8'));
            bcData.forEach((row: any) => {
                const cuitStr = String(row.cuit_sociedad).replace(/\D/g, '');
                if (cuitStr) {
                    bcResult[cuitStr] = { K: row.ktotal, Kv: row.kvaca, PorcU: row.PorcU, ANT: row.ANT };
                }
            });
        }
    } catch (e) {
        console.error('[Rio4 Secundario] Error loading static BC data', e);
    }
    bcFullCache = bcResult;
    return bcResult;
}

// ─── Auth Metabase 1 ────────────────────────────────────────────────────────
async function getSession(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
    const sessionRes = await fetch(`${METABASE_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: METABASE_USERNAME, password: METABASE_PASSWORD }),
        cache: 'no-store',
    });
    if (!sessionRes.ok) throw new Error('Fallo autenticación Metabase');
    const { id: token } = await sessionRes.json();
    cachedToken = token;
    tokenExpiry = Date.now() + SESSION_TTL_MS;
    return token;
}

// ─── Auth Metabase 2 ────────────────────────────────────────────────────────
async function getSessionMB2(): Promise<string> {
    if (cachedTokenMB2 && Date.now() < tokenExpiryMB2) return cachedTokenMB2;
    const sessionRes = await fetch(`${METABASE2_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: METABASE2_USERNAME, password: METABASE2_PASSWORD }),
        cache: 'no-store',
    });
    if (!sessionRes.ok) throw new Error('Fallo autenticación Metabase 2');
    const { id: token } = await sessionRes.json();
    cachedTokenMB2 = token;
    tokenExpiryMB2 = Date.now() + SESSION_TTL_MS;
    return token;
}

// ─── fetchCard Metabase 1 ────────────────────────────────────────────────────
async function fetchCard(cardId: number, sessionToken: string, paramValue?: number | string, paramNameStr?: string | null): Promise<any[]> {
    const parameters: any[] = [];
    if (paramValue !== undefined && paramValue !== null) {
        parameters.push({ type: 'category', target: ['variable', ['template-tag', 'filtro_usuario']], value: String(paramValue) });
    }
    if (paramNameStr) {
        parameters.push({ type: 'string/=', target: ['variable', ['template-tag', 'filtro_usuario_nombre']], value: String(paramNameStr) });
    }

    const body: any = parameters.length ? { parameters } : {};

    const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': sessionToken },
        body: Object.keys(body).length ? JSON.stringify(body) : undefined,
        cache: 'no-store',
    });
    const raw = await res.json();
    if (raw.error) throw new Error(raw.error);
    let data: any[] | null = null;
    if (raw.data) data = formatMetabaseData(raw.data);
    else if (raw.rows) data = formatMetabaseData(raw);
    return data || [];
}

// ─── fetchCard Metabase 2 (JSON) ─────────────────────────────────────────────
async function fetchCardMB2(cardId: number, sessionToken: string, idUsuario?: number): Promise<any[]> {
    const parameters: any[] = [];
    if (idUsuario !== undefined && !isNaN(idUsuario) && idUsuario > 0) {
        // id_usuario es tipo 'text' (variable simple, NO field filter) → target 'variable'
        parameters.push({ type: 'category', target: ['variable', ['template-tag', 'id_usuario']], value: String(idUsuario) });
    }
    const body: any = { parameters };

    console.log(`[Secundario] fetchCardMB2 card=${cardId} idUsuario=${idUsuario} params=`, JSON.stringify(parameters));

    const res = await fetch(`${METABASE2_URL}/api/card/${cardId}/query/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': sessionToken },
        body: JSON.stringify(body),
        cache: 'no-store',
    });
    if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.error(`[Secundario] fetchCardMB2 card=${cardId} HTTP ${res.status}:`, errBody.slice(0, 300));
        throw new Error(`MB2 HTTP ${res.status}`);
    }
    const raw = await res.json();
    if (!Array.isArray(raw)) {
        // Si Metabase devuelve un objeto de error en vez de array
        if (raw?.error) console.error(`[Secundario] fetchCardMB2 card=${cardId} error:`, raw.error);
        return [];
    }
    console.log(`[Secundario] fetchCardMB2 card=${cardId} → ${raw.length} rows`);
    return raw;
}

// ─── fetchAndProcessSecundario ───────────────────────────────────────────────
async function fetchAndProcessSecundario(acId: string | null, acName: string | null, isAdminRequest: boolean = false): Promise<any> {
    const tokenMB2 = await getSessionMB2();

    // Parsear acId de forma segura: solo usar si es un número positivo válido
    const acIdNum = acId ? parseInt(acId, 10) : NaN;
    const validAcId = !isNaN(acIdNum) && acIdNum > 0 ? acIdNum : undefined;
    // paramId: si hay acId válido → usar ese; si es admin → sin filtro (undefined); sino → ID de oficina
    const paramId = validAcId !== undefined ? validAcId : (isAdminRequest ? undefined : OFICINA_ID);
    const isLocalAc = !!acName;

    console.log(`[Secundario] fetchAndProcess acId=${acId} validAcId=${validAcId} paramId=${paramId} isAdmin=${isAdminRequest} acName=${acName}`);

    // ── Top Sociedades: Query 145 (MB2, filtrable por id_usuario) ──
    const topSocRaw = await fetchCardMB2(145, tokenMB2, paramId).catch(e => {
        console.error('[Secundario] Q145 error:', e.message);
        return [];
    });

    // ── CI INV activas: Card 148 (MB2) ──
    const rawCisInvRaw = await fetchCardMB2(148, tokenMB2, paramId).catch(e => {
        console.error('[Secundario] MB2 148 error:', e.message);
        return [];
    });

    console.log(`[Secundario] topSoc=${topSocRaw.length} cisInvRaw=${rawCisInvRaw.length}`);

    // Normalizar nombres de campo: MB2 puede devolver id_revision (sin 'a') → lo mapeamos a id_revisacion
    const rawCisInv = rawCisInvRaw.map((r: any) => {
        const out: any = { ...r };
        if (out.id_revision !== undefined && out.id_revisacion === undefined) {
            out.id_revisacion = out.id_revision;
        }
        return out;
    });

    // ── CI INV completo (para modal): Card 4609 o 4133 via MB1 ──
    let rawCisInvFull: any[] = [];
    try {
        const token = await getSession();
        // Cuando hay acId válido, ya filtramos en MB2 (cards 145/148).
        // Para la card de MB1 (4609/4133) pasamos el nombre del AC si lo tenemos y no hay acId.
        // Si hay acId, la card MB2 ya filtró correctamente, MB1 se usa como enriquecimiento.
        const ciInvFullCardId = isLocalAc ? 4609 : 4133;
        // Solo filtrar por nombre cuando hay nombre pero no ID (evita cruce por coincidencia de nombre)
        const paramNameStr = (isLocalAc && !validAcId) ? acName : undefined;
        rawCisInvFull = await fetchCard(ciInvFullCardId, token, undefined, paramNameStr).catch((e) => {
            console.warn('[Secundario] MB1 cisInvFull error (no crítico):', e.message);
            return [];
        });
        console.log(`[Secundario] cisInvFull MB1 card=${ciInvFullCardId} → ${rawCisInvFull.length} rows`);
    } catch (e: any) {
        console.warn('[Secundario] MB1 session error (no crítico):', e.message);
        // MB1 no crítico
    }

    // ── Enriquecer TopSoc con datos del Google Sheet (K, Kv, PorcU + créditos) ──
    const gsData = await fetchGoogleSheetData();
    const topSocFinal = topSocRaw.map((s: any) => {
        const cuitClean = String(s.cuit || '').replace(/\D/g, '');
        return { ...s, ...(gsData[cuitClean] || {}) };
    });

    return {
        topSoc: topSocFinal,
        cisInv: rawCisInv,
        cisInvFull: rawCisInvFull,
        _cachedAt: new Date().toISOString(),
    };
}

// ─── Merge helpers ────────────────────────────────────────────────────────────
/** Dedup topSoc entries by CUIT, summing numeric fields (op counts) */
function mergeTopSoc(entries: any[]): any[] {
    const map = new Map<string, any>();
    for (const s of entries) {
        const key = String(s.cuit || s.id_persona || '').replace(/\D/g, '') || JSON.stringify(s);
        if (!map.has(key)) {
            map.set(key, { ...s });
        } else {
            // Sum numeric fields (counts, totales), keep strings from first entry
            const existing = map.get(key)!;
            for (const [k, v] of Object.entries(s)) {
                if (typeof v === 'number' && typeof existing[k] === 'number') {
                    existing[k] += v;
                }
            }
        }
    }
    return Array.from(map.values()).sort((a, b) => (b.n_operaciones ?? b.cantidad ?? 0) - (a.n_operaciones ?? a.cantidad ?? 0));
}

/** Dedup CI entries by a given key field */
function dedupBy(entries: any[], keyField: string): any[] {
    const seen = new Set<string>();
    return entries.filter(e => {
        const k = String(e[keyField] ?? JSON.stringify(e));
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

// ─── fetchAndProcessMultiple ──────────────────────────────────────────────────
/** Fetch topSoc + CI para múltiples usuarioIds (vista de oficina) y mergear */
async function fetchAndProcessMultiple(ids: number[]): Promise<any> {
    const tokenMB2 = await getSessionMB2();

    // Q145 (TopSoc) y Q148 (CIs) para cada ID en paralelo
    const [topSocArrays, cisInvArrays] = await Promise.all([
        Promise.all(ids.map(id => fetchCardMB2(145, tokenMB2, id).catch(() => []))),
        Promise.all(ids.map(id => fetchCardMB2(148, tokenMB2, id).catch(() => []))),
    ]);

    const topSocRaw = mergeTopSoc(topSocArrays.flat());
    const rawCisInvRaw = dedupBy(cisInvArrays.flat(), 'id_revisacion');

    // Normalizar id_revision → id_revisacion
    const rawCisInv = rawCisInvRaw.map((r: any) => {
        const out: any = { ...r };
        if (out.id_revision !== undefined && out.id_revisacion === undefined) out.id_revisacion = out.id_revision;
        return out;
    });

    // Enriquecer con datos del Google Sheet (K, Kv, PorcU + créditos)
    const gsData = await fetchGoogleSheetData();
    const topSocFinal = topSocRaw.map((s: any) => {
        const cuitClean = String(s.cuit || '').replace(/\D/g, '');
        return { ...s, ...(gsData[cuitClean] || {}) };
    });

    return {
        topSoc: topSocFinal,
        cisInv: rawCisInv,
        cisInvFull: [], // MB1 no se consulta en multi-ID (perf)
        _cachedAt: new Date().toISOString(),
    };
}

// ─── Background refresh ──────────────────────────────────────────────────────
async function refreshInBackground(cacheKey: string, acId: string | null, acName: string | null, isAdminRequest: boolean = false) {
    if (dataCaches[cacheKey]?.isRefreshing) return;

    if (!dataCaches[cacheKey]) {
        dataCaches[cacheKey] = { data: null, expiry: 0, isRefreshing: true };
    } else {
        dataCaches[cacheKey].isRefreshing = true;
    }

    try {
        const fresh = await fetchAndProcessSecundario(acId, acName, isAdminRequest);
        dataCaches[cacheKey] = {
            data: fresh,
            expiry: Date.now() + DATA_TTL_MS,
            isRefreshing: false
        };
        console.log(`[Rio4 Secundario] Cache refreshed for ${cacheKey} at`, fresh._cachedAt);
    } catch (e: any) {
        dataCaches[cacheKey].isRefreshing = false;
        console.error(`[Rio4 Secundario] Background refresh failed for ${cacheKey}:`, e.message);
    }
}

// ─── GET Handler ────────────────────────────────────────────────────────────
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const isAdmin = searchParams.get('isAdmin') === 'true';

        // acId viene tanto de usuarios normales (su propio id) como de admins viendo un AC específico
        const acId = searchParams.get('acId');
        let acName = searchParams.get('acName');

        let cacheKey = acId ? `ac_${acId}` : (isAdmin ? 'global_admin' : 'global');

        if (isAdmin && acName && !acId) {
            // Fallback para admin viendo por nombre sin ID: usar nombre en cacheKey
            cacheKey = `admin_view_name_${acName}`;
        }

        // ── Multi-ID path (vista de oficina) ─────────────────────────────────
        const acIdsParam = searchParams.get('acIds');
        if (acIdsParam) {
            const ids = acIdsParam.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n) && n > 0);
            if (ids.length > 0) {
                const multiCacheKey = `office_${ids.sort().join('_')}`;
                const now2 = Date.now();
                const entry2 = dataCaches[multiCacheKey];
                if (entry2?.data && now2 < entry2.expiry) {
                    return NextResponse.json(entry2.data, { headers: { 'X-Cache': 'HIT' } });
                }
                const fresh2 = await fetchAndProcessMultiple(ids);
                dataCaches[multiCacheKey] = { data: fresh2, expiry: now2 + DATA_TTL_MS, isRefreshing: false };
                return NextResponse.json(fresh2, { headers: { 'X-Cache': 'MISS' } });
            }
        }

        const now = Date.now();
        const cacheEntry = dataCaches[cacheKey];

        // Hit
        if (cacheEntry?.data && now < cacheEntry.expiry) {
            return NextResponse.json(cacheEntry.data, {
                headers: {
                    'X-Cache': 'HIT',
                    'X-Cache-Age': String(Math.round((now - new Date(cacheEntry.data._cachedAt).getTime()) / 1000)) + 's',
                },
            });
        }

        // Stale
        if (cacheEntry?.data && now >= cacheEntry.expiry) {
            refreshInBackground(cacheKey, acId, acName, isAdmin);
            return NextResponse.json(cacheEntry.data, {
                headers: { 'X-Cache': 'STALE', 'X-Revalidating': 'true' },
            });
        }

        // Miss
        const fresh = await fetchAndProcessSecundario(acId, acName, isAdmin);
        dataCaches[cacheKey] = {
            data: fresh,
            expiry: now + DATA_TTL_MS,
            isRefreshing: false
        };

        return NextResponse.json(fresh, {
            headers: { 'X-Cache': 'MISS' },
        });

    } catch (err: any) {
        console.error('[Rio4 Secundario API]', err.message);
        cachedToken = null;
        tokenExpiry = 0;
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
