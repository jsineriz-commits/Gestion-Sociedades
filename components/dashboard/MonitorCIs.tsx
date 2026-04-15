'use client';
import { useState, useMemo, useCallback, useRef } from 'react';
import React from 'react';
import DetailPanel, { DetailRow } from '@/components/ui/DetailPanel';

interface Props {
    cisInv: any[];
    cisInvFull?: any[];
    acName?: string | null;
    acId?: number | null;
    topSoc?: any[];  // sociedades del AC (de Card 145) — se usa para filtrar el detalle de tropa
}

// ─── Column priorities for the CI master table ─────────────────────────────
const CI_PRIORITY = [
    'id_revisacion', 'id_ci', 'id',
    'fecha_publicacion', 'fecha_primer_habilitacion', 'fecha_ultima_habilitacion',
    'vendedor', 'ac_vendedor', 'representante_vendedor', 'rs_vendedora',
    'partido_origen', 'provincia_origen',
    'cabezas', 'categoria', 'raza', 'peso', 'calidad', 'terminacion',
    '_kilosTot', '_montoEst', '_diasVto',
    'precio', 'plazo', 'vencimiento',
    'q_habilitados_CI', 'q_visitas_CI', 'q_ofertas',
    'rendimiento_minimo', 'visitas',
    'operador_nombre', 'comprado_fecha',
];

// Columns to show inside each society group (Q4568 fields)
// rendimientos = deduplicated concat from endpoint
// plazo1/plazo2 removed (they're from seller's CD quote, not CI terms)
const SOC_SHOW = [
    'kt_comprador', 
    'kv_comprador',
    'sociedad_compradora', 
    'distancia_min',
    'rendimientos', 
    'cant_visitas', 
    'ult_vista', 
    'nombre_establecimiento',
    'ac_comprador'
];

// These meta/internal fields are not shown as columns
const HIDDEN_CI = new Set(['_kilosTot', '_montoEst', '_diasVto']);

// ─── Labels ────────────────────────────────────────────────────────────────
const LABELS: Record<string, string> = {
    id_revisacion: 'ID Tropa', id_ci: 'ID CI',
    fecha_publicacion: 'Publicado',
    vendedor: 'Vendedor', rs_vendedora: 'Vendedor',
    rendimientos: 'Rendimientos', rendimiento_esperado: 'Rendimiento',
    partido_origen: 'Partido', provincia_origen: 'Provincia',
    cabezas: 'Cbzs', categoria: 'Cat.', raza: 'Raza', peso: 'Kms',
    calidad: 'Calidad', terminacion: 'Terminac.',
    _kilosTot: '🥩 Kg Tot.', _montoEst: '💰 Monto Est.', _diasVto: '⏳ Días',
    precio: 'Precio Ped.', plazo: 'Plazo', vencimiento: 'Vencim.',
    q_habilitados_CI: 'Habilitados', q_visitas_CI: 'Visitas', q_ofertas: 'Ofertas',
    operador_nombre: 'Operador', comprado_fecha: 'F. Compra',
    ac_vendedor: 'AC Vende', representante_vendedor: 'Rep. Vende',
    fecha_primer_habilitacion: '1° Hab.', fecha_ultima_habilitacion: 'Últ. Hab.',
    rendimiento_minimo: 'Rend. Mín', visitas: 'Vis. Plat.',
    sociedad_compradora: 'Sociedad', grupo_empresario_compradora: 'Grupo',
    ac_comprador: 'AC', nombre_establecimiento: 'Establecimiento',
    distancia_min: 'Dist. km', kt_comprador: 'KT', kv_comprador: 'KV',
    cant_visitas: 'Visitas CI', ult_vista: 'Ult. Vista',
    fecha_habilitacion: 'F. Habilitac.', fecha_comp_ci: 'F. Compra CI',
    CIs_vistas: 'CIs Vistas', precio_aceptado: '$ Acepto',
    operador: 'Operador', provincia: 'Provincia',
};
const lbl = (c: string) => LABELS[c] || c.replace(/_/g, ' ');

// ─── Helpers ───────────────────────────────────────────────────────────────
const ISO_RE = /^\d{4}-\d{2}-\d{2}/;
const isIso = (v: any) => typeof v === 'string' && ISO_RE.test(v) && !isNaN(Date.parse(v));
const fmtDate = (v: any) => { try { return new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }); } catch { return String(v); } };

