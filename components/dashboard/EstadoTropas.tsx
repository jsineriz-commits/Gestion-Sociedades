'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { normalizeUN, UN_BG } from '@/lib/utils/unColors';
import CowLoader from '@/components/ui/CowLoader';

interface Props {
    acName?: string | null;
    acId?: number | null;
    canal?: string | null;
    isAdmin?: boolean;
    selectedYear?: number;
    selectedMes?: number;
    filterCierre?: boolean;
    refreshTrigger?: number;
    lotes?: any[];
    initialTropas?: any[] | null; // datos pre-cargados desde DashboardClient
}

import { normalizeEstado, ESTADO_CFG } from '@/lib/utils/estados';

const DEFAULT_CFG = { icon: '📋', color: 'text-gray-500', bg: 'bg-gray-50', ring: 'ring-gray-100', order: 50 };

// Estados que cuentan como "concretados"
const ESTADOS_CONCRETADOS = new Set([
    'Cerrada', 'Negocios Terminados', 'Liquidadas', 'A Liquidar', 
    'Tropas Vendidas', 'A Cargar', 'Tropas Cargadas', 'Faenadas', 'Pagos Vencidos'
]);
const ESTADOS_PENDIENTES  = new Set(['A Cargar', 'Cargadas']);
const ESTADOS_NO_CONC     = new Set(['No Concretadas']);
const ESTADOS_BAJA        = new Set(['Dadas de Baja']);

// Estados de estado_tropas que indican una operación concretada/en proceso
// (tienen prioridad sobre estado_general cuando hay inconsistencia)
const ESTADOS_TROPAS_CONCRETADOS = new Set([
    'Tropas Vendidas', 'A Cargar', 'Cargadas', 'Faenadas',
    'A Liquidar', 'Liquidadas', 'Negocios Terminados', 'Cerrada', 'Pagos Vencidos'
]);

