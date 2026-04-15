'use client';

import { useState, useEffect, useRef } from 'react';

// ─── Tipos de columna con drag & drop ─────────────────────────────────────
interface ColDef {
    key: string;
    label: string;
    cls?: string;
    render: (op: any) => React.ReactNode;
}

const normalizeUN = (un: string | null | undefined) => {
    if (!un) return 'Otros';
    const u = un.toUpperCase();
    if (['INVERNADA', 'INVERNADA NEO', 'CRÍA', 'CRIA', 'INV'].includes(u)) return 'Invernada';
    if (['FAENA', 'FAE'].includes(u)) return 'Faena';
    if (u === 'MAG') return 'MAG';
    return un;
};

const TIPO_COLOR: Record<string, string> = {
    Faena: 'bg-blue-500', Invernada: 'bg-red-500', MAG: 'bg-green-500',
};

function formatFecha(raw: string | null): string {
    if (!raw) return '—';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fN(n: any): string { return n == null ? '—' : Number(n).toLocaleString('es-AR'); }
function fC(n: any): string { return n == null ? '—' : '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 }); }

// ─── Definición de columnas (orden inicial sugerido) ──────────────────────
const INITIAL_COLS: ColDef[] = [
    { key: 'id_lote', label: 'ID', render: o => <span className="font-black text-gray-700">#{o.id_lote}</span> },
    { key: 'fecha_operacion', label: 'Fecha Op.', render: o => <span className="text-gray-500 font-medium">{formatFecha(o.fecha_operacion)}</span> },
    {
        key: 'UN', label: 'UN', render: o => (
            <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TIPO_COLOR[o.UN || o.Tipo] || 'bg-gray-400'}`} />
                <span className="font-bold text-gray-700">{o.UN || o.Tipo || '—'}</span>
            </div>
        )
    },
    { 
        key: 'Vendedor', label: 'Vendedor / AC', render: o => (
            <div className="flex flex-col">
                <span className="font-semibold text-gray-900 truncate max-w-[150px]" title={o.RS_Vendedora}>{o.RS_Vendedora || '—'}</span>
                <span className="text-[9px] text-gray-500 font-bold tracking-tight truncate max-w-[150px]" title={o.AC_Vend}>{o.AC_Vend || o.repre_vendedor || 'Directa'}</span>
            </div>
        ) 
    },
    { 
        key: 'Comprador', label: 'Comprador / AC', render: o => (
            <div className="flex flex-col">
                <span className="font-semibold text-gray-800 truncate max-w-[150px]" title={o.RS_Compradora}>{o.RS_Compradora || '—'}</span>
                <span className="text-[9px] text-gray-500 font-bold tracking-tight truncate max-w-[150px]" title={o.AC_Comp}>{o.AC_Comp || o.repre_comprador || 'Directa'}</span>
            </div>
        ) 
    },
    { key: 'Cat', label: 'Cat.', render: o => <span className="text-gray-700 font-medium bg-gray-50 px-1.5 py-0.5 rounded text-[10px]">{o.Cat || '—'}</span> },
    { key: 'Cabezas', label: 'Cabezas', cls: 'text-right', render: o => <span className="font-black text-gray-900 text-right block">{fN(o.Cabezas)}</span> },
    { key: 'Kgs', label: 'Kg/Cab', cls: 'text-right', render: o => <span className="text-gray-600 font-medium text-right block">{fN(o.Kgs)}</span> },
    {
        key: 'estado_combinado', label: 'Estado Gral / Tropa', render: o => {
            const e = (o.estado_general || '').trim();
            const et = (o.estado_tropas || '').trim();
            let cls = 'bg-gray-100 text-gray-600 border-gray-200';
            let dot = 'bg-gray-400';
            if (e === 'CONCRETADA') { cls = 'bg-emerald-50 text-emerald-700 border-emerald-200'; dot = 'bg-emerald-500'; }
            if (e === 'ANULADA') { cls = 'bg-red-50 text-red-700 border-red-200'; dot = 'bg-red-500'; }
            if (e === 'CERRADA' || o.Cierre === 1) { cls = 'bg-indigo-50 text-indigo-700 border-indigo-200'; dot = 'bg-indigo-500'; }
            
            return (
                <div className={`flex flex-col border rounded-md px-2 py-1 max-w-[140px] ${cls}`}>
                    <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${dot} animate-pulse`} />
                        <span className="text-[10px] items-center font-black truncate">{e || '—'}</span>
                    </div>
                    {et && <span className="text-[9px] opacity-75 font-semibold leading-tight truncate mt-0.5">{et}</span>}
                </div>
            );
        }
    },
    { key: 'part_prov', label: 'Origen/Destino', render: o => (
        <div className="flex flex-col">
            <span className="text-gray-600 truncate max-w-[120px] font-medium" title={o.part_prov}>O: {o.part_prov || '—'}</span>
            <span className="text-gray-500 truncate max-w-[120px] text-[9px]" title={o.destino}>D: {o.destino || '—'}</span>
        </div>
    ) },
    { key: 'precio_vend', label: 'Precio C/V', cls: 'text-right', render: o => (
        <div className="flex flex-col text-right">
            <span className="text-emerald-700 font-black text-[11px]" title="Precio Compra">{fC(o.precio_comp)}</span>
            <span className="text-gray-400 font-bold text-[9px]" title="Precio Venta">{fC(o.precio_vend)}</span>
        </div>
    ) },
    { key: 'plazo_vend', label: 'Plazo C/V', cls: 'text-right', render: o => (
        <div className="flex flex-col text-right">
            <span className="text-gray-800 font-bold text-[10px]" title="Plazo Compra">{fN(o.plazo_comp)}d</span>
            <span className="text-gray-400 font-semibold text-[9px]" title="Plazo Venta">{fN(o.plazo_vend)}d</span>
        </div>
    ) },
    {
        key: 'resultado_final', label: 'Resultado / Regional', cls: 'text-right', render: o => {
            const vTotal = Number(o.resultado_final) || 0;
            const vRegV  = Number(o.resultado_regional_vendedor)  || 0;
            const vRegC  = Number(o.resultado_regional_comprador) || 0;
            const vReg   = vRegV + vRegC;

            const resColor = vTotal > 0 ? 'text-emerald-600' : vTotal < 0 ? 'text-red-500' : 'text-gray-400';
            const regColor = vReg   > 0 ? 'text-blue-600'    : vReg   < 0 ? 'text-red-400' : 'text-gray-400';

            const imp  = Number(o.importe_vendedor) || 0;
            const bonif = Number(o.bonif_vend) || 0;
            const bas  = imp + bonif;
            const pct  = bas === 0 ? 0 : (vTotal / bas) * 100;
            const pctColor = pct > 0 ? 'text-emerald-600 bg-emerald-50' : pct < 0 ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50';

            // Porción regional como % del resultado total
            const regPct = vTotal === 0 ? 0 : (vReg / vTotal) * 100;

            return (
                <div className="flex flex-col text-right items-end justify-center gap-0.5">
                    {/* Resultado total del negocio */}
                    <span className={`font-black tracking-tight ${resColor}`}>{fC(vTotal)}</span>
                    <span className={`text-[9px] font-bold px-1 rounded-sm ${pctColor}`}>{pct.toFixed(2)}%</span>
                    {/* Resultado regional (split 2/3-1/3) */}
                    {vReg !== 0 && (
                        <div className="flex items-center gap-1 mt-0.5 border-t border-gray-100 pt-0.5">
                            <span className="text-[8px] text-gray-400 font-bold">REG</span>
                            <span className={`text-[10px] font-black ${regColor}`}>{fC(vReg)}</span>
                            <span className="text-[8px] text-gray-400">({regPct.toFixed(0)}%)</span>
                        </div>
                    )}
                </div>
            );
        }
    },
];

