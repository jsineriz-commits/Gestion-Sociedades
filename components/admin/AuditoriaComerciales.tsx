'use client';

import { useState, useEffect, useMemo } from 'react';

interface Props {
    ops: any[];          // opsOficina (Card 4553) ya filtradas por período
    canal?: string | null;
    selectedYear?: number;
    selectedMes?: number;
    filterCierre?: boolean;
}

interface ComercialRow {
    nombre: string;
    ops: number;
    cabezas: number;
    resultado: number;
    uns: string[];
}

function buildList(
    items: any[],
    nombreField: string,
    cabezasField: string,
    resultadoField: string
): ComercialRow[] {
    const map = new Map<string, ComercialRow>();
    items.forEach(o => {
        const nombre = (o[nombreField] || '').trim();
        if (!nombre) return;
        const cabezas = Number(o[cabezasField] || o.Cabezas || 0);
        const resultado = Number(o[resultadoField] || 0);
        const un = (o.UN || o.Tipo || '').trim();
        if (!map.has(nombre)) map.set(nombre, { nombre, ops: 0, cabezas: 0, resultado: 0, uns: [] });
        const r = map.get(nombre)!;
        r.ops++;
        r.cabezas += cabezas;
        r.resultado += resultado;
        if (un && !r.uns.includes(un)) r.uns.push(un);
    });
    return Array.from(map.values()).sort((a, b) => b.cabezas - a.cabezas);
}

function buildRepreList(tropas: any[], nombreField: string): ComercialRow[] {
    const map = new Map<string, ComercialRow>();
    tropas.forEach(t => {
        const nombre = (t[nombreField] || '').trim();
        if (!nombre) return;
        const cabezas = Number(t.Cabezas || 0);
        const un = (t.Tipo || t.UN || '').trim();
        if (!map.has(nombre)) map.set(nombre, { nombre, ops: 0, cabezas: 0, resultado: 0, uns: [] });
        const r = map.get(nombre)!;
        r.ops++;
        r.cabezas += cabezas;
        if (un && !r.uns.includes(un)) r.uns.push(un);
    });
    return Array.from(map.values()).sort((a, b) => b.cabezas - a.cabezas);
}

const fNum = (n: number) => n.toLocaleString('es-AR');
const fM = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
    return `$${n.toFixed(0)}`;
};

function ComercialTable({ title, icon, rows, accent, showResultado }: {
    title: string; icon: string; rows: ComercialRow[]; accent: string; showResultado?: boolean;
}) {
    const [search, setSearch] = useState('');
    const filtered = rows.filter(r => r.nombre.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r ${accent}`}>
                <div className="flex items-center gap-2">
                    <span className="text-xl">{icon}</span>
                    <div>
                        <p className="text-sm font-black text-white">{title}</p>
                        <p className="text-[10px] text-white/70 font-medium">{rows.length} únicos · {fNum(rows.reduce((s, r) => s + r.cabezas, 0))} cab</p>
                    </div>
                </div>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="text-xs px-2 py-1.5 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30 outline-none w-28 focus:w-36 transition-all"
                />
            </div>

            {/* Table */}
            <div className="overflow-y-auto max-h-80 flex-1">
                <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr className="border-b border-gray-100">
                            <th className="px-3 py-2 text-left font-bold text-gray-400 uppercase tracking-wide">#</th>
                            <th className="px-3 py-2 text-left font-bold text-gray-400 uppercase tracking-wide">Nombre</th>
                            <th className="px-3 py-2 text-right font-bold text-gray-400 uppercase tracking-wide">Ops</th>
                            <th className="px-3 py-2 text-right font-bold text-gray-400 uppercase tracking-wide">Cabezas</th>
                            {showResultado && <th className="px-3 py-2 text-right font-bold text-gray-400 uppercase tracking-wide">Resultado</th>}
                            <th className="px-3 py-2 text-left font-bold text-gray-400 uppercase tracking-wide">UNs</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filtered.map((r, i) => (
                            <tr key={r.nombre} className="hover:bg-gray-50/80 transition-colors">
                                <td className="px-3 py-2 text-gray-300 font-bold">{i + 1}</td>
                                <td className="px-3 py-2 font-semibold text-gray-800">{r.nombre}</td>
                                <td className="px-3 py-2 text-right text-gray-500">{r.ops}</td>
                                <td className="px-3 py-2 text-right font-bold text-gray-700">{fNum(r.cabezas)}</td>
                                {showResultado && (
                                    <td className={`px-3 py-2 text-right font-bold ${r.resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {fM(r.resultado)}
                                    </td>
                                )}
                                <td className="px-3 py-2 text-gray-400 text-[10px]">{r.uns.join(', ')}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-300 text-xs">Sin resultados</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-50 text-[9px] text-gray-300 text-right">
                mostrando {filtered.length} de {rows.length}
            </div>
        </div>
    );
}

