'use client';

import { useState, useEffect, useMemo } from 'react';
import InfoTooltip from '@/components/ui/InfoTooltip';

interface Props {
    acName?: string | null;
    acId?: number | null;
    canal?: string | null;
    isAdmin?: boolean;
    selectedYear?: number;
    selectedMes?: number;   // 0 = todo el año, 1-12 = mes específico
    filterCierre?: boolean;
    opsAll?: any[];         // si se provee, se usa directamente (incluye Publicadas/Ofrecidas)
}

const UN_COLORS: Record<string, string> = {
    Faena:      'bg-blue-500',
    Invernada:  'bg-red-500',
    MAG:        'bg-green-500',
    'Inv. Neo': 'bg-orange-400',
    Cría:       'bg-yellow-400',
};
const UN_TEXT: Record<string, string> = {
    Faena:      'text-blue-700',
    Invernada:  'text-red-700',
    MAG:        'text-green-700',
    'Inv. Neo': 'text-orange-700',
    Cría:       'text-yellow-700',
};

function fmt(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
    return n.toLocaleString('es-AR');
}

function fmtDate(s: string | null): string {
    if (!s) return '—';
    const d = s.includes('T') ? new Date(s) : new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function pctLabel(curr: number, prev: number): { label: string; positive: boolean } | null {
    if (prev === 0) return curr > 0 ? { label: '+∞%', positive: true } : null;
    const p = ((curr - prev) / prev) * 100;
    return { label: `${p >= 0 ? '+' : ''}${p.toFixed(0)}%`, positive: p >= 0 };
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

type PeriodKey = 'hoy' | 'semana' | 'mes' | 'prevMes';

interface BucketData {
    cabezas: number;
    byUN: Record<string, number>;
    tropas: any[];
}
type AllStats = Record<PeriodKey, BucketData>;

function computeAllStats(rows: any[], hoy: Date): AllStats {
    // ── Usa SOLO fecha_publicaciones (no fecha_operacion) ────────────────────
    // Para no mezclar: el dashboard principal (Estado Tropas, KPIs) usa
    // fecha_operacion. Esta tarjeta es exclusiva del lado publicación.
    const startOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const startOfWeek  = (d: Date) => { const day = d.getDay(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day === 0 ? 6 : day - 1)); };
    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const startOfPrevM = (d: Date) => new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const endOfPrevM   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59);

    const hoyStart  = startOfDay(hoy);
    const semStart  = startOfWeek(hoy);
    const mesStart  = startOfMonth(hoy);
    const prevStart = startOfPrevM(hoy);
    const prevEnd   = endOfPrevM(hoy);

    const empty = (): BucketData => ({ cabezas: 0, byUN: {}, tropas: [] });
    const acc: AllStats = { hoy: empty(), semana: empty(), mes: empty(), prevMes: empty() };

    for (const row of rows) {
        const fechaPub = parseDateLocal(row.fecha_publicaciones);
        if (!fechaPub) continue;

        const cabezas = Number(row.Cabezas) || 0;
        const un = normalizeUN(row.Tipo || row.UN || '');

        const add = (bucket: BucketData) => {
            bucket.cabezas += cabezas;
            bucket.byUN[un] = (bucket.byUN[un] || 0) + cabezas;
            bucket.tropas.push(row);
        };

        if (fechaPub >= hoyStart) add(acc.hoy);
        if (fechaPub >= semStart)  add(acc.semana);
        if (fechaPub >= mesStart)  add(acc.mes);
        if (fechaPub >= prevStart && fechaPub <= prevEnd) add(acc.prevMes);
    }

    return acc;
}