function fNum(n: number | null | undefined) {
    return (n ?? 0).toLocaleString('es-AR');
}
function fMoney(n: number | null | undefined) {
    const v = Number(n) || 0;
    if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    return `$${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function fNumK(n: number | null | undefined) {
    const v = Number(n) || 0;
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (abs >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
    return v.toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

function fMoneyK(n: number | null | undefined) {
    const v = Number(n) || 0;
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
    return `${sign}$${abs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function fDate(d: Date) {
    return d.toISOString().split('T')[0];
}
function toInputDate(iso: string) {
    return iso.split('T')[0];
}

export default function EstadoTropas({ acId, acName, canal, isAdmin, selectedYear, selectedMes, filterCierre, refreshTrigger, lotes, initialTropas }: Props) {
    const [tropas, setTropas] = useState<any[]>(initialTropas || []);
    const [loading, setLoading] = useState(!initialTropas);
    const [error, setError] = useState<string | null>(null);
    const [cachedAt, setCachedAt] = useState<string | null>(null);

    // ── Control de re-fetch manual ────────────────────────────────────
    const [triggerFetch, setTriggerFetch] = useState(0);

    const derivarFechas = useCallback(() => {
        let y = selectedYear || new Date().getFullYear();
        let m = selectedMes || 0;
        let d1, d2;

        if (filterCierre) {
            if (m === 0) { return { desde: `${y}-01-26`, hasta: `${y + 1}-01-25` }; }
            if (m === 1) { y--; m = 12; } else { m--; }
            const p = String(m).padStart(2, '0');
            const n = String(m === 12 ? 1 : m + 1).padStart(2, '0');
            d1 = `${y}-${p}-26`;
            d2 = `${m === 12 ? y + 1 : y}-${n}-25`;
        } else {
            if (m === 0) { d1 = `${y}-01-01`; d2 = `${y}-12-31`; }
            else {
                const ms = String(m).padStart(2, '0');
                const last = new Date(y, m, 0).getDate();
                d1 = `${y}-${ms}-01`; d2 = `${y}-${ms}-${last}`;
            }
        }
        return { desde: d1, hasta: d2 };
    }, [selectedYear, selectedMes, filterCierre]);

    useEffect(() => {
        // Mostrar CowLoader en cada recarga (filtro de período, usuario, o manual)
        // Solo silencioso en el primer render si hay datos prefetcheados
        const hasPrefetch = !!initialTropas && tropas.length > 0 && triggerFetch === 0;
        if (!hasPrefetch) {
            setLoading(true);
            setError(null);
        }
        let mounted = true;
        const { desde, hasta } = derivarFechas();
        const p = new URLSearchParams({ fecha_desde: desde, fecha_hasta: hasta });
        if (isAdmin) p.set('isAdmin', 'true');
        if (canal) p.set('canal', canal);
        if (acId !== undefined && acId !== null) p.set('acId', String(acId));
        if (acName) p.set('acName', acName);

        fetch(`/api/regional/tropas?${p.toString()}`)
            .then(r => { if (!r.ok) throw new Error('Error al cargar Tropas (Q95)'); return r.json(); })
            .then(d => {
                if (mounted) {
                    setTropas(d.tropas || []);
                    setCachedAt(d._cachedAt || null);
                    setLoading(false);
                }
            })
            .catch(e => {
                if (mounted) {
                    setError(e.message);
                    setLoading(false);
                }
            });
        return () => { mounted = false; };
    // Auto-recarga cuando cambia: usuario, período (año/mes/cierre) o trigger manual/global
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, canal, acId, acName, selectedYear, selectedMes, filterCierre, refreshTrigger, triggerFetch]);

    const handleRefresh = () => {
        setTriggerFetch(n => n + 1);
    };

    const [search, setSearch] = useState('');
    const [unFilter, setUnFilter] = useState<string>('all');
    const [expanded, setExpanded] = useState<Set<string>>(new Set()); // todo colapsado por defecto
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selectedTropa, setSelectedTropa] = useState<any | null>(null);
    const [expandedRow, setExpandedRow] = useState<any | null>(null);
    const [vcFilter, setVcFilter] = useState<'all' | 'venta' | 'compra'>('all');
    const [sortCol, setSortCol] = useState<string>('fecha_operacion');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const toggleSort = (col: string) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('desc'); }
    };

    const sortRows = (rows: any[]): any[] => {
        return [...rows].sort((a, b) => {
            let av: any = a[sortCol];
            let bv: any = b[sortCol];
            if (sortCol === 'fecha_operacion') {
                av = av ? new Date(av).getTime() : 0;
                bv = bv ? new Date(bv).getTime() : 0;
            } else if (typeof av === 'string') {
                av = (av || '').toLowerCase();
                bv = (bv || '').toLowerCase();
            } else {
                av = Number(av) || 0;
                bv = Number(bv) || 0;
            }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const SortTh = ({ label, col, align = 'text-left' }: { label: string; col: string; align?: string }) => (
        <th
            className={`px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap ${align} cursor-pointer select-none hover:text-gray-600 transition-colors`}
            onClick={() => toggleSort(col)}
        >
            {label}{sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
        </th>
    );

    const tropasAll = useMemo(() => {
        const base = [...tropas];
        if (lotes && lotes.length > 0) {
            const mapQ95 = new Set(base.map(t => String(t.id_lote)));
            const activos = lotes.filter((l: any) => l.estado === 'Publicado' || l.activo === true || l.publicado === true || (!l.estado && !l.cierre));
            
            activos.forEach(l => {
                if (!mapQ95.has(String(l.id))) {
                    base.push({
                        id_lote: l.id,
                        fecha_operacion: l.dia_hora_publicacion || l.fecha_publicacion || null,
                        fecha_publicaciones: l.dia_hora_publicacion || l.fecha_publicacion || null,
                        Tipo: l.categoria || l.Tipo || l.UN || 'S/D',
                        UN: l.categoria || l.Tipo || l.UN || 'S/D',
                        categoria: l.categoria,
                        origen: l.provincia && l.localidad ? `${l.localidad}, ${l.provincia}` : (l.origen || 'S/D'),
                        kg: l.peso || 0,
                        RS_Vendedora: l.sociedad_vendedora || l.RS_Vendedora || '—',
                        RS_Compradora: '—',
                        Cabezas: l.cabezas_venta || l.cabezas || l.Cabezas || 0,
                        importe_vendedor: 0,
                        resultado_final: 0,
                        resultado_total_proyectado: 0,
                        rendimiento: l.condicion_rendimiento || null,
                        repre_vendedor: l.representante || '—',
                        repre_comprador: '—',
                        AC_Vend: l.vendedor_ac || l.operador || '—',
                        AC_Comp: '—',
                        estado_general: 'PUBLICADA',
                        estado_tropas: 'Publicadas'
                    });
                }
            });
        }
        return base;
    }, [tropas, lotes]);

    const availableUNs = useMemo(() => {
        const set = new Set<string>();
        tropas.forEach(t => set.add(normalizeUN(t.UN || t.Tipo || '')));
        return Array.from(set).filter(Boolean).sort();
    }, [tropas]);

    // Agrupación normalizada
    const grupos = useMemo(() => {
        const q = search.toLowerCase();
        // Filtro V/C: si hay acName seleccionado, filtra por si ESE comercial es el V o el C.
        // Si no hay acName (vista general), filtra por si el campo V o C existe.
        const matchesAcName = (field: string | null | undefined) => {
            if (!field) return false;
            if (acName) {
                // Match exacto por nombre completo para evitar cruce entre usuarios con mismo primer nombre
                return String(field).toLowerCase().trim() === acName.toLowerCase().trim();
            }
            return String(field).trim() !== '';
        };
        const vcFiltered = vcFilter === 'venta'
            ? tropasAll.filter(t => matchesAcName(t.AC_Vend))
            : vcFilter === 'compra'
            ? tropasAll.filter(t => matchesAcName(t.AC_Comp))
            : tropasAll;

        // Filtro UN
        const unFiltered = unFilter === 'all'
            ? vcFiltered
            : vcFiltered.filter(t => normalizeUN(t.UN || t.Tipo || '') === unFilter);

        const filtered = q
            ? unFiltered.filter(t =>
                (t.RS_Vendedora || '').toLowerCase().includes(q) ||
                (t.RS_Compradora || '').toLowerCase().includes(q) ||
                String(t.id_lote || '').includes(q) ||
                (t.UN || t.Tipo || '').toLowerCase().includes(q) ||
                (t.estado_tropas || '').toLowerCase().includes(q))
            : unFiltered;

        const map: Record<string, any[]> = {};
        filtered.forEach(t => {
            const label = normalizeEstado(t.estado_tropas || 'Sin Estado');
            if (!map[label]) map[label] = [];
            map[label].push(t);
        });

        return Object.entries(map)
            .map(([estado, rows]) => ({
                estado,
                rows: sortRows(rows),
                cfg: ESTADO_CFG[estado] || DEFAULT_CFG,
            }))
            .sort((a, b) => (a.cfg.order ?? 99) - (b.cfg.order ?? 99));
    }, [tropasAll, search, vcFilter, sortCol, sortDir, unFilter]);

    // KPIs globales — 3 grupos semánticos
    const totalTropas  = tropasAll.length;
    const totalCabezas = tropasAll.reduce((s, t) => s + (Number(t.Cabezas) || 0), 0);
    const totalImporte = tropasAll.reduce((s, t) => s + (Number(t.importe_vendedor) || 0), 0);

    // Helper: resultado prorateado según el rol del AC en la operación
    // Regla: solo venta=2/3, solo compra=1/3, ambas=3/3 (completo)
    const resultadoParaAC = (t: any): number => {
        const resRaw = Number(t.resultado_final) || 0;
        if (!resRaw) return 0;
        if (isAdmin) return resRaw;
        if (acName) {
            const nameLower = acName.toLowerCase().trim();
            const isV = t.AC_Vend && String(t.AC_Vend).toLowerCase().trim() === nameLower;
            const isC = t.AC_Comp && String(t.AC_Comp).toLowerCase().trim() === nameLower;
            if (isV && isC) return resRaw;          // 3/3
            if (isV) return resRaw * (2 / 3);       // 2/3
            if (isC) return resRaw * (1 / 3);       // 1/3
            return 0;
        }
        // Vista general sin filtro de AC: usar la suma de ambas partes según vcFilter
        if (vcFilter === 'venta')  return resRaw * (2 / 3);
        if (vcFilter === 'compra') return resRaw * (1 / 3);
        return resRaw;
    };

    // Breakdown Venta / Compra
    const ventaTropas  = tropasAll.filter(t => t.AC_Vend && String(t.AC_Vend).trim() !== '');
    const compraTropas = tropasAll.filter(t => t.AC_Comp && String(t.AC_Comp).trim() !== '');
    const cbzsVenta    = ventaTropas.reduce((s, t)  => s + (Number(t.Cabezas) || 0), 0);
    const cbzsCompra   = compraTropas.reduce((s, t) => s + (Number(t.Cabezas) || 0), 0);
    const impVenta     = ventaTropas.reduce((s, t)  => s + (Number(t.importe_vendedor) || 0), 0);
    const impCompra    = compraTropas.reduce((s, t) => s + (Number(t.importe_comprador) || 0), 0);

    // Pendientes (A Cargar + Cargadas)
    const pendientes = tropasAll.filter(t => ESTADOS_PENDIENTES.has(normalizeEstado(t.estado_tropas || '')));

    // Concretadas: usar estado_tropas como fuente de verdad cuando indica un estado operativo;
    // Si estado_tropas está en set concretados → concretada, aunque estado_general diga otra cosa.
    const concretadasAll = tropasAll.filter(t => {
        const normTrop = normalizeEstado(t.estado_tropas || '');
        if (ESTADOS_TROPAS_CONCRETADOS.has(normTrop)) return true;
        return (t.estado_general || '').toUpperCase() === 'CONCRETADA';
    });
    
    // Pipeline Mostrar: Concretadas + Publicadas/Ofrecimientos
    const pipelineMostrar = tropasAll.filter(t => {
        const normTrop = normalizeEstado(t.estado_tropas || '');
        // estado_tropas con operación concretada → siempre en pipeline
        if (ESTADOS_TROPAS_CONCRETADOS.has(normTrop)) return true;
        const eg = (t.estado_general || '').toUpperCase();
        if (eg === 'CONCRETADA') return true;
        if (normTrop === 'Publicadas' || normTrop === 'Ofrecimientos') return true;
        return false;
    });

    // No concretadas: excluir las que tengan estado_tropas operativo (A Cargar, etc.)
    const noConcretadas = tropasAll.filter(t => {
        const normTrop = normalizeEstado(t.estado_tropas || '');
        // Si estado_tropas indica una op concretada, NO es no-concretada aunque estado_general diga otra cosa
        if (ESTADOS_TROPAS_CONCRETADOS.has(normTrop)) return false;
        const eg = (t.estado_general || '').toUpperCase();
        return eg === 'NO CONCRETADAS' || eg === 'NO CONCRETADA';
    });

    // Bajas
    const bajas = tropasAll.filter(t => {
        const normTrop = normalizeEstado(t.estado_tropas || '');
        if (ESTADOS_TROPAS_CONCRETADOS.has(normTrop)) return false; // mismo criterio
        return (t.estado_general || '').toUpperCase() === 'BAJA';
    });

    const toggleExpand = (est: string) => setExpanded(prev => {
        const next = new Set(prev);
        next.has(est) ? next.delete(est) : next.add(est);
        return next;
    });

    return (
        <div className="space-y-5">
            {/* CowLoader cuando carga */}
            {loading && <CowLoader message="Cargando Estado Tropas (Q95)..." />}

            {!loading && (
            <>{/* Card principal */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                {/* Fuente + botón actualizar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <p className="text-[10px] text-gray-400">
                            Fuente: Q95 · metabase.dcac.ar
                            {cachedAt && <span className="ml-2 opacity-60">· act. {new Date(cachedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>}
                        </p>
                    </div>
                    {/* Botón Actualizar */}
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all shadow-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        title="Forzar actualización de datos"
                    >
                        <span className="text-sm">🐄</span>
                        <span>Actualizar</span>
                    </button>
                </div>

                {/* KPIs — 2 columnas: Concretadas | No Concretadas + Bajas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">

                    {/* ── Izquierda: Concretadas ── */}
                    <div className={`border rounded-xl px-4 py-3 ${filterCierre ? 'bg-emerald-100 border-emerald-300' : 'bg-emerald-50 border-emerald-100'}`}>
                        {/* Totales */}
                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PIPELINE {filterCierre ? '🔒 cierre' : ''}</p>
                                <p className="text-2xl font-black text-emerald-700">{fNum(pipelineMostrar.length)} <span className="text-xs font-semibold text-gray-400">tropas</span></p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cabezas</p>
                                <p className="text-2xl font-black text-blue-700">{fNum(pipelineMostrar.reduce((s, t) => s + (Number(t.Cabezas) || 0), 0))}</p>
                            </div>
                        </div>
                        {/* Desglose por estado — usando pipelineMostrar */}
                        {(() => {
                            const byEst: Record<string, { tropas: number; cbzs: number }> = {};
                            pipelineMostrar.forEach((t: any) => {
                                const est = normalizeEstado(t.estado_tropas || '');
                                if (!byEst[est]) byEst[est] = { tropas: 0, cbzs: 0 };
                                byEst[est].tropas++;
                                byEst[est].cbzs += Number(t.Cabezas) || 0;
                            });
                            const items = Object.entries(byEst)
                                .sort((a, b) => (ESTADO_CFG[a[0]]?.order ?? 99) - (ESTADO_CFG[b[0]]?.order ?? 99));
                            if (items.length === 0) return null;
                            return (
                                <div className="border-t border-emerald-100 pt-1.5 space-y-0.5">
                                    {/* Header mini-tabla */}
                                    <div className="flex justify-between text-[9px] text-gray-400 font-semibold uppercase tracking-wide pb-0.5">
                                        <span>Estado</span>
                                        <div className="flex gap-4">
                                            <span className="w-10 text-right">tropas</span>
                                            <span className="w-10 text-right">cab</span>
                                        </div>
                                    </div>
                                    {items.map(([est, d]) => (
                                        <div key={est} className="flex justify-between items-center text-[9px]">
                                            <span className="text-gray-600 flex items-center gap-0.5 truncate">
                                                {ESTADO_CFG[est]?.icon ?? '📋'} {est.replace('Tropas ', '').replace('Negocios ', '')}
                                            </span>
                                            <div className="flex gap-4 flex-shrink-0">
                                                <span className="w-10 text-right font-bold text-gray-700">{fNum(d.tropas)}</span>
                                                <span className="w-10 text-right font-bold text-blue-700">{fNum(d.cbzs)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    {/* ── Derecha: No Concretadas + Bajas ── */}
                    <div className="space-y-2">
                        {/* No Concretadas */}
                        <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                            <div className="flex items-start justify-between mb-1.5">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">❌ No Concretadas</p>
                                    <p className="text-2xl font-black text-rose-700">{fNum(noConcretadas.length)} <span className="text-xs font-semibold text-gray-400">tropas</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cabezas</p>
                                    <p className="text-xl font-black text-rose-600">{fNum(noConcretadas.reduce((s, t) => s + (Number(t.Cabezas) || 0), 0))}</p>
                                </div>
                            </div>
                            {/* Motivos: agrupados por estado_tropas raw */}
                            {(() => {
                                const byRaw: Record<string, number> = {};
                                noConcretadas.forEach((t: any) => {
                                    const raw = (t.estado_tropas || 'Sin motivo').trim();
                                    byRaw[raw] = (byRaw[raw] || 0) + 1;
                                });
                                const items = Object.entries(byRaw).sort((a, b) => b[1] - a[1]);
                                if (items.length === 0 || (items.length === 1 && items[0][0] === 'Sin motivo')) return null;
                                return (
                                    <div className="border-t border-rose-100 pt-1.5 space-y-0.5">
                                        {items.map(([raw, count]) => (
                                            <div key={raw} className="flex justify-between text-[9px]">
                                                <span className="text-rose-600 truncate">{raw}</span>
                                                <span className="font-bold text-rose-700 ml-1 flex-shrink-0">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Bajas */}
                        <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                            <div className="flex items-start justify-between mb-1.5">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">🗑️ Dadas de Baja</p>
                                    <p className="text-2xl font-black text-orange-700">{fNum(bajas.length)} <span className="text-xs font-semibold text-gray-400">tropas</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cabezas</p>
                                    <p className="text-xl font-black text-orange-600">{fNum(bajas.reduce((s, t) => s + (Number(t.Cabezas) || 0), 0))}</p>
                                </div>
                            </div>
                            {/* Motivos bajas */}
                            {(() => {
                                const byRaw: Record<string, number> = {};
                                bajas.forEach((t: any) => {
                                    const raw = (t.estado_tropas || 'Sin motivo').trim();
                                    byRaw[raw] = (byRaw[raw] || 0) + 1;
                                });
                                const items = Object.entries(byRaw).sort((a, b) => b[1] - a[1]);
                                if (items.length === 0 || (items.length === 1 && items[0][0] === 'Sin motivo')) return null;
                                return (
                                    <div className="border-t border-orange-100 pt-1.5 space-y-0.5">
                                        {items.map(([raw, count]) => (
                                            <div key={raw} className="flex justify-between text-[9px]">
                                                <span className="text-orange-600 truncate">{raw}</span>
                                                <span className="font-bold text-orange-700 ml-1 flex-shrink-0">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                </div>

                {/* Filtro por estado — desplegable */}
                {grupos.length > 0 && (
                    <div className="border-t border-gray-100 pt-3 mt-3">
                        <button
                            onClick={() => setFiltersOpen(v => !v)}
                            className="flex items-center gap-2 text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-wider"
                        >
                            <span>{filtersOpen ? '▲' : '▼'}</span>
                            <span>Filtrar por estado</span>
                            {expanded.size > 0 && (
                                <span className="bg-[#eaf2f6] text-[#3179a7] rounded-full px-1.5 py-0.5 text-[9px] font-semibold">{expanded.size} activos</span>
                            )}
                        </button>
                        {filtersOpen && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {grupos.map(g => (
                                    <button
                                        key={g.estado}
                                        onClick={() => toggleExpand(g.estado)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ring-1 transition-all ${
                                            expanded.has(g.estado)
                                                ? `${g.cfg.bg} ${g.cfg.color} ${g.cfg.ring} ring-2`
                                                : 'bg-gray-50 text-gray-500 ring-gray-200 hover:ring-gray-300'
                                        }`}
                                    >
                                        <span>{g.cfg.icon}</span>
                                        <span>{g.estado}</span>
                                        <span className="bg-white/60 rounded-full px-1.5 py-0.5 text-[10px]">{g.rows.length}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Búsqueda + filtro V/C */}
            {tropas.length > 0 && (
                <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                    {/* Toggle Venta / Compra */}
                    <div className="flex rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                        {([['all', 'Todas'], ['venta', '🏷️ Venta'], ['compra', '🛒 Compra']] as const).map(([v, label]) => (
                            <button
                                key={v}
                                onClick={() => setVcFilter(v)}
                                className={`px-3 py-2 text-[11px] font-bold transition-colors ${
                                    vcFilter === v
                                        ? v === 'venta' ? 'bg-[#3179a7] text-white' : v === 'compra' ? 'bg-emerald-600 text-white' : 'bg-[#555555] text-white'
                                        : 'bg-white text-[#666666] hover:bg-[#f8f8f8]'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {/* Selector UN */}
                    <select
                        value={unFilter}
                        onChange={e => setUnFilter(e.target.value)}
                        className="px-3 py-2 text-[11px] font-bold bg-white border border-gray-200 rounded-xl outline-none hover:bg-gray-50 transition-colors uppercase cursor-pointer flex-shrink-0"
                    >
                        <option value="all">TODOS LOS TIPOS</option>
                        {availableUNs.map(un => (
                            <option key={un} value={un}>{un.toUpperCase()}</option>
                        ))}
                    </select>
                    {/* Buscador de texto */}
                    <div className="relative flex-1 min-w-[200px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                        <input
                            type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por sociedad, ID, tipo..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-[#ededed] rounded-xl text-[11px] outline-none focus:border-[#3179a7] transition-colors font-medium text-[#555555] placeholder:text-[#c0c0c0]"
                        />
                    </div>
                </div>
            )}

            {/* Estado UI manejado globalmente ahora */}

            {/* Grupos colapsables */}
            {grupos.map(g => (
                <div key={g.estado} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Header del grupo */}
                    <button
                        onClick={() => toggleExpand(g.estado)}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                    >
                        {/* Izquierda: icono + nombre + resumen */}
                        <div className="flex items-center gap-3 min-w-0">
                            <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${g.cfg.bg} ring-1 ${g.cfg.ring}`}>
                                {g.cfg.icon}
                            </span>
                            <div className="text-left min-w-0">
                                <p className={`text-sm font-black ${g.cfg.color}`}>{g.estado}</p>
                                <p className="text-[10px] text-gray-400 font-semibold">
                                    {fNum(g.rows.length)} tropas · {fNum(g.rows.reduce((s, r) => s + (Number(r.Cabezas) || 0), 0))} cab
                                </p>
                            </div>
                        </div>
                        {/* Derecha: importe + resultado + flecha */}
                        <div className="flex items-center gap-4 flex-shrink-0">
                            {!expanded.has(g.estado) && (() => {
                                const totalImp = g.rows.reduce((s, r) => s + (Number(r.importe_vendedor) || 0), 0);
                                const totalRes = g.rows.reduce((s, r) => s + (Number(r.resultado_final) || 0), 0);
                                return (
                                    <div className="hidden sm:flex items-center gap-4 text-right">
                                        {totalImp > 0 && <div>
                                            <p className="text-[8px] text-gray-400 uppercase font-bold">Importe</p>
                                            <p className="text-[11px] font-black text-gray-600">{fMoneyK(totalImp)}</p>
                                        </div>}
                                        {totalRes !== 0 && <div>
                                            <p className="text-[8px] text-gray-400 uppercase font-bold">Resultado</p>
                                            <p className={`text-[11px] font-black ${totalRes >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fMoneyK(totalRes)}</p>
                                        </div>}
                                    </div>
                                );
                            })()}
                            <span className={`text-2xl font-black ${g.cfg.color}`}>{fNum(g.rows.length)}</span>
                            <span className="text-gray-400 text-sm">{expanded.has(g.estado) ? '▲' : '▼'}</span>
                        </div>
                    </button>

                    {/* Tabla detalle */}
                    {expanded.has(g.estado) && (
                        <div className="border-t border-gray-100 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <SortTh label="Lote"         col="id_lote" />
                                        <SortTh label="F. Op."       col="fecha_operacion" />
                                        <SortTh label="Vendedor"     col="RS_Vendedora" />
                                        <SortTh label="Comprador"    col="RS_Compradora" />
                                        <SortTh label="Repre. Vend." col="repre_vendedor" />
                                        <SortTh label="Repre. Comp." col="repre_comprador" />
                                        <SortTh label="UN"           col="Tipo" />
                                        <SortTh label="Cabezas"      col="Cabezas"      align="text-right" />
                                        <SortTh label="$ Importe"    col="importe_vendedor" align="text-right" />
                                        <SortTh label="$ Res. Total" col="resultado_total_proyectado" align="text-right" />
                                        <SortTh label="$ Res. Regional" col="resultado_final" align="text-right" />
                                        <SortTh label="% Rend"       col="rendimiento" align="text-right" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {g.rows.slice(0, 50).map((t, i) => {
                                        const isExpanded = expandedRow?.id_lote === t.id_lote;
                                        
                                        return (
                                        <React.Fragment key={i}>
                                            <tr onClick={() => setSelectedTropa((prev: any) => prev?.id_lote === t.id_lote ? null : t)} className={`cursor-pointer transition-colors ${selectedTropa?.id_lote === t.id_lote ? 'bg-[#d6ebf5]' : 'hover:bg-[#eaf2f6]/60'}`}>
                                                <td className="px-2 py-1 font-black text-gray-700 text-[10px] whitespace-nowrap">
                                                    #{t.id_lote}
                                                </td>
                                                <td className="px-2 py-1 text-gray-500 text-[10px] whitespace-nowrap">
                                                    {t.fecha_operacion ? new Date(t.fecha_operacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                                                </td>
                                                <td className="px-2 py-1 text-[10px] max-w-[130px]">
                                                    <p className="font-semibold text-gray-900 truncate">{t.RS_Vendedora || '—'}</p>
                                                    <p className="text-[9px] text-[#3179a7] font-semibold truncate">{t.AC_Vend || '—'}</p>
                                                </td>
                                                <td className="px-2 py-1 text-[10px] max-w-[130px]">
                                                    {t.RS_Compradora
                                                        ? <p className="font-semibold text-gray-800 truncate">{t.RS_Compradora}</p>
                                                        : <p className="text-gray-300 italic text-[9px]">Sin comprador</p>
                                                    }
                                                    <p className="text-[9px] text-gray-500 font-bold truncate">{t.AC_Comp || '—'}</p>
                                                </td>
                                                <td className="px-2 py-1 text-[10px] whitespace-nowrap">
                                                    {t.repre_vendedor
                                                        ? <span className="px-1.5 py-0.5 rounded-full bg-[#eaf2f6] text-[#235677] font-semibold text-[9px] whitespace-nowrap block">{t.repre_vendedor}</span>
                                                        : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-2 py-1 text-[10px] whitespace-nowrap">
                                                    {t.repre_comprador
                                                        ? <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold text-[9px] whitespace-nowrap block">{t.repre_comprador}</span>
                                                        : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-2 py-1 text-[10px]">
                                                    {(() => { const un = normalizeUN(t.UN || t.Tipo || ''); const bg = UN_BG[un]; return bg
                                                        ? <span className={`px-1.5 py-0.5 rounded ${bg} text-white font-bold text-[9px]`}>{un}</span>
                                                        : <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-bold text-[9px]">{un || '—'}</span>;
                                                    })()}
                                                </td>
                                                <td className="px-2 py-1 font-black text-gray-900 text-[10px] text-right whitespace-nowrap">{fNum(t.Cabezas)}</td>
                                                <td className="px-2 py-1 text-[10px] text-gray-600 font-bold text-right whitespace-nowrap">{fMoneyK(t.importe_vendedor)}</td>
                                                {/* $ Resultado: siempre resultado_final */}
                                                <td className="px-2 py-1 text-[10px] font-bold text-right whitespace-nowrap text-[#3179a7]">
                                                    {t.resultado_final ? fMoneyK(t.resultado_final) : <span className="text-gray-300">—</span>}
                                                </td>
                                                {/* Resultado Regional (ajustado) */}
                                                <td className="px-2 py-1 text-[10px] font-black text-right whitespace-nowrap">
                                                    {(() => {
                                                        const resRaw = Number(t.resultado_final) || 0;
                                                        let val: number | null = null;
                                                        
                                                        if (isAdmin) val = resRaw;
                                                        else if (acName) {
                                                            const nameLower = acName.toLowerCase().trim();
                                                            const isV = t.AC_Vend && String(t.AC_Vend).toLowerCase().trim() === nameLower;
                                                            const isC = t.AC_Comp && String(t.AC_Comp).toLowerCase().trim() === nameLower;
                                                            if (isV && isC) val = resRaw;
                                                            else if (isV) val = resRaw * (2/3);
                                                            else if (isC) val = resRaw * (1/3);
                                                        } else {
                                                            if (vcFilter === 'venta') val = resRaw * (2/3);
                                                            else if (vcFilter === 'compra') val = resRaw * (1/3);
                                                            else val = resRaw;
                                                        }
                                                        if (val === null || val === 0) return <span className="text-gray-300">—</span>;
                                                        return <span className={val < 0 ? 'text-rose-700' : 'text-emerald-700'}>{fMoneyK(val)}</span>;
                                                    })()}
                                                </td>
                                                <td className={`px-3 py-2 text-[10px] font-bold text-right whitespace-nowrap ${Number(t.rendimiento || 0) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                    {t.rendimiento != null ? Number(t.rendimiento).toFixed(2) + '%' : '—'}
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-slate-50 border-b border-gray-100">
                                                    <td colSpan={11} className="px-8 py-4">
                                                        <div className="flex items-center gap-6">
                                                            <div>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Categoría</p>
                                                                <p className="text-xs font-black text-slate-800">{t.categoria || 'Sin datos'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Peso / Cabz</p>
                                                                <p className="text-xs font-black text-slate-800">{t.kg ? fNum(t.kg) + ' kg' : 'S/D'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Origen (Prov)</p>
                                                                <p className="text-xs font-black text-slate-800">{t.origen || 'S/D'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Destino</p>
                                                                <p className="text-xs font-black text-slate-800">{t.destino || 'S/D'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">AEP</p>
                                                                <p className="text-xs font-black text-slate-800">
                                                                    {t.AEP !== undefined && t.AEP !== null && String(t.AEP).trim() !== '' ? `${t.AEP} días` : 'S/D'}
                                                                </p>
                                                            </div>
                                                            
                                                            {(t.Motivo_NC && t.Motivo_NC !== '-' && t.Motivo_NC !== '0') && (
                                                                <div>
                                                                    <p className="text-[9px] font-bold text-rose-400 uppercase tracking-wider mb-1">Motivo Baja/NC</p>
                                                                    <p className="text-xs font-black text-rose-700">{t.Motivo_NC}</p>
                                                                </div>
                                                            )}
                                                            
                                                            {Number(t.atraso_pago) > 0 && (
                                                                <div>
                                                                    <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mb-1">Atraso Pago</p>
                                                                    <p className="text-xs font-black text-amber-700">{t.atraso_pago} días</p>
                                                                </div>
                                                            )}

                                                            {(t.Canal_Venta || t.Canal_compra) && (
                                                                <div>
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Canales</p>
                                                                    <p className="text-[10px] font-bold text-slate-600">V: {t.Canal_Venta || '—'}</p>
                                                                    <p className="text-[10px] font-bold text-slate-600">C: {t.Canal_compra || '—'}</p>
                                                                </div>
                                                            )}
                                                            
                                                            <div className="ml-auto">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedTropa(t); }}
                                                                    className="px-4 py-1.5 rounded-full bg-white border border-gray-200 text-[10px] font-bold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors uppercase tracking-wider"
                                                                >
                                                                    Ver Detalle Financiero Completo →
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {g.rows.length > 50 && (
                                <p className="text-center py-3 text-xs text-gray-400 border-t border-gray-50">
                                    Mostrando 50 de {g.rows.length}
                                </p>
                            )}
                            <div className="bg-emerald-50 border-t border-emerald-100 flex items-center justify-between px-3 py-2 text-[10px] font-black text-emerald-800">
                                <div className="flex gap-4">
                                    <span>TOTALES:</span>
                                    <span>{fNumK(g.rows.reduce((s,t) => s + (Number(t.Cabezas)||0), 0))} CABEZAS</span>
                                </div>
                                <div className="flex gap-4">
                                    {isAdmin && <span className="text-[#3179a7]">T: {fMoneyK(g.rows.reduce((s,t) => s + (Number(t.resultado_total_proyectado)||0), 0))}</span>}
                                    <span>AJ: {fMoneyK(g.rows.reduce((s, t) => s + resultadoParaAC(t), 0))}</span>
                                    <span>REND: {(() => {
                                        const rowsConRend = g.rows.filter(t => t.rendimiento != null && Number(t.rendimiento) > 0);
                                        const totalCbzs = rowsConRend.reduce((s,t) => s + (Number(t.Cabezas)||0), 0);
                                        const sumWeighted = rowsConRend.reduce((s,t) => s + ((Number(t.rendimiento)||0) * (Number(t.Cabezas)||0)), 0);
                                        return totalCbzs > 0 ? (sumWeighted / totalCbzs).toFixed(2) + '%' : '—';
                                    })()}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {!loading && !error && tropas.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-300 gap-3">
                    <span className="text-5xl">🐄</span>
                    <p className="text-sm font-semibold text-gray-400">Sin tropas para el período seleccionado</p>
                </div>
            )}

            {/* Modal detalle de tropa */}
            {selectedTropa && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.45)' }}
                    onClick={() => setSelectedTropa(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header compacto */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                            <div className="flex items-center gap-3">
                                {(() => { const un = normalizeUN(selectedTropa.Tipo || selectedTropa.UN || ''); const bg = UN_BG[un]; return bg
                                    ? <span className={`px-2 py-0.5 rounded ${bg} text-white font-black text-[10px]`}>{un}</span>
                                    : <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-600 font-black text-[10px]">{selectedTropa.Tipo || selectedTropa.UN || '—'}</span>;
                                })()}
                                <span className="text-xs font-black text-gray-900">Lote #{selectedTropa.id_lote}</span>
                                <span className="text-[10px] text-gray-400 font-semibold">{selectedTropa.estado_tropas || selectedTropa.Estado_Trop || ''}</span>
                                <span className="text-[10px] font-bold text-gray-500">{selectedTropa.fecha_operacion ? new Date(selectedTropa.fecha_operacion).toLocaleDateString('es-AR') : ''}</span>
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black">{fNum(selectedTropa.Cabezas)} cbz</span>
                            </div>
                            <button onClick={() => setSelectedTropa(null)} className="text-gray-400 hover:text-gray-700 text-lg font-bold leading-none">✕</button>
                        </div>

                        {/* Body compacto: 3 columnas */}
                        <div className="px-4 py-3 grid grid-cols-3 gap-3">

                            {/* Col 1: Vendedor */}
                            <div className="bg-[#eaf2f6] border border-[#bfd5e4] rounded-xl px-3 py-2">
                                <p className="text-[9px] text-[#3179a7] font-bold uppercase tracking-wider mb-1">🏷️ Vendedor</p>
                                <p className="text-[11px] font-black text-gray-900 leading-tight">{selectedTropa.RS_Vendedora || '—'}</p>
                                {selectedTropa.AC_Vend && <p className="text-[9px] text-[#235677] font-semibold mt-0.5">AC: {selectedTropa.AC_Vend}</p>}
                                <p className="text-[9px] text-gray-500">{selectedTropa.repre_vendedor || '—'}</p>
                                {selectedTropa.Canal_Venta && <p className="text-[9px] text-gray-400">{selectedTropa.Canal_Venta}</p>}
                                {selectedTropa.cuit_vend && <p className="text-[9px] text-[#3179a7]">CUIT: {selectedTropa.cuit_vend}</p>}
                                {Number(selectedTropa.bonificacion_vendedor) !== 0 && <p className="text-[9px] text-[#3179a7] font-semibold">Bonif: ${fNum(selectedTropa.bonificacion_vendedor)}</p>}
                            </div>

                            {/* Col 2: Comprador */}
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mb-1">🛒 Comprador</p>
                                <p className="text-[11px] font-black text-gray-900 leading-tight">{selectedTropa.RS_Compradora || '—'}</p>
                                {selectedTropa.AC_Comp && <p className="text-[9px] text-emerald-800 font-semibold mt-0.5">AC: {selectedTropa.AC_Comp}</p>}
                                <p className="text-[9px] text-gray-500">{selectedTropa.repre_comprador || '—'}</p>
                                {selectedTropa.Canal_compra && <p className="text-[9px] text-gray-400">{selectedTropa.Canal_compra}</p>}
                                {selectedTropa.cuit_comp && <p className="text-[9px] text-emerald-700">CUIT: {selectedTropa.cuit_comp}</p>}
                                {Number(selectedTropa.bonificacion_comprador) !== 0 && <p className="text-[9px] text-emerald-600 font-semibold">Bonif: ${fNum(selectedTropa.bonificacion_comprador)}</p>}
                            </div>

                            {/* Col 3: Financiero */}
                            <div className="space-y-2">
                                <div className="bg-gray-50 rounded-lg px-3 py-1.5">
                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Imp. Vend.</p>
                                    <p className="text-[11px] font-black text-emerald-700">{fMoney(selectedTropa.importe_vendedor)}</p>
                                    {selectedTropa.precio_vend && <p className="text-[9px] text-gray-400">${fNum(selectedTropa.precio_vend)}/cab</p>}
                                </div>
                                <div className="bg-gray-50 rounded-lg px-3 py-1.5">
                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Imp. Comp.</p>
                                    <p className="text-[11px] font-black text-indigo-700">{fMoney(selectedTropa.importe_comprador)}</p>
                                    {selectedTropa.precio_comp && <p className="text-[9px] text-gray-400">${fNum(selectedTropa.precio_comp)}/cab</p>}
                                </div>
                                {(() => {
                                    const resRaw = Number(selectedTropa.resultado_final) || 0;
                                    let val: number | null = null;
                                    if (acName) {
                                        const nameLower = acName.toLowerCase().trim();
                                        const isV = selectedTropa.AC_Vend && String(selectedTropa.AC_Vend).toLowerCase().trim() === nameLower;
                                        const isC = selectedTropa.AC_Comp && String(selectedTropa.AC_Comp).toLowerCase().trim() === nameLower;
                                        if (isV && isC) val = resRaw;
                                        else if (isV) val = resRaw * (2/3);
                                        else if (isC) val = resRaw * (1/3);
                                    } else {
                                        if (vcFilter === 'venta') val = resRaw * (2/3);
                                        else if (vcFilter === 'compra') val = resRaw * (1/3);
                                        else val = resRaw;
                                    }
                                    if (!val) return null;
                                    return (
                                        <div className={`rounded-lg px-3 py-1.5 ${val < 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                                            <p className={`text-[9px] font-bold uppercase ${val < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>Resultado AJ.</p>
                                            <p className={`text-[11px] font-black ${val < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{fMoney(val)}</p>
                                            {selectedTropa.rendimiento != null ? <p className={`text-[9px] ${val < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{Number(selectedTropa.rendimiento).toFixed(2)}% rend.</p> : null}
                                        </div>
                                    );
                                })()}
                                {selectedTropa.resultado_total_proyectado ? (
                                    <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase">Proy. Total</p>
                                        <p className="text-[11px] font-black text-slate-700">{fMoney(selectedTropa.resultado_total_proyectado)}</p>
                                    </div>
                                ) : null}
                            </div>

                            {/* Extras — fila completa si hay datos */}
                            {(selectedTropa.ACT_CI || selectedTropa.destino || selectedTropa.Motivo_NC || selectedTropa.usuario_op || selectedTropa.usuario_acotz || Number(selectedTropa.atraso_pago) > 0) && (
                                <div className="col-span-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex flex-wrap gap-x-6 gap-y-1">
                                    {selectedTropa.ACT_CI && <span className="text-[9px] text-amber-800 font-bold">CI: {selectedTropa.ACT_CI}</span>}
                                    {selectedTropa.destino && <span className="text-[9px] text-gray-600">Destino: {selectedTropa.destino}</span>}
                                    {selectedTropa.Motivo_NC && selectedTropa.Motivo_NC !== '-' && <span className="text-[9px] text-rose-700 font-bold">NC: {selectedTropa.Motivo_NC}</span>}
                                    {Number(selectedTropa.atraso_pago) > 0 && <span className="text-[9px] text-amber-700 font-bold">Atraso: {selectedTropa.atraso_pago}d</span>}
                                    {selectedTropa.usuario_op && <span className="text-[9px] text-amber-900 font-bold">Carga: {selectedTropa.usuario_op}</span>}
                                    {selectedTropa.usuario_acotz && <span className="text-[9px] text-amber-900">Cotizó: {selectedTropa.usuario_acotz}</span>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>)}
        </div>
    );
}