interface Props { 
    operaciones: any[];
    groupByEstados?: boolean;
    title?: string;
}

export default function OperacionesRegional({ operaciones, title = "Operaciones del período", groupByEstados = false }: Props) {
    const [filterTipo, setFilterTipo] = useState('todos');
    const [filterEstado, setFilterEstado] = useState('todos');
    const [filterEstadoTropa, setFilterEstadoTropa] = useState('todos');
    const [filterAC, setFilterAC] = useState('todos');
    const [filterDirecta, setFilterDirecta] = useState(false);
    const [search, setSearch] = useState('');
    const [showCount, setShowCount] = useState(25);
    const [cols, setCols] = useState(INITIAL_COLS);
    const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
    const dragIdx = useRef<number | null>(null);

    // Normalize right away
    const normOps = operaciones.map(o => ({ ...o, UN: normalizeUN(o.UN || o.Tipo) }));

    // Valores únicos de tipo y estado y AC
    const tipos = Array.from(new Set(normOps.map(o => o.UN || '').filter(Boolean)));
    const estados = Array.from(new Set(normOps.map(o => (o.estado_general || '').trim()).filter(Boolean)));
    const estadosTropa = Array.from(new Set(normOps.map(o => (o.estado_tropas || '').trim()).filter(Boolean)));
    const acs = Array.from(new Set(
        normOps.flatMap(o => [(o.AC_Vend || '').trim(), (o.AC_Comp || '').trim()]).filter(Boolean)
    )).sort();

    let filtered = normOps.filter(o => {
        const okTipo = filterTipo === 'todos' || o.UN === filterTipo;
        const okEstado = filterEstado === 'todos' || (o.estado_general || '').trim() === filterEstado;
        const okEstadoTropa = filterEstadoTropa === 'todos' || (o.estado_tropas || '').trim() === filterEstadoTropa;
        const okAC = filterAC === 'todos' || (o.AC_Vend || '').trim() === filterAC || (o.AC_Comp || '').trim() === filterAC;
        const okDirecta = !filterDirecta || (!o.AC_Vend && !o.AC_Comp);

        // Búsqueda inteligente (red neuronal figurativa) a través de los campos
        const q = search.toLowerCase();
        const okSearch = !q ||
            (o.RS_Vendedora || '').toLowerCase().includes(q) ||
            (o.RS_Compradora || '').toLowerCase().includes(q) ||
            (o.AC_Vend || '').toLowerCase().includes(q) ||
            (o.AC_Comp || '').toLowerCase().includes(q) ||
            (o.repre_vendedor || '').toLowerCase().includes(q) ||
            (o.repre_comprador || '').toLowerCase().includes(q) ||
            (o.part_prov || '').toLowerCase().includes(q) ||
            (o.destino || '').toLowerCase().includes(q) ||
            (o.estado_general || '').toLowerCase().includes(q) ||
            (o.estado_tropas || '').toLowerCase().includes(q) ||
            String(o.id_lote).includes(q);

        return okTipo && okEstado && okEstadoTropa && okAC && okDirecta && okSearch;
    });

    if (sortConfig) {
        const col = sortConfig;
        filtered = [...filtered].sort((a, b) => {
            let va = a[col.key], vb = b[col.key];
            if (col.key === 'fecha_operacion') { va = new Date(va || 0).getTime(); vb = new Date(vb || 0).getTime(); }
            if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
            if (va < vb) return col.dir === 'asc' ? -1 : 1;
            if (va > vb) return col.dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // ─── Drag & Drop ──────────────────────────────────────────────────────
    function onDragStart(idx: number) { dragIdx.current = idx; }
    function onDragOver(e: React.DragEvent, idx: number) {
        e.preventDefault();
        if (dragIdx.current === null || dragIdx.current === idx) return;
        const next = [...cols];
        const [moved] = next.splice(dragIdx.current, 1);
        next.splice(idx, 0, moved);
        dragIdx.current = idx;
        setCols(next);
    }
    function onDrop() { dragIdx.current = null; }

    function toggleSort(key: string) {
        setSortConfig(c => c?.key === key ? { key, dir: c.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    }

    const kpisTipo = tipos.map(t => ({ tipo: t, count: operaciones.filter(o => (o.UN || o.Tipo) === t).length }))
        .sort((a, b) => b.count - a.count);

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                    <div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <span>📋</span> {title}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {operaciones.length} total · {filtered.length} filtradas
                            <span className="ml-2 text-[10px] text-blue-400">· Arrastrá headers para reordenar columnas</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <label className="flex items-center gap-1.5 text-xs text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
                            <input
                                type="checkbox"
                                checked={filterDirecta}
                                onChange={e => setFilterDirecta(e.target.checked)}
                                className="accent-blue-600 rounded"
                            />
                            <span className="font-bold">Solo Directas</span>
                        </label>
                        <select
                            value={filterAC}
                            onChange={(e) => setFilterAC(e.target.value)}
                            className="text-[11px] font-bold px-3 py-1.5 border border-gray-200 rounded-lg outline-none w-full sm:w-48 bg-gray-50 focus:bg-white focus:border-blue-300 transition-colors text-gray-700"
                        >
                            <option value="todos">Todos los comerciales ({acs.length})</option>
                            {acs.map(ac => (
                                <option key={ac} value={ac}>{ac}</option>
                            ))}
                        </select>
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar sociedad o ID..."
                            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg outline-none w-full sm:w-52 bg-gray-50 focus:bg-white focus:border-blue-300 transition-colors" />
                    </div>
                </div>

                {/* Filtro UN */}
                <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setFilterTipo('todos')}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${filterTipo === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        Todos ({operaciones.length})
                    </button>
                    {kpisTipo.map(k => (
                        <button key={k.tipo} onClick={() => setFilterTipo(filterTipo === k.tipo ? 'todos' : k.tipo)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${filterTipo === k.tipo ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${TIPO_COLOR[k.tipo] || 'bg-gray-400'}`} />
                            {k.tipo} ({k.count})
                        </button>
                    ))}
                </div>

                {/* Filtro Estado */}
                <div className="flex flex-wrap gap-1.5 items-center">
                    {!groupByEstados && (
                        <>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Estado Gen:</span>
                            <button onClick={() => setFilterEstado('todos')}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${filterEstado === 'todos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                Todos
                            </button>
                            {estados.map(e => (
                                <button key={e} onClick={() => setFilterEstado(filterEstado === e ? 'todos' : e)}
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${filterEstado === e ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                    {e}
                                </button>
                            ))}
                        </>
                    )}

                    {estadosTropa.length > 0 && (
                        <>
                            {!groupByEstados && <div className="w-px h-4 bg-gray-200 mx-2" />}
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Estado Tropa:</span>
                            <button onClick={() => setFilterEstadoTropa('todos')}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${filterEstadoTropa === 'todos' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                Todos
                            </button>
                            {estadosTropa.map(e => (
                                <button key={e} onClick={() => setFilterEstadoTropa(filterEstadoTropa === e ? 'todos' : e)}
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${filterEstadoTropa === e ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                    {e}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* Tabla Principal o Agrupada */}
            {(() => {
                const renderTable = (data: any[], isGrouped: boolean = false) => {
                    if (data.length === 0) return <div className="p-10 text-center text-gray-400 text-sm">Sin datos.</div>;
                    const finalCols = isGrouped ? cols.filter(c => c.key !== 'estado_combinado' && c.key !== 'part_prov') : cols;
                    return (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            {finalCols.map((col, idx) => (
                                                <th
                                                    key={col.key}
                                                    draggable
                                                    onDragStart={() => onDragStart(idx)}
                                                    onDragOver={e => onDragOver(e, idx)}
                                                    onDrop={onDrop}
                                                    onClick={() => toggleSort(col.key)}
                                                    className={`px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap cursor-grab active:cursor-grabbing select-none hover:bg-gray-100 hover:text-gray-700 transition-colors ${col.cls || 'text-left'}`}
                                                    title="Arrastrá para reordenar"
                                                >
                                                    <div className={`flex items-center gap-1 ${col.cls === 'text-right' ? 'justify-end' : ''}`}>
                                                        <span className="text-gray-300 opacity-40">⠿</span>
                                                        {col.label}
                                                        {sortConfig?.key === col.key && (
                                                            <span className="text-blue-500 font-black">{sortConfig.dir === 'asc' ? '↑' : '↓'}</span>
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {data.slice(0, showCount).map((op, i) => (
                                            <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                                                {finalCols.map(col => (
                                                    <td key={col.key} className={`px-3 py-2 whitespace-nowrap text-[10px] ${col.cls || ''}`}>
                                                        {col.render(op)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {data.length > showCount && (
                                <div className="p-4 text-center border-t border-gray-50">
                                    <button onClick={() => setShowCount(c => c + 25)}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                                        Ver más ({data.length - showCount} restantes)
                                    </button>
                                </div>
                            )}
                        </>
                    );
                };

                if (groupByEstados) {
                    const grouped = filtered.reduce((acc, op) => {
                        const e = (op.estado_tropas || op.estado_general || 'SIN ESTADO').trim();
                        if (!acc[e]) acc[e] = [];
                        acc[e].push(op);
                        return acc;
                    }, {} as Record<string, any[]>);

                    const keys = Object.keys(grouped).sort();

                    return (
                        <div className="space-y-6">
                            {keys.map(k => (
                                <div key={k} className="border-t border-gray-100 mt-4 first:mt-0 first:border-0 border-x-0">
                                    <div className="bg-gray-100 px-4 py-2 text-[10px] font-black text-gray-700 uppercase tracking-widest border-y border-gray-200">
                                        {k} <span className="text-gray-400 font-bold ml-1 text-[8px] tracking-tight">({grouped[k].length} OPs)</span>
                                    </div>
                                    {renderTable(grouped[k], true)}
                                </div>
                            ))}
                        </div>
                    );
                }

                return renderTable(filtered);
            })()}
        </div>
    );
}