/* ── Panel lateral de detalle ─────────────────────────────────────────────── */
function DetailPanel({
    label, tropas, onClose,
}: {
    label: string;
    tropas: any[];
    onClose: () => void;
}) {
    // ordenar por cabezas desc
    const sorted = useMemo(() =>
        [...tropas].sort((a, b) => (Number(b.Cabezas) || 0) - (Number(a.Cabezas) || 0)),
    [tropas]);

    const totalCabezas = sorted.reduce((s, t) => s + (Number(t.Cabezas) || 0), 0);

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40"
                onClick={onClose}
            />
            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col bg-white shadow-2xl border-l border-gray-200 animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                    <div>
                        <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <span>🤝</span> Ofrecimientos · {label}
                        </h2>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                            {sorted.length} tropas · {fmt(totalCabezas)} cabezas en total
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-500 text-lg"
                    >
                        ×
                    </button>
                </div>

                {/* Lista de tropas */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {sorted.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-12">Sin ofrecimientos en este período</p>
                    ) : sorted.map((t, i) => {
                        const un = normalizeUN(t.Tipo || t.UN || '');
                        const cabezas = Number(t.Cabezas) || 0;
                        const estado = (t.estado_tropas || t.ESTADO || '').trim();
                        return (
                            <div key={`${t.id_lote}-${i}`} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:border-blue-200 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between gap-3">
                                    {/* Izquierda: info tropa */}
                                    <div className="flex-1 min-w-0">
                                        {/* ID + UN */}
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black text-gray-400">#{t.id_lote || '—'}</span>
                                            {un && (
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${UN_COLORS[un] ? `${UN_COLORS[un]} text-white` : 'bg-gray-100 text-gray-600'}`}>
                                                    {un}
                                                </span>
                                            )}
                                            {estado && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium truncate">
                                                    {estado}
                                                </span>
                                            )}
                                        </div>
                                        {/* Sociedad vendedora */}
                                        <p className="text-[12px] font-semibold text-gray-800 truncate leading-tight">
                                            {t.RS_Vendedora || '—'}
                                        </p>
                                        {/* Comercial AC */}
                                        <p className="text-[10px] text-blue-700 font-bold mt-0.5 truncate">
                                            👤 {t.AC_Vend || '—'}
                                        </p>
                                        {/* Fecha */}
                                        <p className="text-[9px] text-gray-400 mt-1">
                                            📅 {fmtDate(t.fecha_publicaciones || t.fecha_operacion)}
                                            {t.origen && <span className="ml-2">📍 {(t.origen || '').split(',')[0]?.trim()}</span>}
                                        </p>
                                    </div>
                                    {/* Derecha: cabezas */}
                                    <div className="flex flex-col items-end flex-shrink-0">
                                        <span className="text-2xl font-black text-gray-900">{fmt(cabezas)}</span>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase">cab</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer totales */}
                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                    <div className="flex items-center justify-between text-xs font-black text-gray-700">
                        <span className="uppercase tracking-wide">Total</span>
                        <span className="text-lg text-blue-700">{fmt(totalCabezas)} <span className="text-xs font-semibold text-gray-400">cabezas</span></span>
                    </div>
                </div>
            </div>
        </>
    );
}

/* ── Componente principal ─────────────────────────────────────────────────── */
export default function PublicacionesCard({ acName, acId, canal, isAdmin, selectedYear, selectedMes = 0, filterCierre = false, opsAll }: Props) {
    const [allStats, setAllStats] = useState<AllStats | null>(null);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState<string | null>(null);
    const [openPeriod, setOpenPeriod] = useState<PeriodKey | null>(null);

    useEffect(() => {
        const hoy = new Date();

        // ── Fast path: usar opsAll si ya viene del padre (incluye todos los estados) ──
        if (opsAll) {
            const vendedor = opsAll.filter((t: any) => {
                const v = (t.AC_Vend || '').trim();
                return v !== '' && v !== '—';
            });
            setAllStats(computeAllStats(vendedor, hoy));
            setLoading(false);
            return;
        }

        // ── Slow path: fetch desde Q95 (solo ops con fecha_operacion en rango) ──
        const load = async () => {
            setLoading(true); setError(null);
            try {
                const y = selectedYear || hoy.getFullYear();

                let fechaDesde: string;
                let fechaHasta: string;

                if (filterCierre) {
                    if (selectedMes === 0) {
                        fechaDesde = `${y}-01-26`;
                        fechaHasta = `${y + 1}-01-25`;
                    } else {
                        let mPrev = selectedMes === 1 ? 12 : selectedMes - 1;
                        let yPrev = selectedMes === 1 ? y - 1 : y;
                        const p = String(mPrev).padStart(2, '0');
                        const n = String(selectedMes).padStart(2, '0');
                        fechaDesde = `${yPrev}-${p}-26`;
                        fechaHasta = `${y}-${n}-25`;
                    }
                } else if (selectedMes > 0) {
                    const ms = String(selectedMes).padStart(2, '0');
                    const lastDay = new Date(y, selectedMes, 0).getDate();
                    fechaDesde = `${y}-${ms}-01`;
                    fechaHasta = `${y}-${ms}-${lastDay}`;
                } else {
                    fechaDesde = `${y}-01-01`;
                    fechaHasta = `${y}-12-31`;
                }

                const params = new URLSearchParams({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta });
                if (isAdmin && !acId && !acName) {
                    params.set('isAdmin', 'true');
                } else {
                    if (acId)   params.set('acId', String(acId));
                    if (acName) params.set('acName', acName);
                    if (canal)  params.set('canal', canal);
                }

                const res = await fetch(`/api/regional/tropas?${params}`);
                const data = await res.json();
                if (!res.ok || data.error) throw new Error(data.error || 'Error');

                const tropas: any[] = (data.tropas || []).filter((t: any) => {
                    const v = (t.AC_Vend || '').trim();
                    return v !== '' && v !== '—';
                });

                setAllStats(computeAllStats(tropas, hoy));
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [acName, acId, canal, isAdmin, selectedYear, selectedMes, filterCierre, opsAll]);

    if (loading) return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center justify-center h-32">
            <div className="animate-pulse text-gray-400 text-sm font-medium">Cargando ofrecimientos…</div>
        </div>
    );
    if (error) return (
        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-4 text-rose-500 text-sm">{error}</div>
    );
    if (!allStats) return null;

    const periods: Array<{ key: PeriodKey; label: string; note?: string; accent: string; accentHover: string }> = [
        { key: 'hoy',     label: 'Hoy',          accent: 'border-blue-100',    accentHover: 'hover:border-blue-300 hover:bg-blue-50/40' },
        { key: 'semana',  label: 'Esta Semana',   accent: 'border-indigo-100',  accentHover: 'hover:border-indigo-300 hover:bg-indigo-50/40' },
        { key: 'mes',     label: 'Este Mes',      accent: 'border-emerald-100', accentHover: 'hover:border-emerald-300 hover:bg-emerald-50/40' },
        { key: 'prevMes', label: 'Mes Anterior',  accent: 'border-gray-100',    accentHover: 'hover:border-gray-300 hover:bg-gray-50/60', note: 'ref.' },
    ];

    const topMes = Object.entries(allStats.mes.byUN).sort((a, b) => b[1] - a[1]);
    const mesDiff = pctLabel(allStats.mes.cabezas, allStats.prevMes.cabezas);

    return (
        <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <span>🤝</span> Ofrecimientos
                            <InfoTooltip text="Son TODAS las tropas donde actuás solo como parte vendedora que ingresaron al sistema bajo esa fecha de publicación, sin importar su estado final o posterior. IMPORTANTE: Los ofrecimientos no son alertas de ofertas de compra, sino tus publicaciones a la venta." />
                        </h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                            Solo lado vendedor · <strong>{fmt(allStats.mes.cabezas)}</strong> cbzs este mes
                            {mesDiff && (
                                <span className={`ml-2 font-bold ${mesDiff.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {mesDiff.label} vs mes ant.
                                </span>
                            )}
                        </p>
                        {/* Separación explícita de fechas */}
                        <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full">
                            📅 Usa <code className="font-mono">fecha_publicaciones</code>
                        </span>
                    </div>
                    <span className="text-[10px] text-gray-300 italic">Clic para ver detalle →</span>
                </div>

                {/* 4 tarjetas de período — clickeables */}
                <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {periods.map(p => {
                        const d = allStats[p.key];
                        const topUNs = Object.entries(d.byUN).sort((a, b) => b[1] - a[1]).slice(0, 3);
                        const diff = p.key === 'mes' ? mesDiff : null;
                        return (
                            <button
                                key={p.key}
                                onClick={() => setOpenPeriod(p.key)}
                                className={`flex flex-col p-4 rounded-xl border ${p.accent} ${p.accentHover} bg-white text-left transition-all cursor-pointer active:scale-[0.98] group`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.label}</span>
                                    {p.note && <span className="text-[9px] text-gray-300 italic">{p.note}</span>}
                                    <span className="text-gray-300 text-[10px] group-hover:text-gray-500 transition-colors">↗</span>
                                </div>
                                <div className="flex items-baseline gap-1.5 mb-2">
                                    <span className="text-3xl font-black text-gray-900">{fmt(d.cabezas)}</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">cab</span>
                                    {diff && (
                                        <span className={`ml-auto text-[11px] font-black px-1.5 py-0.5 rounded ${diff.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                            {diff.label}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[9px] text-gray-400 mb-2">{d.tropas.length} tropas</p>
                                {topUNs.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {topUNs.map(([un, cbz]) => (
                                            <span key={un} className="flex items-center gap-1 text-[9px] font-semibold text-gray-500">
                                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${UN_COLORS[un] || 'bg-gray-400'}`} />
                                                {un}: {fmt(cbz)}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Breakdown por UN del mes */}
                {topMes.length > 0 && (
                    <div className="px-5 pb-4 border-t border-gray-50 pt-3">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Por UN — Este Mes vs Mes Anterior</p>
                        <div className="flex flex-wrap gap-2">
                            {topMes.map(([un, cbz]) => {
                                const prevCbz = allStats.prevMes.byUN[un] || 0;
                                const diff = pctLabel(cbz, prevCbz);
                                return (
                                    <button
                                        key={un}
                                        onClick={() => setOpenPeriod('mes')}
                                        className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg px-2.5 py-1.5 transition-colors"
                                    >
                                        <span className={`w-2 h-2 rounded-full ${UN_COLORS[un] || 'bg-gray-400'}`} />
                                        <span className="text-[10px] font-bold text-gray-700">{un}</span>
                                        <span className="text-[11px] font-black text-gray-900">{fmt(cbz)}</span>
                                        {diff && (
                                            <span className={`text-[9px] font-bold ${diff.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {diff.label}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Panel de detalle */}
            {openPeriod && (
                <DetailPanel
                    label={periods.find(p => p.key === openPeriod)!.label}
                    tropas={allStats[openPeriod].tropas}
                    onClose={() => setOpenPeriod(null)}
                />
            )}
        </>
    );
}
