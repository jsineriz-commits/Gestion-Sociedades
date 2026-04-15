'use client';

import { useState } from 'react';
import { ACS_OFICINA, AC_NOMBRES, AC_DIRECTA, getAcByNombre } from '@/lib/data/constants';
import DetailPanel from '@/components/ui/DetailPanel';



interface Props {
    sociedades: any[];
    selectedMes?: number;   // mes seleccionado (1-12, 0 = todos)
    selectedYear?: number;  // año seleccionado
    acFilter?: string | null;
}

function daysSince(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(raw: string | null): string {
    if (!raw) return '—';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fN(n: number | null | undefined): string | number { return n == null ? '—' : n; }

function fFact(raw: string | number | null | undefined): string {
    if (raw == null) return '—';
    const n = Math.round(Number(String(raw).replace(/[^0-9.-]/g, '')));
    if (isNaN(n) || n === 0) return '—';
    if (n >= 1_000_000) {
        const m = n / 1_000_000;
        const formatted = (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)).replace('.', ',');
        return `$${formatted}M`;
    }
    return `$${n.toLocaleString('es-AR')}`;
}

function getColor(nombre: string): string {
    return getAcByNombre(nombre)?.colorSolid || AC_DIRECTA.colorSolid;
}
function getInitials(nombre: string): string { return (nombre || '').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase(); }

// ─── Mini KPI card ─────────────────────────────────────────────────────────
function MiniKPI({ icon, label, value, sub, color = 'text-gray-900' }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) {
    return (
        <div className="bg-gray-50/80 rounded-xl p-3 flex flex-col">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs opacity-60">{icon}</span>
                <span className={`text-xl font-black ${color}`}>{value}</span>
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-tight">{label}</p>
            {sub && <p className="text-[9px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
    );
}


// ─── Main TopSociedades ─────────────────────────────────────────────────────
const INICIALES_COLORES: Record<string, string> = Object.fromEntries(
    ACS_OFICINA.map(ac => [ac.nombre, ac.colorGrad])
);

function getColorGrad(nombre: string): string {
    return INICIALES_COLORES[nombre] || 'from-gray-400 to-gray-500';
}

function sortFn(a: any, b: any, sortConfig: { field: string; direction: 'asc' | 'desc' } | null): number {
    if (!sortConfig) return 0;
    const { field, direction } = sortConfig;
    let valA: any = (a as any)[field];
    let valB: any = (b as any)[field];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (['fecha_creacion', 'ult_ingreso', 'Ult_op', 'Ult_act', 'FUV_fae', 'FUV_inv', 'FUC'].includes(field)) {
        valA = new Date(valA || 0).getTime(); valB = new Date(valB || 0).getTime();
    }
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
}

export default function TopSociedades({ sociedades, selectedMes = 0, selectedYear = new Date().getFullYear(), acFilter }: Props) {
    const [filterAC, setFilterAC] = useState<string>('todos');
    const [search, setSearch] = useState('');
    const [showCount, setShowCount] = useState(20);
    const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
    const [filterActividad, setFilterActividad] = useState<string>('todas');
    const [selectedSoc, setSelectedSoc] = useState<any | null>(null);

    const regionalesConDatos = ACS_OFICINA.filter(ac => sociedades.some(s => s.asociado_comercial === ac.nombre));
    const hayDirectas = sociedades.some(s => !AC_NOMBRES.includes(s.asociado_comercial || ''));

    const socNorm = sociedades.map(s => ({
        ...s,
        _acDisplay: AC_NOMBRES.includes(s.asociado_comercial) ? s.asociado_comercial : 'Directa',
    }));

    let filtered = socNorm.filter(s => {
        const okAC = !acFilter || s._acDisplay === acFilter;

        let okActividad = true;
        if (filterActividad !== 'todas') {
            const diasAct = daysSince(s.Ult_op);
            if (filterActividad === '≤30d') okActividad = diasAct !== null && diasAct <= 30;
            else if (filterActividad === '31-90d') okActividad = diasAct !== null && diasAct > 30 && diasAct <= 90;
            else if (filterActividad === '91-180d') okActividad = diasAct !== null && diasAct > 90 && diasAct <= 180;
            else if (filterActividad === '+1 año') okActividad = diasAct !== null && diasAct > 365;
            else if (filterActividad === 'Sin op.') okActividad = diasAct === null;
        }

        const q = search.toLowerCase();
        return okAC && okActividad && (!q || (s.razon_social || '').toLowerCase().includes(q) || (s.cuit || '').includes(q));
    });

    // ACs con color primero, sin AC (Directa/Oficina) al final
    const withAC = filtered.filter(s => AC_NOMBRES.includes(s.asociado_comercial));
    const withoutAC = filtered.filter(s => !AC_NOMBRES.includes(s.asociado_comercial));

    const sortGroup = (arr: any[]) => sortConfig ? [...arr].sort((a, b) => sortFn(a, b, sortConfig)) : arr;
    filtered = [...sortGroup(withAC), ...sortGroup(withoutAC)];


    function handleSort(field: string) {
        setSortConfig(c => c?.field === field && c.direction === 'asc' ? { field, direction: 'desc' } : { field, direction: 'asc' });
    }

    function SortIcon({ field }: { field: string }) {
        if (sortConfig?.field !== field) return <span className="text-gray-300 opacity-50 ml-1">↕</span>;
        return <span className="text-[#3179a7] ml-1 font-black">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    }

    function SortableTh({ field, label, cls = 'text-left' }: { field: string; label: string; cls?: string }) {
        return (
            <th className={`px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 hover:text-gray-700 transition-colors select-none ${cls}`}
                onClick={() => handleSort(field)}>
                <div className={`flex items-center ${cls === 'text-right' ? 'justify-end' : cls === 'text-center' ? 'justify-center' : ''}`}>
                    {label}<SortIcon field={field} />
                </div>
            </th>
        );
    }

    // ── Activas del mes (para el header) ──
    const isInMonth = (dateStr: string | null): boolean => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime()) || d.getFullYear() !== selectedYear) return false;
        return selectedMes > 0 ? (d.getMonth() + 1) === selectedMes : true;
    };
    const activasMes = sociedades.filter(s => isInMonth(s.Ult_op)).length;
    const socsConOp = sociedades.filter(s => s.Ult_op);
    const activas30 = socsConOp.filter(s => (daysSince(s.Ult_op) ?? 9999) <= 30).length;
    const activas90 = socsConOp.filter(s => (daysSince(s.Ult_op) ?? 9999) <= 90).length;
    const activas180 = socsConOp.filter(s => (daysSince(s.Ult_op) ?? 9999) <= 180).length;
    const sinActividad365 = socsConOp.filter(s => (daysSince(s.Ult_op) ?? 0) > 365).length;
    const sinActividad = sociedades.filter(s => !s.Ult_op).length;

    // Helpers condicionales (colores fijos o Tailwind clases)
    const getKColor = (val: number | null) => {
        if (val == null) return '';
        if (val > 10000) return 'bg-[#8cb350] text-white';
        if (val < 5000) return 'bg-[#bf6f33] text-white';
        return 'bg-[#989898] text-white';
    };
    const getCccColor = (val: number | null) => {
        if (val == null) return '';
        const pct = val * 100;
        if (pct >= 80) return 'bg-emerald-600 text-white';
        if (pct >= 50) return 'bg-emerald-400 text-emerald-950';
        if (pct >= 25) return 'bg-emerald-200 text-emerald-900';
        return 'bg-emerald-50 text-emerald-700';
    };
    const getUtilColor = (val: number | null) => {
        if (val == null) return '';
        const pct = val * 100;
        if (pct >= 80) return 'bg-emerald-500 text-white';
        if (pct >= 50) return 'bg-yellow-400 text-yellow-950';
        if (pct >= 25) return 'bg-orange-400 text-white';
        return 'bg-red-500 text-white';
    };

    return (
        <div className="space-y-4">

            {/* Tabla */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center mb-3">
                        <div className="flex-1 w-full sm:w-auto">
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar razón social o CUIT..."
                                className="text-xs px-3 py-1.5 border border-[#ededed] rounded-lg outline-none w-full max-w-sm bg-[#f8f8f8] focus:bg-white focus:border-[#3179a7] transition-colors" />
                            <p className="text-[9px] text-gray-400 mt-1 ml-1">{sociedades.length} · mostrando {filtered.length}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center justify-between">
                        {/* El Selector de Administrador se maneja globalmente ahora en el Dashboard local, así que el select se omite */}

                        {/* Barra de actividad compacta */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                📅 {activasMes} activas {selectedMes > 0 ? `en ${selectedMes}/${selectedYear}` : `en ${selectedYear}`}
                            </span>
                            {[
                                { color: 'bg-emerald-500', label: '≤30d', val: activas30, filterId: '≤30d' },
                                { color: 'bg-blue-400', label: '31-90d', val: activas90 - activas30, filterId: '31-90d' },
                                { color: 'bg-amber-400', label: '91-180d', val: activas180 - activas90, filterId: '91-180d' },
                                { color: 'bg-rose-500', label: '+1a', val: sinActividad365, filterId: '+1 año' },
                                { color: 'bg-gray-300', label: 'S/op', val: sinActividad, filterId: 'Sin op.' },
                            ].map(({ color, label, val, filterId }) => (
                                <button key={label}
                                    onClick={() => setFilterActividad(filterActividad === filterId ? 'todas' : filterId)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold transition-all ${filterActividad === filterId ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
                                    {label} <span className="font-black">{val}</span>
                                </button>
                            ))}
                            {filterActividad !== 'todas' && (
                                <button onClick={() => setFilterActividad('todas')} className="text-[9px] text-[#3179a7] underline font-semibold">✕ limpiar</button>
                            )}
                        </div>
                    </div>

                </div>

                {filtered.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 text-sm">Sin sociedades.</div>

                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <SortableTh field="K" label="K" />
                                        <SortableTh field="Kv" label="Kv" />
                                        <SortableTh field="PorcU" label="%U" />
                                        <SortableTh field="conc_gral" label="CCC" cls="text-right" />
                                        <SortableTh field="razon_social" label="Sociedad" />
                                        <SortableTh field="cuit" label="CUIT" />
                                        <SortableTh field="gs_nosis" label="NOSIS" />
                                        <SortableTh field="gs_fact" label="FACT" />
                                        <SortableTh field="gs_sac" label="SAC" />
                                        <SortableTh field="gs_credito_jd" label="Crédito (JD)" cls="text-right" />
                                        <SortableTh field="fecha_creacion" label="Creación" />
                                        <SortableTh field="ult_ingreso" label="Últ. Ingr." />
                                        <SortableTh field="q_usuarios" label="USR" cls="text-right" />
                                        <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase text-left whitespace-nowrap">AC</th>
                                        <SortableTh field="sugerido_ci_faena" label="CI Fae" cls="text-right" />
                                        <SortableTh field="sugerido_ci_invernada" label="CI Inv" cls="text-right" />
                                        <SortableTh field="q_op_total" label="Q Op" cls="text-right" />
                                        <SortableTh field="Ult_op" label="FUOp" />
                                        <SortableTh field="Ult_act" label="FUAct" />
                                        <SortableTh field="q_ofrec_fae" label="OFR F." cls="text-right" />
                                        <SortableTh field="q_ofrec_inv" label="OFR I." cls="text-right" />
                                        <SortableTh field="q_ventas_fae" label="VEN F." cls="text-right" />
                                        <SortableTh field="q_ventas_inv" label="VEN I." cls="text-right" />
                                        <SortableTh field="FUV_fae" label="FUV F." />
                                        <SortableTh field="FUV_inv" label="FUV I." />
                                        <SortableTh field="q_compras_fae" label="COMP F." cls="text-right" />
                                        <SortableTh field="q_compras_inv" label="COMP I." cls="text-right" />
                                        <SortableTh field="FUC" label="FUC" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filtered.slice(0, showCount).map((soc, i) => (
                                        <tr key={i} onClick={() => setSelectedSoc(soc)} className="cursor-pointer hover:bg-[#eaf2f6] transition-colors">
                                            <td className={`px-3 py-2 text-[10px] font-bold ${getKColor(soc.K)}`}>{fN(soc.K)}</td>
                                            <td className={`px-3 py-2 text-[10px] font-bold ${getKColor(soc.Kv)}`}>{fN(soc.Kv)}</td>
                                            <td className={`px-3 py-2 text-[10px] font-bold text-center ${getUtilColor(soc.PorcU)}`}>{soc.PorcU != null ? `${(soc.PorcU * 100).toFixed(0)}%` : '—'}</td>
                                            <td className={`px-3 py-2 text-[10px] text-right font-bold ${getCccColor(soc.conc_gral)}`}>{soc.conc_gral != null ? `${(soc.conc_gral * 100).toFixed(0)}%` : '—'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap"><span className="text-[10px] font-bold text-gray-900">{soc.razon_social}</span></td>
                                            <td className="px-3 py-2 text-[10px] text-gray-500 font-mono whitespace-nowrap">{soc.cuit}</td>
                                            <td className="px-3 py-2 text-[10px] font-bold text-gray-600 whitespace-nowrap">{soc.gs_nosis || '—'}</td>
                                            <td className="px-3 py-2 text-[10px] font-bold text-gray-600 whitespace-nowrap">{fFact(soc.gs_fact)}</td>
                                            <td className="px-3 py-2 text-center whitespace-nowrap">
                                                {soc.gs_sac
                                                    ? <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">SAC ✓</span>
                                                    : <span className="text-[10px] text-gray-300">—</span>
                                                }
                                            </td>
                                            <td className="px-3 py-2 text-[10px] font-black text-emerald-700 text-right whitespace-nowrap">{soc.gs_credito_jd ? fN(soc.gs_credito_jd) : '—'}</td>
                                            <td className="px-3 py-2 text-[10px] text-gray-600 whitespace-nowrap">{formatDate(soc.fecha_creacion)}</td>
                                            <td className="px-3 py-2 text-[10px] text-gray-600 whitespace-nowrap">{formatDate(soc.ult_ingreso)}</td>
                                            <td className="px-3 py-2 text-[10px] text-gray-600 text-right">{fN(soc.q_usuarios)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {soc._acDisplay === 'Directa' ? (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Directa</span>
                                                ) : (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`w-3 h-3 rounded-full bg-gradient-to-br ${getColorGrad(soc._acDisplay)} flex-shrink-0`} />
                                                        <span className="text-[10px] font-semibold text-gray-600">{soc._acDisplay.split(' ')[0]}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-[10px] text-[#3179a7] font-semibold text-right">{fN(soc.sugerido_ci_faena)}</td>
                                            <td className="px-3 py-2 text-[10px] text-red-700 font-bold text-right">{fN(soc.sugerido_ci_invernada)}</td>
                                            <td className="px-3 py-2 text-[10px] text-indigo-700 font-black text-right">{fN(soc.q_op_total)}</td>
                                            <td className="px-3 py-2 text-[10px] text-emerald-600 whitespace-nowrap">{formatDate(soc.Ult_op)}</td>
                                            <td className="px-3 py-2 text-[10px] text-gray-500 whitespace-nowrap">{formatDate(soc.Ult_act)}</td>
                                            <td className="px-3 py-2 text-[10px] text-gray-600 text-right">{fN(soc.q_ofrec_fae)}</td>
                                            <td className="px-3 py-2 text-[10px] text-gray-600 text-right">{fN(soc.q_ofrec_inv)}</td>
                                            <td className="px-3 py-2 text-[10px] text-gray-700 font-bold text-right">{fN(soc.q_ventas_fae)}</td>
                                            <td className="px-3 py-2 text-[10px] text-gray-700 font-bold text-right">{fN(soc.q_ventas_inv)}</td>
                                            <td className="px-3 py-2 text-[10px] text-gray-500 whitespace-nowrap">{formatDate(soc.FUV_fae)}</td>
                                            <td className="px-3 py-2 text-[10px] text-gray-500 whitespace-nowrap">{formatDate(soc.FUV_inv)}</td>
                                            <td className="px-3 py-2 text-[10px] text-indigo-700 font-bold text-right">{fN(soc.q_compras_fae)}</td>
                                            <td className="px-3 py-2 text-[10px] text-indigo-700 font-bold text-right">{fN(soc.q_compras_inv)}</td>
                                            <td className="px-3 py-2 text-[10px] text-gray-500 whitespace-nowrap">{formatDate(soc.FUC)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {filtered.length > showCount && (
                            <div className="p-4 text-center border-t border-gray-50">
                                <button onClick={() => setShowCount(c => c + 20)}
                                    className="text-xs font-semibold text-[#3179a7] hover:text-[#235677] px-4 py-2 rounded-lg hover:bg-[#eaf2f6] transition-colors">
                                    Ver más ({filtered.length - showCount} restantes)
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {selectedSoc && (
                <DetailPanel
                    isOpen={true}
                    onClose={() => setSelectedSoc(null)}
                    title={selectedSoc.razon_social}
                    subtitle={`CUIT: ${selectedSoc.cuit} · AC: ${selectedSoc.asociado_comercial || selectedSoc._acDisplay || '—'} · Rep: ${selectedSoc.representante || '—'}`}
                >
                    <div className="space-y-5 mt-4 pb-12">

                        {/* 1. KPIs principales */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">CCC General</p>
                                <p className="text-2xl font-black text-emerald-900 mt-0.5">{selectedSoc.conc_gral != null ? `${(selectedSoc.conc_gral * 100).toFixed(0)}%` : '—'}</p>
                                <p className="text-[9px] text-gray-400">FAE {selectedSoc.conc_gral_fae != null ? `${(selectedSoc.conc_gral_fae * 100).toFixed(0)}%` : '—'} · INV {selectedSoc.conc_gral_inv != null ? `${(selectedSoc.conc_gral_inv * 100).toFixed(0)}%` : '—'}</p>
                            </div>
                            <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
                                <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">Operaciones Total</p>
                                <p className="text-2xl font-black text-indigo-900 mt-0.5">{fN(selectedSoc.q_op_total)}</p>
                                <p className="text-[9px] text-gray-400">Últ. op: {formatDate(selectedSoc.Ult_op)}</p>
                            </div>
                            <div className="bg-[#eaf2f6] border border-[#bfd5e4] p-3 rounded-xl">
                                <p className="text-[9px] font-semibold text-[#3179a7] uppercase tracking-widest">Potencial K / Kv</p>
                                <p className="text-2xl font-black text-[#235677] mt-0.5">{fN(selectedSoc.K)}</p>
                                <p className="text-[9px] text-gray-400">Kv: {fN(selectedSoc.Kv)} · %U: {selectedSoc.PorcU != null ? `${(selectedSoc.PorcU * 100).toFixed(0)}%` : '—'}</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl">
                                <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Usuarios Plataforma</p>
                                <p className="text-2xl font-black text-amber-900 mt-0.5">{fN(selectedSoc.q_usuarios)}</p>
                                <p className="text-[9px] text-gray-400">Creación: {formatDate(selectedSoc.fecha_creacion)}</p>
                            </div>
                        </div>

                        {/* 2. Concreción últimas 5 (porc_conc_5) */}
                        <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/30">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Concreción — Últimas 5 Ops</h4>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'FAE', val: selectedSoc.porc_conc_5_Fae, color: 'text-rose-700' },
                                    { label: 'INV', val: selectedSoc.porc_conc_5_Inv, color: 'text-[#3179a7]' },
                                    { label: 'TOTAL', val: selectedSoc.porc_conc_5_Tot, color: 'text-emerald-700' },
                                ].map(({ label, val, color }) => (
                                    <div key={label} className="bg-white rounded-lg p-2 text-center border border-gray-100 shadow-sm">
                                        <p className="text-[9px] text-gray-400 font-bold uppercase">{label}</p>
                                        <p className={`text-xl font-black ${color} mt-0.5`}>{val != null ? `${(Number(val) * 100).toFixed(0)}%` : '—'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. Ventas / Compras por unidad */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/30">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3 border-b border-emerald-100 pb-2">Ventas Concretadas</h4>
                                <div className="space-y-2">
                                    {[
                                        { label: 'Faena', qty: selectedSoc.q_ventas_fae, date: selectedSoc.FUV_fae },
                                        { label: 'Invernada', qty: selectedSoc.q_ventas_inv, date: selectedSoc.FUV_inv },
                                        { label: 'Magistral', qty: selectedSoc.q_ventas_mag, date: selectedSoc.FUV_mag },
                                    ].map(({ label, qty, date }) => (
                                        <div key={label} className="flex justify-between items-center bg-white p-2 rounded border border-gray-100 shadow-sm">
                                            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">{label}</span>
                                            <div className="text-right">
                                                <span className="text-sm font-black text-gray-800">{fN(qty)}</span>
                                                <span className="text-[9px] font-normal text-gray-400 ml-1">{formatDate(date)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/30">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-3 border-b border-indigo-100 pb-2">Compras Concretadas</h4>
                                <div className="space-y-2">
                                    {[
                                        { label: 'Faena', qty: selectedSoc.q_compras_fae, date: selectedSoc.FUC },
                                        { label: 'Invernada', qty: selectedSoc.q_compras_inv, date: selectedSoc.FUC },
                                        { label: 'Magistral', qty: selectedSoc.q_compras_mag, date: selectedSoc.FUC },
                                    ].map(({ label, qty, date }) => (
                                        <div key={label} className="flex justify-between items-center bg-white p-2 rounded border border-gray-100 shadow-sm">
                                            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">{label}</span>
                                            <div className="text-right">
                                                <span className="text-sm font-black text-gray-800">{fN(qty)}</span>
                                                <span className="text-[9px] font-normal text-gray-400 ml-1">{formatDate(date)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 4. Ofrecimientos y CIs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/30">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-violet-600 mb-3 border-b border-violet-100 pb-2">Ofrecimientos</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'Ofrec. FAE', val: selectedSoc.q_ofrec_fae, sub: `Últ. NC: ${formatDate(selectedSoc.ult_noconc_fae)}` },
                                        { label: 'Ofrec. INV', val: selectedSoc.q_ofrec_inv, sub: `Últ. NC: ${formatDate(selectedSoc.ult_noconc_inv)}` },
                                    ].map(({ label, val, sub }) => (
                                        <div key={label} className="bg-white p-2 rounded border border-gray-100 shadow-sm">
                                            <p className="text-[9px] text-gray-400 font-bold uppercase">{label}</p>
                                            <p className="text-lg font-black text-violet-800">{fN(val)}</p>
                                            <p className="text-[9px] text-gray-400">{sub}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/30">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-600 mb-3 border-b border-teal-100 pb-2">CIs Comercializados</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'CI FAE', val: selectedSoc.cis_com_fae },
                                        { label: 'CI INV', val: selectedSoc.cis_com_inv },
                                        { label: 'Sugerido FAE', val: selectedSoc.sugerido_ci_faena, color: 'text-blue-700' },
                                        { label: 'Sugerido INV', val: selectedSoc.sugerido_ci_invernada, color: 'text-red-700' },
                                    ].map(({ label, val, color }) => (
                                        <div key={label} className="bg-white p-2 rounded border border-gray-100 shadow-sm">
                                            <p className="text-[9px] text-gray-400 font-bold uppercase">{label}</p>
                                            <p className={`text-lg font-black ${color || 'text-teal-800'}`}>{fN(val)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 5. Datos Crediticios (Google Sheets) */}
                        {(selectedSoc.gs_nosis || selectedSoc.gs_fact || selectedSoc.gs_sac || selectedSoc.gs_credito_jd || selectedSoc.gs_sac_credito) && (
                            <div className="border border-orange-100 rounded-xl p-4 bg-orange-50/30">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-3 border-b border-orange-100 pb-2">Datos Crediticios</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { label: 'NOSIS', val: selectedSoc.gs_nosis },
                                        { label: 'FACT', val: selectedSoc.gs_fact },
                                        { label: 'SAC', val: selectedSoc.gs_sac },
                                        { label: 'CRÉDITO SAC', val: selectedSoc.gs_sac_credito != null ? `${selectedSoc.gs_sac_credito} JD` : null },
                                        { label: 'CRÉDITO JD', val: selectedSoc.gs_credito_jd },
                                    ].map(({ label, val }) => (
                                        <div key={label} className="bg-white p-2 rounded border border-orange-100 shadow-sm text-center">
                                            <p className="text-[9px] text-gray-400 font-bold uppercase">{label}</p>
                                            <p className="text-sm font-black text-orange-800 mt-0.5">{val || '—'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 6. Actividad temporal */}
                        <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/30">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Cronología</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Creación', val: formatDate(selectedSoc.fecha_creacion) },
                                    { label: 'Últ. Ingreso Plat.', val: formatDate(selectedSoc.ult_ingreso) },
                                    { label: 'Últ. Operación', val: formatDate(selectedSoc.Ult_op) },
                                    { label: 'Últ. Actividad', val: formatDate(selectedSoc.Ult_act) },
                                    { label: 'Últ. Compra FAE', val: formatDate(selectedSoc.FUC) },
                                    { label: 'Últ. Venta FAE', val: formatDate(selectedSoc.FUV_fae) },
                                    { label: 'Últ. Venta INV', val: formatDate(selectedSoc.FUV_inv) },
                                    { label: 'Últ. Venta MAG', val: formatDate(selectedSoc.FUV_mag) },
                                ].map(({ label, val }) => (
                                    <div key={label} className="bg-white p-2 rounded border border-gray-100 shadow-sm">
                                        <p className="text-[9px] text-gray-400 font-bold uppercase">{label}</p>
                                        <p className="text-xs font-bold text-gray-800 mt-0.5">{val}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </DetailPanel>
            )}
        </div>
    );
}