// Tiempo relativo: "hace 2 horas", "hace 3 días", etc.
function fmtRelative(v: any): string {
    if (!v) return '—';
    try {
        const date = new Date(v);
        if (isNaN(date.getTime())) return String(v);
        const diffMs = Date.now() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffH = Math.floor(diffMs / 3600000);
        const diffD = Math.floor(diffMs / 86400000);
        if (diffMin < 1) return 'Ahora';
        if (diffMin < 60) return `hace ${diffMin} min`;
        if (diffH < 24) return `hace ${diffH}h`;
        if (diffD === 1) return 'Ayer';
        if (diffD < 7) return `hace ${diffD} días`;
        if (diffD < 30) return `hace ${Math.floor(diffD / 7)} sem`;
        return fmtDate(v);
    } catch { return String(v); }
}

const fmtNum = (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
const fmtMoney = (n: number) => '$' + fmtNum(n);
const isTruthy = (v: any) => v === 1 || v === true || v === '1' || v === true;
const isHabilitado = (r: any) => r.fecha_habilitacion != null && r.fecha_habilitacion !== '0000-00-00 00:00:00';
const hasVisto = (r: any) => Number(r.cant_visitas ?? 0) > 0;

function sortCols(keys: string[], pri: string[]) {
    const pm = new Map(pri.map((k, i) => [k, i]));
    return [...keys.filter(k => pm.has(k)).sort((a, b) => (pm.get(a) ?? 999) - (pm.get(b) ?? 999)),
    ...keys.filter(k => !pm.has(k))];
}

function detectIdKey(rows: any[]): string {
    if (!rows.length) return 'id_revisacion';
    const keys = Object.keys(rows[0]);
    return keys.find(k => k === 'id_revisacion')
        || keys.find(k => k.toLowerCase().includes('id_tropa') || k.toLowerCase().includes('id_ci') || k.toLowerCase().includes('id_revisacion'))
        || keys.find(k => typeof rows[0][k] === 'number')
        || keys[0];
}

function addComputed(row: any): any {
    const c = Number(row.cabezas ?? row.Cabezas ?? 0);
    const p = Number(row.peso ?? row.Peso ?? 0);
    const pr = Number(row.precio ?? row.Precio_Pedido ?? 0);
    const kg = c > 0 && p > 0 ? c * p : null;
    let dias: number | null = null;
    for (const k of ['vencimiento', 'Vencimiento', 'fecha_vencimiento']) {
        if (row[k]) { dias = Math.ceil((new Date(row[k]).getTime() - Date.now()) / 86400000); break; }
    }
    return { ...row, _kilosTot: kg, _montoEst: kg != null && pr > 0 ? kg * pr : null, _diasVto: dias };
}

// ─── Grouping logic using REAL Q4568 field names ───────────────────────────
// Mirrors the 6 sections from the Google Sheets formula:
// AT (oferto_ci), AU (compro_al_vendedor), AQ (derived from fecha_habilitacion + cant_visitas)
function groupSociedades(rows: any[]) {
    const ofertó = (r: any) => isTruthy(r.oferto_ci);
    const compró = (r: any) => isTruthy(r.compro_al_vendedor);
    const hab = (r: any) => isHabilitado(r);
    const vio = (r: any) => hasVisto(r);

    const grps: { key: string; title: string; color: string; icon: string; rows: any[] }[] = [
        { key: 'compro', title: 'COMPRARON AL VENDEDOR', color: 'emerald', icon: '🤝', rows: [] },
        { key: 'oferto', title: 'OFERTARON', color: 'blue', icon: '💬', rows: [] },
        { key: 'hab_vio', title: 'HABILITADOS · VIERON', color: 'indigo', icon: '👁️', rows: [] },
        { key: 'nhab_vio', title: 'NO HAB. · VIERON', color: 'violet', icon: '👁️', rows: [] },
        { key: 'hab_nv', title: 'HABILITADOS · NO VIERON', color: 'amber', icon: '📬', rows: [] },
        { key: 'nhab_nv', title: 'NO HAB. · NO VIERON', color: 'gray', icon: '📭', rows: [] },
    ];
    for (const r of rows) {
        if (compró(r) && !ofertó(r)) grps[0].rows.push(r);
        else if (ofertó(r)) grps[1].rows.push(r);
        else if (hab(r) && vio(r)) grps[2].rows.push(r);
        else if (!hab(r) && vio(r)) grps[3].rows.push(r);
        else if (hab(r)) grps[4].rows.push(r);
        else grps[5].rows.push(r);
    }
    return grps.filter(g => g.rows.length > 0);
}

// ─── Cell renderer ────────────────────────────────────────────────────────
function DiasBadge({ dias }: { dias: number | null }) {
    if (dias === null) return <span className="text-gray-300 text-[10px]">—</span>;
    const c = dias < 0 ? 'bg-red-100 text-red-700' : dias <= 3 ? 'bg-orange-100 text-orange-700' : dias <= 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-50 text-green-700';
    const icon = dias < 0 ? '🔴' : dias <= 3 ? '🟠' : dias <= 7 ? '🟡' : '🟢';
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${c}`}>{icon} {dias < 0 ? `${Math.abs(dias)}d venc.` : `${dias}d`}</span>;
}

function Cell({ val, col }: { val: any; col: string }) {
    if (col === '_diasVto') return <DiasBadge dias={val} />;
    if (col === '_kilosTot') return val != null ? <span className="text-xs font-semibold">{fmtNum(val)} kg</span> : <span className="text-gray-300 text-[10px]">—</span>;
    if (col === '_montoEst') return val != null ? <span className="text-xs font-bold text-blue-700">{fmtMoney(val)}</span> : <span className="text-gray-300 text-[10px]">—</span>;
    if (col === 'rendimientos') return val ? <span className="text-xs font-bold text-blue-700 whitespace-nowrap">{val}</span> : <span className="text-gray-300 text-[10px]">—</span>;
    if (col === 'cant_visitas') return <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${Number(val) > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>{val ?? 0}</span>;
    if (col === 'fecha_habilitacion' || col === 'fecha_primer_habilitacion' || col === 'fecha_ultima_habilitacion') return val ? <span className="text-[10px] text-emerald-600 font-semibold">{fmtDate(val)}</span> : <span className="text-gray-300 text-[10px]">No hab.</span>;
    if (col === 'distancia_min') return val && Number(val) > 0 ? <span className="text-xs text-gray-600 font-semibold">{val} km</span> : <span className="text-gray-300 text-[10px]">—</span>;
    if (col === 'ult_vista') return val ? <span className="text-[10px] text-indigo-600 font-semibold whitespace-nowrap">{fmtRelative(val)}</span> : <span className="text-gray-300 text-[10px]">—</span>;
    if (col === 'fecha_publicacion') return val ? <span className="text-[10px] text-gray-600 font-medium whitespace-nowrap">{fmtRelative(val)}</span> : <span className="text-gray-300 text-[10px]">—</span>;
    if (col === 'kt_comprador' || col === 'kv_comprador') {
        if (!val || Number(val) === 0) return <span className="text-gray-300 text-[10px]">—</span>;
        return <span className="text-[10px] font-black px-1.5 py-0.5 rounded-sm bg-gray-50 border border-gray-100 text-gray-500 shadow-sm">{Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(Number(val))}</span>;
    }
    if (col === 'rendimiento_minimo' || col === 'visitas') return val ? <span className="text-xs font-semibold text-gray-700">{fmtNum(Number(val))}</span> : <span className="text-gray-300 text-[10px]">—</span>;
    if (isIso(val)) return <span className="text-xs text-indigo-600 font-medium whitespace-nowrap">{fmtDate(val)}</span>;
    if (val === null || val === undefined || val === '' || val === '0') return <span className="text-gray-300 text-[10px]">—</span>;
    return <span className="text-xs text-gray-700">{String(val)}</span>;
}

// Inline summary for a CI row (from Q4573 aggregated data)
function CISummaryBadges({ ci }: { ci: any }) {
    const hab = Number(ci.q_habilitados_CI ?? 0);
    const vis = Number(ci.q_visitas_CI ?? 0);
    const of = Number(ci.q_ofertas ?? 0);
    const comp = ci.comprado_fecha && ci.comprado_fecha !== '0000-00-00 00:00:00';
    return (
        <div className="flex items-center gap-1 flex-wrap">
            {hab > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{hab} hab</span>}
            {vis > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{vis} vis</span>}
            {of > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">{of} of</span>}
            {comp && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓ Comprado</span>}
        </div>
    );
}

const GROUP_THEME: Record<string, { hdr: string; badge: string; row: string }> = {
    emerald: { hdr: 'bg-emerald-600 text-white', badge: 'bg-emerald-100 text-emerald-800', row: 'hover:bg-emerald-50/50' },
    blue: { hdr: 'bg-blue-600 text-white', badge: 'bg-blue-100 text-blue-800', row: 'hover:bg-blue-50/50' },
    indigo: { hdr: 'bg-indigo-600 text-white', badge: 'bg-indigo-100 text-indigo-800', row: 'hover:bg-indigo-50/50' },
    violet: { hdr: 'bg-violet-600 text-white', badge: 'bg-violet-100 text-violet-800', row: 'hover:bg-violet-50/50' },
    amber: { hdr: 'bg-amber-500 text-white', badge: 'bg-amber-100 text-amber-800', row: 'hover:bg-amber-50/50' },
    gray: { hdr: 'bg-gray-200 text-gray-700', badge: 'bg-gray-100 text-gray-600', row: 'hover:bg-gray-50' },
};

// ─── Filter Cards ────────────────────────────────────────────────────────────
function CIFilterCards({
    rows,
    filteredRows,
    filters,
    setFilters
}: {
    rows: any[];
    filteredRows: any[];
    filters: { cat: string; prov: string; peso: string };
    setFilters: React.Dispatch<React.SetStateAction<{ cat: string; prov: string; peso: string }>>;
}) {
    if (!rows.length) return null;

    const totalCbzs = filteredRows.reduce((acc, r) => acc + (Number(r.cabezas || r.cantidad) || 0), 0);

    const getGroups = (key: string) => {
        const m = rows.reduce((acc, r) => {
            let val = r[key];
            if (!val || val === '0') val = '—';
            
            // Si es peso, hagamos rangos o usamos el string literal.
            // Para mantenerlo exacto, usamos el valor literal
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return (Object.entries(m) as [string, number][]).sort((a,b) => b[1] - a[1]);
    };

    const cats = getGroups('categoria');
    const provs = getGroups('provincia_origen');
    const pesos = getGroups('peso');

    const handleFilter = (type: 'cat' | 'prov' | 'peso', val: string) => {
        setFilters(p => ({ ...p, [type]: p[type] === val ? '' : val }));
    };

    const renderFilterCard = (title: string, type: 'cat' | 'prov' | 'peso', items: [string, number][], icon: string, bg: string, text: string) => (
        <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex flex-col h-full min-w-0">
            <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[10px] ${bg} ${text}`}>{icon}</div>
                <p className="text-[10px] lg:text-[9px] xl:text-[10px] uppercase font-bold text-gray-500 tracking-wider flex-1 truncate">{title}</p>
                {filters[type] && <button onClick={() => setFilters(p => ({ ...p, [type]: '' }))} className="text-[9px] text-gray-400 shrink-0 hover:text-red-500 font-bold border rounded px-1">✕</button>}
            </div>
            <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-[85px] scrollbar-thin scrollbar-thumb-gray-200">
                {items.map(([val, count]) => {
                    const active = filters[type] === val;
                    return (
                        <button
                            key={val}
                            onClick={() => handleFilter(type, val)}
                            className={`text-[9px] xl:text-[10px] font-black px-2 py-1 rounded-md transition-all whitespace-nowrap border
                                ${active ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-100 hover:border-gray-300'}`}
                        >
                            <span className="truncate max-w-[80px] inline-block align-bottom">{val}</span>
                            <span className={`opacity-60 ml-1 font-normal ${active ? 'text-blue-100' : 'text-gray-400'}`}>({count})</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-4 shadow-sm text-white flex flex-col justify-between transition-all min-w-0">
                <div className="min-w-0">
                   <p className="text-[10px] lg:text-[9px] xl:text-[10px] font-bold text-blue-200 uppercase tracking-wider truncate">CIs Visibles</p>
                   <p className="text-3xl lg:text-2xl xl:text-3xl font-black mt-1 leading-none truncate">{filteredRows.length} <span className="text-[12px] font-bold text-blue-300 uppercase">CIs</span></p>
                </div>
                <div className="bg-white/10 rounded-lg p-2 mt-2 min-w-0">
                   <p className="text-[10px] uppercase text-blue-100 font-bold truncate">Volumen Oferta</p>
                   <p className="text-sm lg:text-xs xl:text-sm font-black transition-all truncate">{totalCbzs.toLocaleString('es-AR')} cbzs</p>
                </div>
            </div>
            {renderFilterCard('Categorías', 'cat', cats, '🏷️', 'bg-amber-50', 'text-amber-600')}
            {renderFilterCard('Provincias', 'prov', provs, '📍', 'bg-emerald-50', 'text-emerald-600')}
            {renderFilterCard('Pesos', 'peso', pesos, '⚖️', 'bg-indigo-50', 'text-indigo-600')}
        </div>
    );
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function MonitorCIs({ cisInv, cisInvFull, acName, acId, topSoc }: Props) {
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [loadingDet, setLoadingDet] = useState(false);
    const [detError, setDetError] = useState<string | null>(null);
    const [detalle, setDetalle] = useState<any[]>([]);
    const detCache = useRef<Map<string, any[]>>(new Map());
    const [filters, setFilters] = useState({ cat: '', prov: '', peso: '' });

    const sortRows = (src: any[]) => [...src].sort((a, b) => {
        for (const k of ['vencimiento', 'fecha_vencimiento', 'fecha_publicacion']) {
            if (a[k] && b[k]) return new Date(a[k]).getTime() - new Date(b[k]).getTime();
        } return 0;
    }).map(addComputed);

    const sortedInv = useMemo(() => sortRows(cisInv), [cisInv]);
    const ciIdKey = useMemo(() => detectIdKey(sortedInv), [sortedInv]);

    // Usamos TODAS las filas para contadores de filtros
    const baseList = sortedInv;
    
    // Filtramos la lista a mostrar
    const activeList = useMemo(() => {
        return baseList.filter(r => {
            if (filters.cat && (r.categoria || '—') !== filters.cat) return false;
            if (filters.prov && (r.provincia_origen || '—') !== filters.prov) return false;
            if (filters.peso && (String(r.peso) || '—') !== filters.peso) return false;
            return true;
        });
    }, [baseList, filters]);

    const selectedCI = selectedIdx != null ? activeList[selectedIdx] : null;

    const handleSelect = useCallback(async (idx: number | null) => {
        if (idx === null || idx === selectedIdx) {
            setSelectedIdx(null); setDetalle([]); setDetError(null); return;
        }
        const ci = activeList[idx];
        if (!ci) return;
        // Use id_revisacion as the tropa key for ci-detail
        const tropa = String(ci.id_revisacion ?? ci[ciIdKey] ?? '').trim();
        if (!tropa || tropa === 'null' || tropa === 'undefined') {
            setDetError('Sin ID de tropa válido'); return;
        }
        setSelectedIdx(idx); setDetError(null);

        // Cache key incluye usuario para separar vistas admin vs AC
        const cacheKey = acId ? `${tropa}_u${acId}` : `${tropa}_all`;
        if (detCache.current.has(cacheKey)) {
            setDetalle(detCache.current.get(cacheKey)!); return;
        }
        setLoadingDet(true); setDetalle([]);
        try {
            // Mandar id_usuario a la API — Metabase aplica filtro dinámico en Card 147:
            // [[ AND (id_ac_comp = {{id_usuario}} OR id_rep_comp = {{id_usuario}}) ]]
            // Sin id_usuario (admin): WHERE 1=1 → todas las sociedades
            const params = new URLSearchParams({ id_tropa: tropa });
            if (acId) params.append('id_usuario', String(acId));
            const endpoint = `/api/ci-detail?${params.toString()}`;

            const res = await fetch(endpoint);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            const socs: any[] = json.sociedades || [];

            detCache.current.set(cacheKey, socs);
            setDetalle(socs);
        } catch (e: any) { setDetError(e.message); }
        finally { setLoadingDet(false); }
    }, [selectedIdx, activeList, ciIdKey, acId]);

    const makeCiCols = (rows: any[]) => {
        if (!rows.length) return [];
        const requested = [
            'id_revisacion', 'fecha_publicacion', 'vendedor',
            'partido_origen', 'provincia_origen', 'cabezas',
            'categoria', 'raza', 'peso', 'operador_nombre'
        ];
        // We ensure we only map what exists in the rows
        return requested.filter(k => Object.prototype.hasOwnProperty.call(rows[0], k));
    };
    const ciCols = useMemo(() => makeCiCols(baseList), [baseList]);

    const grupos = useMemo(() => groupSociedades(detalle), [detalle]);
    const socCols = useMemo(() => {
        if (!detalle.length) return SOC_SHOW.filter(k => detalle[0]?.[k] !== undefined);
        return SOC_SHOW.filter(k => Object.prototype.hasOwnProperty.call(detalle[0], k));
    }, [detalle]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <CIFilterCards rows={baseList} filteredRows={activeList} filters={filters} setFilters={setFilters} />

            <CITable
                rows={activeList}
                cols={ciCols}
                idKey={ciIdKey}
                selectedIdx={selectedIdx}
                onSelect={handleSelect}
                title="CIs Abiertas · Invernada"
                empty="Sin CIs que coincidan con los filtros."
                accent="blue"
            />

            {selectedCI && (
                <DetailPanel
                    isOpen={true}
                    onClose={() => handleSelect(null)}
                    title={`Tropa #${selectedCI.id_revisacion ?? selectedCI.id_tropa ?? ''}`}
                    subtitle={`${selectedCI.vendedor || selectedCI.rs_vendedora || ''} · ${selectedCI.categoria || ''}`}
                >
                    {(() => {
                        const ofertaValida = detalle.find((s: any) => s.precio_aceptado || s.precio_aceptable);
                        const pAc = ofertaValida?.precio_aceptado || ofertaValida?.precio_aceptable || selectedCI.precio_aceptado || selectedCI.precio_aceptable;
                        const plAc = ofertaValida?.plazo || selectedCI.plazo_aceptado || selectedCI.plazo_aceptable;
                        const hasPropuesta = !!pAc;
                        
                        return (
                            <div className="space-y-6 mt-4">
                                {/* 1. Resumen Comercial y Hacienda */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                                    <div className="bg-blue-50/50 border border-blue-100 p-2 rounded-xl min-w-0 flex flex-col justify-center">
                                        <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest truncate">Precio Pedido</p>
                                        <p className="text-sm lg:text-base font-black text-blue-900 mt-0.5 truncate">{pAc ? `$${pAc}` : (selectedCI.precio ? `$${selectedCI.precio}` : '—')}</p>
                                    </div>
                                    <div className="bg-amber-50/30 border border-amber-100 p-2 rounded-xl min-w-0 flex flex-col justify-center">
                                        <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest truncate">Cabezas</p>
                                        <p className="text-sm lg:text-base font-black text-amber-900 mt-0.5 truncate">{selectedCI.cabezas}</p>
                                    </div>
                                    <div className="bg-amber-50/30 border border-amber-100 p-2 rounded-xl min-w-0 flex flex-col justify-center">
                                        <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest truncate">Raza</p>
                                        <p className="text-xs lg:text-sm font-black text-amber-900 mt-0.5 truncate">{selectedCI.raza || '—'}</p>
                                    </div>
                                    <div className="bg-amber-50/30 border border-amber-100 p-2 rounded-xl min-w-0 flex flex-col justify-center">
                                        <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest truncate">Calidad</p>
                                        <p className="text-xs lg:text-sm font-black text-amber-900 mt-0.5 truncate">{selectedCI.calidad || '—'}</p>
                                    </div>
                                    <div className="bg-amber-50/30 border border-amber-100 p-2 rounded-xl min-w-0 flex flex-col justify-center">
                                        <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest truncate">Estado</p>
                                        <p className="text-xs lg:text-sm font-black text-amber-900 mt-0.5 truncate">{selectedCI.estado || 'Abierta'}</p>
                                    </div>
                                    <div className="bg-gray-50 border border-gray-100 p-2 rounded-xl min-w-0 flex flex-col justify-center">
                                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest truncate">Rend. Min</p>
                                        <p className="text-xs lg:text-sm font-black text-gray-700 mt-0.5 truncate">{selectedCI.rendimiento_minimo ? `${selectedCI.rendimiento_minimo}%` : '—'}</p>
                                    </div>
                                    <div className="bg-gray-50 border border-gray-100 p-2 rounded-xl min-w-0 flex flex-col justify-center">
                                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest truncate">Activa</p>
                                        <p className="text-xs lg:text-sm font-black text-gray-700 mt-0.5 truncate">{selectedCI.dias_activa || 0} d</p>
                                    </div>
                                </div>

                        {/* 2. Fechas y Ubicación */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border border-gray-100 rounded-xl p-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 border-b pb-1">Tiempos</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Publicado</span><span className="text-xs font-bold">{fmtDate(selectedCI.fecha_publicacion)}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Primer Hab.</span><span className="text-xs font-bold text-emerald-600">{fmtDate(selectedCI.fecha_primer_habilitacion) || '—'}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Última Hab.</span><span className="text-xs font-bold text-emerald-600">{fmtDate(selectedCI.fecha_ultima_habilitacion) || '—'}</span></div>
                                </div>
                            </div>
                            <div className="border border-gray-100 rounded-xl p-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 border-b pb-1">Ubicación y Comercial</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Provincia</span><span className="text-xs font-bold">{selectedCI.provincia_origen || '—'}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Partido</span><span className="text-xs font-bold">{selectedCI.partido_origen || '—'}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500">AC Vende</span><span className="text-xs font-bold">{selectedCI.ac_vendedor || '—'}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Operador</span><span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">{selectedCI.operador_nombre || selectedCI.operador || '—'}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Actividad (Sub-tabla) */}
                        <div className="border-t border-gray-100 pt-6">
                            <h4 className="text-[11px] font-black uppercase text-gray-900 flex items-center gap-2 tracking-widest mb-4">
                                <span className="w-2 h-2 rounded bg-indigo-500"></span>
                                Actividad e Interesados
                            </h4>
                            <SocDetail ci={selectedCI} grupos={grupos} cols={socCols} loading={loadingDet} error={detError} />
                        </div>
                    </div>
                );
            })()}
                </DetailPanel>
            )}
        </div>
    );
}

// ─── CI Table ──────────────────────────────────────────────────────────────
function CITable({ rows, cols, idKey, selectedIdx, onSelect, title, empty, accent = 'blue' }: {
    rows: any[]; cols: string[]; idKey: string; selectedIdx: number | null;
    onSelect: (i: number | null) => void; title: string; empty: string; accent?: string;
}) {
    const selBg = accent === 'violet' ? 'bg-violet-50 hover:bg-violet-100' : 'bg-blue-50 hover:bg-blue-100';
    const COMP = new Set(['_kilosTot', '_montoEst', '_diasVto']);
    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">{title}</h3>
                <div className="flex items-center gap-2">
                    {selectedIdx !== null && <button onClick={() => onSelect(null)} className="text-[10px] text-gray-400 hover:text-gray-700 border px-2 py-0.5 rounded">✕</button>}
                    <span className="text-xs font-bold text-gray-400 bg-gray-200 px-2 py-1 rounded-full">{rows.length} CIs</span>
                </div>
            </div>
            {!cols.length ? <div className="p-10 text-center text-gray-400 text-sm">{empty}</div> : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white sticky top-0 z-10 border-b shadow-sm">
                            <tr>
                                <th className="px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap w-px">📊</th>
                                {cols.map(c => <th key={c} className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${COMP.has(c) ? 'text-blue-400' : 'text-gray-400'}`}>{lbl(c)}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {rows.map((ci, i) => {
                                const sel = i === selectedIdx;
                                return (
                                    <tr key={i} onClick={() => onSelect(sel ? null : i)}
                                        className={`cursor-pointer transition-colors ${sel ? selBg : 'hover:bg-gray-50'}`}>
                                            <td className="px-2 py-2 text-center border-r border-gray-100">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    {/* Indicador principal: enviada a socs? */}
                                                    {(Number(ci.q_habilitados_CI) > 0)
                                                        ? <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 whitespace-nowrap" title="Sociedades habilitadas">{ci.q_habilitados_CI} soc.</span>
                                                        : <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 whitespace-nowrap" title="Sin sociedades enviadas">sin env.</span>
                                                    }
                                                    <div className="flex items-center gap-0.5">
                                                        {(Number(ci.q_visitas_CI) > 0) && <span className="text-[9px] font-black px-1 py-0.5 rounded bg-indigo-50 text-indigo-700 tracking-tighter" title="Visitas">{ci.q_visitas_CI}v</span>}
                                                        {ci.comprado_fecha && ci.comprado_fecha !== '0000-00-00 00:00:00' && <span className="text-[9px] font-black px-1 py-0.5 rounded bg-green-100 text-green-700 tracking-tighter">✓</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            {cols.map(c => (
                                            <td key={c} className={`px-3 py-2.5 whitespace-nowrap ${COMP.has(c) ? 'bg-blue-50/20' : ''}`}>
                                                <Cell val={ci[c]} col={c} />
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Society Detail ────────────────────────────────────────────────────────
function SocDetail({ ci, grupos, cols, loading, error }: {
    ci: any | null; grupos: ReturnType<typeof groupSociedades>; cols: string[];
    loading: boolean; error: string | null;
}) {
    const [open, setOpen] = useState<Set<string>>(new Set(['compro', 'oferto', 'hab_vio']));
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const tog = (k: string) => setOpen(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) return prev.direction === 'asc' ? { key, direction: 'desc' } : null;
            return { key, direction: 'asc' };
        });
    };

    if (!ci) return null;

    const tropa = ci.id_revisacion ?? ci[Object.keys(ci)[0]];
    const total = grupos.reduce((s, g) => s + g.rows.length, 0);

    return (
        <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white">

            {loading && (
                <div className="bg-white flex items-center justify-center py-10 gap-3 text-gray-400">
                    <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    <span className="text-sm font-bold">Cargando desde Metabase…</span>
                </div>
            )}
            {!loading && error && (
                <div className="bg-white flex flex-col items-center py-10 text-red-400 gap-2">
                    <span className="text-2xl">⚠️</span>
                    <p className="text-sm font-bold">{error}</p>
                </div>
            )}
            {!loading && !error && total === 0 && (
                <div className="bg-white flex flex-col items-center py-10 text-gray-400 gap-2">
                    <span className="text-3xl opacity-30">🔍</span>
                    <p className="text-sm font-bold">Sin sociedades para esta CI</p>
                    <p className="text-xs text-center max-w-xs opacity-70">Esta CI puede estar excluida del monitor por provincia/partido. Revisar en Q4568.</p>
                    <p className="text-[10px] font-mono bg-gray-50 px-3 py-1 rounded">id_revisacion #{tropa}</p>
                </div>
            )}
            {!loading && !error && total > 0 && (
                <>
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b overflow-x-auto">
                        {grupos.map(g => {
                            const th = GROUP_THEME[g.color]; return (
                                <span key={g.key} className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${th.badge}`}>{g.icon} {g.rows.length} {g.title.split('·')[0].trim()}</span>
                            );
                        })}
                    </div>
                    <div className="bg-white divide-y divide-gray-100">
                        {grupos.map(g => {
                            const th = GROUP_THEME[g.color]; const isOpen = open.has(g.key);
                            
                            let displayRows = [...g.rows];
                            if (sortConfig) {
                                displayRows.sort((a, b) => {
                                    const valA = a[sortConfig.key];
                                    const valB = b[sortConfig.key];
                                    const numA = Number(valA);
                                    const numB = Number(valB);
                                    const aIsNum = valA !== null && valA !== '' && !isNaN(numA);
                                    const bIsNum = valB !== null && valB !== '' && !isNaN(numB);
                                    
                                    if (aIsNum && bIsNum) {
                                        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
                                    }
                                    const strA = String(valA ?? '').toLowerCase();
                                    const strB = String(valB ?? '').toLowerCase();
                                    if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
                                    if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
                                    return 0;
                                });
                            }

                            return (
                                <div key={g.key}>
                                    <button onClick={() => tog(g.key)} className={`w-full flex items-center justify-between px-4 py-2.5 ${th.hdr}`}>
                                        <span className="text-xs font-black uppercase tracking-wider">{g.icon} {g.title}</span>
                                        <span className="flex items-center gap-2">
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black/20">{g.rows.length}</span>
                                            <span className="text-[10px] opacity-70">{isOpen ? '▲' : '▼'}</span>
                                        </span>
                                    </button>
                                    {isOpen && cols.length > 0 && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-50 border-b select-none">
                                                    <tr>{cols.map(c => (
                                                        <th key={c} onClick={() => handleSort(c)} className="cursor-pointer hover:bg-gray-200 px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap transition-colors">
                                                            {lbl(c)}
                                                            {sortConfig?.key === c && (
                                                                <span className="ml-1 text-gray-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                                            )}
                                                        </th>
                                                    ))}</tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {displayRows.map((r, i) => (
                                                        <tr key={i} className={th.row}>
                                                            {cols.map(c => <td key={c} className="px-4 py-2.5 whitespace-nowrap"><Cell val={r[c]} col={c} /></td>)}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
