'use client';

import { useState, useEffect, useMemo } from 'react';

interface Asignacion {
    id: number;
    razon_social: string;
    cuit: string;
    AC: string;
    representante?: string;
    fecha_asignacion: string;
    mes_asignacion?: number;
    anio_asignacion?: number;
    semana_asignacion?: number;
    modificado_por?: string;
    asig_hace?: string | number;
}

interface Props {
    acFilter?: string | null;
    opsAll?: any[]; // operaciones totales para cruzar actividad posterior
    selectedYear?: number;
    selectedMes?: number;
    filterCierre?: boolean;
}

import { formatRelativeTime } from '@/lib/utils/timeUtils';

function daysSince(raw: string | null | undefined): number | null {
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function actividadPost(asig: Asignacion, opsAll: any[]): {
    opero: boolean; ofrecio: boolean; oferco: boolean; totalPost: number; fechaUlt?: string;
} {
    if (!asig.fecha_asignacion || !opsAll.length) return { opero: false, ofrecio: false, oferco: false, totalPost: 0 };

    const asigDate = new Date(asig.fecha_asignacion).getTime();
    const cuitStr = String(asig.cuit).trim();
    const rsNorm = (asig.razon_social || '').toLowerCase().trim();

    const postOps = opsAll.filter(o => {
        const fechaOp = o.fecha_operacion ? new Date(o.fecha_operacion).getTime() : 0;
        if (!fechaOp || fechaOp < asigDate) return false;
        const oRS = (o.RS_Vendedora || o.RS_Compradora || '').toLowerCase().trim();
        const oCuit = String(o.cuit_vend || o.cuit_comp || '').trim();
        return oRS === rsNorm || oCuit === cuitStr;
    });

    const opero = postOps.some(o => {
        const eg = (o.estado_general || '').toUpperCase();
        return eg === 'CONCRETADA';
    });

    const ofrecio = postOps.some(o => {
        const eg = (o.estado_general || '').toUpperCase();
        return eg === 'CONCRETADA' || eg === 'NO CONCRETADAS' || eg === 'NO CONCRETADA' || eg === 'ANULADA';
    });

    // "oferco" = hizo una oferta en el marketplace (publicaciones/ofrecimientos)
    const oferco = postOps.some(o => {
        const et = (o.estado_tropas || o.Estado_Trop || '').toLowerCase();
        return et.includes('ofrecimiento') || et.includes('publicad');
    });

    const fechasPost = postOps.map(o => o.fecha_operacion).filter(Boolean).sort().reverse();

    return { opero, ofrecio, oferco, totalPost: postOps.length, fechaUlt: fechasPost[0] };
}

type FilterMode = 'todas' | 'activas' | 'sin_actividad';

export default function Asignaciones({ acFilter, opsAll = [], selectedYear, selectedMes, filterCierre }: Props) {
    const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterMode, setFilterMode] = useState<FilterMode>('todas');
    const [sortCol, setSortCol] = useState<string>('fecha_asignacion');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [cachedAt, setCachedAt] = useState<string | null>(null);
    const [selectedAsig, setSelectedAsig] = useState<Asignacion & { _actividad: any } | null>(null);
    const [porFilter, setPorFilter] = useState('');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [showAllDates, setShowAllDates] = useState(false);

    useEffect(() => {
        let y = selectedYear || new Date().getFullYear();
        let m = selectedMes || 0;
        let d1, d2;

        if (filterCierre) {
            if (m === 0) { d1 = `${y}-01-26`; d2 = `${y + 1}-01-25`; }
            else {
                if (m === 1) { y--; m = 12; } else { m--; }
                const p = String(m).padStart(2, '0');
                const n = String(m === 12 ? 1 : m + 1).padStart(2, '0');
                d1 = `${y}-${p}-26`; d2 = `${m === 12 ? y + 1 : y}-${n}-25`;
            }
        } else {
            if (m === 0) { d1 = `${y}-01-01`; d2 = `${y}-12-31`; }
            else {
                const ms = String(m).padStart(2, '0');
                const last = new Date(y, m, 0).getDate();
                d1 = `${y}-${ms}-01`; d2 = `${y}-${ms}-${last}`;
            }
        }
        setFechaDesde(d1);
        setFechaHasta(d2);
    }, [selectedYear, selectedMes, filterCierre]);

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (acFilter) params.set('ac', acFilter);

        fetch(`/api/regional/asignaciones?${params}`)
            .then(r => r.json())
            .then(d => {
                setAsignaciones(d.asignaciones || []);
                setCachedAt(d._cachedAt || null);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [acFilter]);

    // Enriquecer con actividad posterior cruzando opsAll
    const enriched = useMemo(() => {
        return asignaciones.map(asig => ({
            ...asig,
            _actividad: actividadPost(asig, opsAll),
        }));
    }, [asignaciones, opsAll]);

    const filtered = useMemo(() => {
        let items = enriched;
        if (search) {
            const q = search.toLowerCase();
            items = items.filter(a =>
                (a.razon_social || '').toLowerCase().includes(q) ||
                (a.cuit || '').includes(q) ||
                (a.AC || '').toLowerCase().includes(q)
            );
        }
        if (filterMode === 'activas') items = items.filter(a => a._actividad.ofrecio || a._actividad.opero);
        if (filterMode === 'sin_actividad') items = items.filter(a => !a._actividad.ofrecio && !a._actividad.opero);
        
        if (porFilter) items = items.filter(a => (a.modificado_por || '').toLowerCase() === porFilter.toLowerCase());
        
        if (!showAllDates) {
            if (fechaDesde) items = items.filter(a => (a.fecha_asignacion || '').slice(0, 10) >= fechaDesde);
            if (fechaHasta) items = items.filter(a => (a.fecha_asignacion || '').slice(0, 10) <= fechaHasta);
        }

        return [...items].sort((a, b) => {
            let av: any = a[sortCol as keyof typeof a];
            let bv: any = b[sortCol as keyof typeof b];
            if (sortCol === 'fecha_asignacion') {
                av = new Date(av || 0).getTime();
                bv = new Date(bv || 0).getTime();
            } else if (typeof av === 'string') {
                av = av.toLowerCase(); bv = (bv || '').toLowerCase();
            } else {
                av = Number(av) || 0; bv = Number(bv) || 0;
            }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [enriched, search, filterMode, sortCol, sortDir, porFilter, fechaDesde, fechaHasta]);

    const toggleSort = (col: string) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };

    const SortTh = ({ col, label, cls = '' }: { col: string; label: string; cls?: string }) => (
        <th
            className={`px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-gray-600 transition-colors ${cls}`}
            onClick={() => toggleSort(col)}
        >
            {label}{sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
        </th>
    );

    // Resumen
    const conActividad = enriched.filter(a => a._actividad.ofrecio || a._actividad.opero).length;
    const sinActividad = enriched.length - conActividad;

    const availablePors = useMemo(() => Array.from(new Set(enriched.map(a => a.modificado_por).filter(Boolean))).sort(), [enriched]);

    return (
        <div className="space-y-4">
            {/* Header / Filtros */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-violet-50/30 flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex flex-wrap gap-2 items-center">
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar sociedad, CUIT o AC..."
                            className="px-3 py-1.5 text-[11px] border border-gray-200 rounded-xl outline-none bg-white w-full sm:w-64 focus:border-violet-300 transition-colors"
                        />
                        <select
                            value={porFilter}
                            onChange={(e) => setPorFilter(e.target.value)}
                            className="px-3 py-1.5 text-[11px] border border-gray-200 rounded-xl outline-none bg-white min-w-[120px] focus:border-violet-300 transition-colors"
                        >
                            <option value="">Por: Todos</option>
                            {availablePors.map((p: any) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <div className="flex gap-1 items-center bg-white border border-gray-200 rounded-xl p-0.5 shadow-sm">
                            <button
                                onClick={() => setShowAllDates(false)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${!showAllDates ? 'bg-violet-100 text-violet-800' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Período Actual
                            </button>
                            <button
                                onClick={() => setShowAllDates(true)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${showAllDates ? 'bg-violet-100 text-violet-800' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Todos
                            </button>
                        </div>
                        <div className="flex gap-1">
                            {(['todas', 'activas', 'sin_actividad'] as FilterMode[]).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setFilterMode(m)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors ${filterMode === m ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {m === 'todas' ? 'Todas' : m === 'activas' ? 'Con actividad' : 'Sin actividad'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* KPI chips */}
                    <div className="flex gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">
                            ✅ {conActividad} con actividad
                        </span>
                        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-[11px] font-black">
                            ⏳ {sinActividad} sin actividad
                        </span>
                        <span className="px-3 py-1 flex items-center text-gray-400 text-[9px] font-semibold">
                            {filtered.length} regs.
                        </span>
                    </div>
                </div>

                {loading && (
                    <div className="p-8 text-center text-gray-400 text-sm animate-pulse">Cargando asignaciones...</div>
                )}
                {error && (
                    <div className="p-6 bg-red-50 text-red-600 text-sm text-center">Error: {error}</div>
                )}

                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <SortTh col="razon_social" label="Sociedad" />
                                    <SortTh col="cuit" label="CUIT" />
                                    <SortTh col="AC" label="Asociado Comercial" />
                                    <SortTh col="representante" label="Representante" />
                                    <SortTh col="fecha_asignacion" label="Fecha Asig." />
                                    <SortTh col="asig_hace" label="Hace" cls="text-center" />
                                    <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Actividad Post-Asig.</th>
                                    <SortTh col="modificado_por" label="Por" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dashed divide-gray-200">
                                {filtered.length === 0 && (
                                    <tr><td colSpan={8} className="p-10 text-center text-gray-300">Sin registros para mostrar</td></tr>
                                )}
                                {filtered.map((a, i) => {
                                    const { opero, ofrecio, oferco, totalPost, fechaUlt } = a._actividad;
                                    const hasAct = ofrecio || opero;
                                    return (
                                        <tr key={i} onClick={() => setSelectedAsig(a as any)} className={`cursor-pointer hover:bg-violet-50 transition-colors ${hasAct ? '' : 'opacity-70'}`}>
                                            <td className="px-3 py-2">
                                                <p className="text-[11px] font-semibold text-gray-800 line-clamp-1 max-w-[200px]">{a.razon_social}</p>
                                            </td>
                                            <td className="px-3 py-2 text-[10px] text-gray-400 font-mono">{a.cuit}</td>
                                            <td className="px-3 py-2">
                                                <span className="text-[11px] font-bold text-violet-700">{a.AC || '—'}</span>
                                            </td>
                                            <td className="px-3 py-2 text-[10px] text-gray-500">{a.representante || '—'}</td>
                                            <td className="px-3 py-2 text-[10px] text-gray-500 whitespace-nowrap">{formatRelativeTime(a.fecha_asignacion)}</td>
                                            <td className="px-3 py-2 text-center">
                                                {(() => {
                                                    const d = daysSince(a.fecha_asignacion);
                                                    if (d === null) return <span className="text-gray-300">—</span>;
                                                    const cls = d <= 3 ? 'bg-emerald-100 text-emerald-700' : d <= 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500';
                                                    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${cls}`}>{d}d</span>;
                                                })()}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {totalPost === 0 ? (
                                                    <span className="text-[10px] text-gray-300 font-medium">Sin registros</span>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <div className="flex gap-1">
                                                            {opero && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-full">✅ Operó</span>}
                                                            {ofrecio && !opero && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black rounded-full">📋 Ofreció</span>}
                                                            {oferco && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded-full">🏷 Ofertó</span>}
                                                        </div>
                                                        {fechaUlt && (
                                                            <span className="text-[9px] text-gray-400">{new Date(fechaUlt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-[10px] text-gray-400">{a.modificado_por || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedAsig && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-violet-50">
                            <div>
                                <span className="text-[10px] font-black tracking-wider text-violet-600 uppercase">Detalle de Asignación</span>
                                <h3 className="text-lg font-black text-gray-900 mt-0.5">{selectedAsig.razon_social}</h3>
                            </div>
                            <button onClick={() => setSelectedAsig(null)} className="p-2 hover:bg-violet-200 rounded-lg text-violet-500 hover:text-violet-700 transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-5 space-y-4 text-sm bg-white">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400">CUIT</p>
                                    <p className="font-mono mt-0.5 font-bold text-gray-800">{selectedAsig.cuit}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400">Asignado a</p>
                                    <p className="mt-0.5 font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded inline-block">{selectedAsig.AC || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400">Representante</p>
                                    <p className="mt-0.5 font-semibold text-gray-700">{selectedAsig.representante || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400">Fecha Asignación</p>
                                    <p className="mt-0.5 font-semibold text-gray-700">{formatRelativeTime(selectedAsig.fecha_asignacion)}</p>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-gray-100">
                                <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Actividad Posterior ({selectedAsig._actividad?.totalPost} res)</p>
                                <div className="flex gap-2">
                                    {selectedAsig._actividad?.opero && <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-lg">✅ Concretó operaciones</span>}
                                    {selectedAsig._actividad?.ofrecio && !selectedAsig._actividad?.opero && <span className="px-2 py-1 bg-blue-100 text-blue-800 text-[10px] font-black rounded-lg">📋 Fue ofrecido pero no concretó</span>}
                                    {selectedAsig._actividad?.oferco && <span className="px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-lg">🏷 Ofertó en el mercado</span>}
                                    {selectedAsig._actividad?.totalPost === 0 && <span className="text-gray-400 text-xs italic">La sociedad no ha registrado ninguna actividad desde que le fue asignada a este AC.</span>}
                                </div>
                                {selectedAsig._actividad?.fechaUlt && (
                                    <p className="text-xs text-gray-500 mt-2">Última operación: <span className="font-bold text-gray-700">{new Date(selectedAsig._actividad.fechaUlt).toLocaleDateString('es-AR')}</span></p>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button onClick={() => setSelectedAsig(null)} className="px-5 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl shadow-sm hover:bg-gray-50">Aceptar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