export default function AuditoriaComerciales({ ops, canal, selectedYear, selectedMes, filterCierre }: Props) {
    const [tropas, setTropas] = useState<any[]>([]);
    const [loadingTropas, setLoadingTropas] = useState(false);

    // Filtrar ops por cierre si corresponde
    const opsFiltradas = useMemo(() =>
        filterCierre ? ops.filter(o => Number(o.Cierre) === 1) : ops
    , [ops, filterCierre]);

    // Listas de AC desde ops filtradas (Card 4553)
    const acVendRows  = useMemo(() => buildList(opsFiltradas, 'AC_Vend', 'Cabezas', 'resultado_regional_vendedor'), [opsFiltradas]);
    const acCompRows  = useMemo(() => buildList(opsFiltradas, 'AC_Comp', 'Cabezas', 'resultado_regional_comprador'), [opsFiltradas]);

    // Listas de repre desde Q95
    const repreVendRows  = useMemo(() => buildRepreList(tropas, 'repre_vendedor'), [tropas]);
    const repreCompRows  = useMemo(() => buildRepreList(tropas, 'repre_comprador'), [tropas]);

    useEffect(() => {
        const hoy = new Date();
        const year = selectedYear ?? hoy.getFullYear();
        const mes  = selectedMes ?? 0;
        // Calcular fechas del período seleccionado
        let desde: string, hasta: string;
        if (mes === 0) {
            desde = `${year}-01-01`;
            const esActual = year === hoy.getFullYear();
            hasta = esActual ? hoy.toISOString().split('T')[0] : `${year}-12-31`;
        } else {
            desde = `${year}-${String(mes).padStart(2, '0')}-01`;
            const ultimoDia = new Date(year, mes, 0);
            hasta = ultimoDia > hoy ? hoy.toISOString().split('T')[0] : ultimoDia.toISOString().split('T')[0];
        }
        const params = new URLSearchParams({ fecha_desde: desde, fecha_hasta: hasta, isAdmin: 'true' });
        if (canal) params.set('canal', canal);
        setLoadingTropas(true);
        fetch(`/api/regional/tropas?${params}`)
            .then(r => r.json())
            .then(d => setTropas(d.tropas || []))
            .catch(() => {})
            .finally(() => setLoadingTropas(false));
    }, [canal, selectedYear, selectedMes]);

    const statsAC = {
        totalVend: acVendRows.length,
        totalComp: acCompRows.length,
        soloVenta: acVendRows.filter(r => !acCompRows.find(c => c.nombre === r.nombre)).length,
        soloCompra: acCompRows.filter(r => !acVendRows.find(v => v.nombre === r.nombre)).length,
        ambos: acVendRows.filter(r => acCompRows.find(c => c.nombre === r.nombre)).length,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-gray-900">Auditoría de Comerciales</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Listados únicos de AC y Representantes · {canal ? `Canal: ${canal}` : 'Todos los canales'} · YTD {new Date().getFullYear()}
                    </p>
                </div>
            </div>

            {/* Stats resumen */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: 'AC Vendedores', val: statsAC.totalVend, color: 'text-[#3179a7]', bg: 'bg-[#eaf2f6]' },
                    { label: 'AC Compradores', val: statsAC.totalComp, color: 'text-purple-700', bg: 'bg-purple-50' },
                    { label: 'Solo Venta', val: statsAC.soloVenta, color: 'text-[#3179a7]', bg: 'bg-[#eaf2f6]/50' },
                    { label: 'Solo Compra', val: statsAC.soloCompra, color: 'text-purple-500', bg: 'bg-purple-50/50' },
                    { label: 'Ambos lados', val: statsAC.ambos, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3`}>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{s.label}</p>
                        <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                    </div>
                ))}
            </div>

            {/* Tablas AC */}
            <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Asociados Comerciales (Card 4553)</p>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <ComercialTable
                        title="AC Vendedores únicos"
                        icon="🔵"
                        rows={acVendRows}
                        accent="from-[#3179a7] to-[#4a9fd4]"
                        showResultado
                    />
                    <ComercialTable
                        title="AC Compradores únicos"
                        icon="🟣"
                        rows={acCompRows}
                        accent="from-purple-600 to-purple-500"
                        showResultado
                    />
                </div>
            </div>

            {/* Tablas Representantes */}
            <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                    Representantes (Q95 Estado Tropas) {loadingTropas ? '· Cargando...' : `· ${tropas.length} tropas`}
                </p>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <ComercialTable
                        title="Representantes Vendedores únicos"
                        icon="🏠"
                        rows={repreVendRows}
                        accent="from-slate-600 to-slate-500"
                    />
                    <ComercialTable
                        title="Representantes Compradores únicos"
                        icon="🏡"
                        rows={repreCompRows}
                        accent="from-teal-600 to-teal-500"
                    />
                </div>
            </div>
        </div>
    );
}
