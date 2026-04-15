'use client';

import { useState, useMemo, useEffect } from 'react';
import { normalizeUN } from '@/lib/utils/unColors';
import DetailPanel from '@/components/ui/DetailPanel';

function formatFecha(raw: string | null): string {
    if (!raw) return '—';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Solo dos estados posibles en la vista de Ofrecimientos
function normalizeEstado(raw: string | null | undefined): 'Publicadas' | 'Ofrecidas' {
    const s = (raw || '').toLowerCase().trim();
    if (s.includes('publicad') || s === 'activo' || s === 'activa' || s === 'activ') return 'Publicadas';
    return 'Ofrecidas';
}

interface Lote {
    id: number;
    categoria: string;
    peso: number;
    cabezas: number;
    raza: string;
    sociedad_vendedora: string;
    representante: string;
    operador: string;          // AC (Asociado Comercial) de la sociedad vendedora
    generado_por?: string;     // Operador que cargó la tropa en plataforma
    provincia: string;
    localidad?: string;
    dia_hora_publicacion: string;
    Estado_Pub: string;
    cant_ofertas?: number;
    ofertas?: any[];
}

interface Props {
    lotes: Lote[];
    acFilter?: string | null;  // nombre del AC para filtrar publicaciones
}

type SortField = 'id' | 'categoria' | 'cabezas' | 'peso' | 'sociedad_vendedora' | 'Estado_Pub' | 'fecha' | 'localidad' | 'cant_ofertas' | 'operador' | 'representante';

export default function Publicaciones({ lotes, acFilter }: Props) {
    const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: 'asc' | 'desc' }>({ field: 'fecha', direction: 'desc' });
    const [selectedLote, setSelectedLote] = useState<Lote | null>(null);
    const [ofertasMB2, setOfertasMB2] = useState<any[] | null>(null);
    const [loadingOfertas, setLoadingOfertas] = useState(false);

    useEffect(() => {
        if (!selectedLote) {
            setOfertasMB2(null);
            return;
        }
        
        setLoadingOfertas(true);
        fetch(`/api/ofertas?id_lote=${selectedLote.id}`)
            .then(res => res.json())
            .then(data => {
                setOfertasMB2(Array.isArray(data) ? data : []);
                setLoadingOfertas(false);
            })
            .catch(err => {
                console.error(err);
                setOfertasMB2([]);
                setLoadingOfertas(false);
            });
    }, [selectedLote]);

    const [unFilter, setUnFilter] = useState('all');
    const [catFilter, setCatFilter] = useState('all');
    const [origFilter, setOrigFilter] = useState('all');

    const options = useMemo(() => {
        const uns = new Set<string>();
        const cats = new Set<string>();
        const provs = new Set<string>();
        lotes.forEach(l => {
            uns.add(normalizeUN(l.categoria || ''));
            cats.add(l.categoria || 'S/D');
            provs.add(l.provincia || 'S/D');
        });
        return {
            uns: Array.from(uns).filter(Boolean).sort(),
            cats: Array.from(cats).filter(c => Boolean(c) && c !== '—').sort(),
            provs: Array.from(provs).filter(p => Boolean(p) && p !== '—').sort()
        };
    }, [lotes]);

    const recientes = useMemo(() => {
        // Excluimos estados claramente inactivos/cerrados.
        // Preferimos exclusión sobre inclusión para no cortar estados activos desconocidos.
        const ESTADOS_EXCLUIDOS = ['cerrad', 'liquidada', 'liquid', 'a cargar', 'sinofrecimiento', 'sin ofrecimiento', 'no concretad', 'comprado'];
        let base = lotes.filter((l: any) => {
            const est = (l.Estado_Pub || '').toLowerCase().trim();
            if (!est || est === 'ofrecimiento') return true; // fallback positivo
            return !ESTADOS_EXCLUIDOS.some(e => est.includes(e));
        });

        // Si hay un filtro de AC activo, mostrar solo las tropas donde ese AC es vendedor
        if (acFilter) {
            const filterLower = acFilter.toLowerCase().trim();
            base = base.filter((l: any) => {
                const op = (l.operador || l.asociado_comercial || '').toLowerCase().trim();
                return op === filterLower;
            });
        }

        return base.filter(l => {
            if (unFilter !== 'all' && normalizeUN(l.categoria || '') !== unFilter) return false;
            if (catFilter !== 'all' && (l.categoria || 'S/D') !== catFilter) return false;
            if (origFilter !== 'all' && (l.provincia || 'S/D') !== origFilter) return false;
            return true;
        });
    }, [lotes, acFilter, unFilter, catFilter, origFilter]);

    const sortedData = useMemo(() => {
        const lotesRecientes = recientes; // Renamed for clarity with the instruction's snippet
        return [...lotesRecientes].sort((a, b) => {
            let valA: any = a[sortConfig.field as keyof Lote];
            let valB: any = b[sortConfig.field as keyof Lote];

            if (sortConfig.field === 'Estado_Pub') {
                valA = normalizeEstado(a.Estado_Pub);
                valB = normalizeEstado(b.Estado_Pub);
            } else if (sortConfig.field === 'fecha') {
                valA = new Date(a.dia_hora_publicacion || 0).getTime();
                valB = new Date(b.dia_hora_publicacion || 0).getTime();
            } else if (sortConfig.field === 'localidad') {
                valA = `${a.localidad || ''} ${a.provincia || ''}`.trim().toLowerCase();
                valB = `${b.localidad || ''} ${b.provincia || ''}`.trim().toLowerCase();
            } else if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = (valB || '').toLowerCase();
            } else if (typeof valA === 'number') {
                valA = valA || 0;
                valB = valB || 0;
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [recientes, sortConfig]);

    const handleSort = (field: SortField) => {
        setSortConfig(current => ({
            field,
            direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (field: SortField) => {
        if (sortConfig.field !== field) return <span className="text-gray-300 opacity-50 ml-1">↕</span>;
        return <span className="text-blue-500 ml-1 font-black">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    const SortableTh = ({ field, label, cls = "text-left", hideOn = "" }: { field: SortField, label: string, cls?: string, hideOn?: string }) => (
        <th
            className={`px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hover:text-gray-700 transition-colors select-none ${cls} ${hideOn}`}
            onClick={() => handleSort(field)}
        >
            <div className={`flex items-center ${cls === 'text-right' ? 'justify-end' : cls === 'text-center' ? 'justify-center' : 'justify-start'}`}>
                {label} {getSortIcon(field)}
            </div>
        </th>
    );

    const totalLotes = recientes.length;
    const totalLcbzs = recientes.reduce((s, l) => s + (l.cabezas || 0), 0);
    const totalOfertas = recientes.reduce((s, l) => s + (l.cant_ofertas || 0), 0);

    const StatCard = ({ title, icon, val, unit }: { title: string, icon: string, val: number, unit: string }) => (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
                <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-gray-900">{val.toLocaleString('es-AR')}</span>
                    <span className="text-xs font-bold text-gray-400 uppercase">{unit}</span>
                </div>
            </div>
            <div className="text-2xl opacity-80">{icon}</div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Tropas Publicadas" icon="📢" val={totalLotes} unit="lotes" />
                <StatCard title="Cabezas Publicadas" icon="🐂" val={totalLcbzs} unit="cbzs" />
                <StatCard title="Ofertas Recibidas" icon="💬" val={totalOfertas} unit="ofertas" />
            </div>

            {/* Fila de Filtros */}
            <div className="flex flex-wrap gap-2">
                <select value={unFilter} onChange={e => setUnFilter(e.target.value)} className="px-3 py-2 text-[11px] font-bold bg-white border border-gray-200 rounded-xl outline-none hover:bg-gray-50 transition-colors uppercase">
                    <option value="all">Todas las UN</option>
                    {options.uns.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-3 py-2 text-[11px] font-bold bg-white border border-gray-200 rounded-xl outline-none hover:bg-gray-50 transition-colors uppercase">
                    <option value="all">Todas las Categorías</option>
                    {options.cats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={origFilter} onChange={e => setOrigFilter(e.target.value)} className="px-3 py-2 text-[11px] font-bold bg-white border border-gray-200 rounded-xl outline-none hover:bg-gray-50 transition-colors uppercase">
                    <option value="all">Todos los Orígenes</option>
                    {options.provs.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
                <div className="p-5 border-b border-gray-100 bg-emerald-50/50">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <span className="text-emerald-500 animate-pulse">●</span> Registro de Publicaciones
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {sortedData.length} lote{sortedData.length !== 1 ? 's' : ''} en plataforma.
                    </p>
                </div>

                {sortedData.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 text-sm">
                        No hay tropas publicadas en este periodo / vista.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <SortableTh field="id" label="ID" />
                                    <SortableTh field="sociedad_vendedora" label="SOCIEDAD" />
                                    <SortableTh field="cant_ofertas" label="COTIZADA" cls="text-center" />
                                    <SortableTh field="categoria" label="CATEG." hideOn="hidden sm:table-cell" />
                                    <SortableTh field="cabezas" label="CBZS" cls="text-right" />
                                    <SortableTh field="operador" label="ASOC. COMERCIAL" hideOn="hidden md:table-cell" />
                                    <SortableTh field="localidad" label="ORIGEN" hideOn="hidden lg:table-cell" />
                                    <SortableTh field="fecha" label="Publicado" hideOn="hidden lg:table-cell" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sortedData.map((lote, i) => {
                                    const isNuevo = new Date().getTime() - new Date(lote.dia_hora_publicacion).getTime() < (12 * 60 * 60 * 1000); // 12hs = Nuevo
                                    return (
                                        <tr key={i} onClick={() => setSelectedLote(lote)} className="cursor-pointer hover:bg-blue-50 transition-colors">
                                            {/* 1. ID */}
                                            <td className="px-3 py-2.5 font-black text-gray-900 text-xs whitespace-nowrap">#{(lote as any).id_lote || lote.id}</td>
                                            {/* 2. Sociedad */}
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs font-bold text-gray-800 line-clamp-1 max-w-[180px] block">{lote.sociedad_vendedora}</span>
                                                        {isNuevo && <span className="px-1 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black rounded-full">NEW</span>}
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 font-medium">{lote.categoria}</span>
                                                </div>
                                            </td>
                                            {/* 3. Cotizada */}
                                            <td className="px-3 py-2.5 text-center">
                                                {(lote.cant_ofertas || 0) > 0 ? (
                                                    <div className="flex flex-col items-center gap-0.5 relative group">
                                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-[10px] font-black cursor-help">
                                                            {lote.cant_ofertas}
                                                        </span>
                                                        <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wider">Cotiz.</span>
                                                        {lote.ofertas && lote.ofertas.length > 0 && (
                                                            <div className="absolute top-1/2 left-full -translate-y-1/2 ml-2 w-max max-w-[200px] z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200">
                                                                <div className="bg-gray-900 text-white text-[10px] p-2 rounded-lg shadow-xl text-left">
                                                                    <p className="font-bold text-gray-400 mb-1 border-b border-gray-700 pb-1 w-full text-center">Ofertantes</p>
                                                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                                                        {lote.ofertas.map((o: any, idx: number) => (
                                                                            <div key={idx} className="flex justify-between gap-3">
                                                                                <span className="truncate max-w-[120px]" title={o.ofertante}>{o.ofertante || 'Desconocido'}</span>
                                                                                <span className="font-mono text-emerald-400 font-bold">${o.monto || o.precio || '-'}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-gray-900" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-200 text-xs">—</span>
                                                )}
                                            </td>
                                            {/* isNuevo badge — en la celda de Sociedad */}
                                            {/* 5. Categoría — hidden en xs */}
                                            <td className="px-3 py-2.5 hidden sm:table-cell">
                                                <span className="font-bold text-gray-700 text-[11px] bg-gray-100 px-1.5 py-0.5 rounded">{lote.categoria}</span>
                                            </td>
                                            {/* 6. Cabezas */}
                                            <td className="px-3 py-2.5 text-right font-black text-gray-900 text-sm">{(lote.cabezas || 0).toLocaleString('es-AR')}</td>
                                            {/* 7. Asociado Comercial + Operador — hidden en mobile */}
                                            <td className="px-3 py-2.5 hidden md:table-cell">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-bold text-blue-700 line-clamp-1 block max-w-[120px]" title={lote.operador}>{lote.operador || '—'}</span>
                                                    {lote.generado_por && lote.generado_por !== lote.operador && (
                                                        <span className="text-[10px] text-gray-400 line-clamp-1 block max-w-[120px]" title={lote.generado_por}>Op: {lote.generado_por}</span>
                                                    )}
                                                </div>
                                            </td>
                                            {/* 8. Origen — hidden en mobile/tablet */}
                                            <td className="px-3 py-2.5 hidden lg:table-cell">
                                                <span className="text-[11px] text-gray-500 line-clamp-1 block">{[lote.localidad, lote.provincia].filter(Boolean).join(', ') || '—'}</span>
                                            </td>
                                            {/* 9. Fecha — hidden en mobile/tablet */}
                                            <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-400">
                                                {formatFecha(lote.dia_hora_publicacion)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedLote && (
                <DetailPanel
                    isOpen={true}
                    onClose={() => setSelectedLote(null)}
                    title={`Publicación #${(selectedLote as any).id_lote || selectedLote.id}`}
                    subtitle={`${selectedLote.sociedad_vendedora} · ${selectedLote.categoria}`}
                >
                    <div className="space-y-6 mt-4 pb-12">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl min-w-0">
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest truncate">Cabezas</p>
                                <p className="text-lg font-black text-amber-900 mt-0.5 truncate">{(selectedLote.cabezas || 0).toLocaleString('es-AR')}</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl min-w-0">
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest truncate">Peso / Kg</p>
                                <p className="text-lg font-black text-amber-900 mt-0.5 truncate">{selectedLote.peso || '—'}</p>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl min-w-0">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest truncate">Ofertas recibidas</p>
                                <p className="text-lg font-black text-emerald-900 mt-0.5 truncate">{selectedLote.cant_ofertas || 0}</p>
                            </div>
                        </div>

                        {/* Operadores */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border border-gray-100 rounded-xl p-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 border-b pb-1">Ubicación y Tiempo</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Publicado</span><span className="text-xs font-bold">{formatFecha(selectedLote.dia_hora_publicacion)}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Origen</span><span className="text-xs font-bold">{[selectedLote.localidad, selectedLote.provincia].filter(Boolean).join(', ') || '—'}</span></div>
                                </div>
                            </div>
                            <div className="border border-gray-100 rounded-xl p-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 border-b pb-1">Comercial</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Asoc. Comercial</span><span className="text-xs font-bold text-blue-700">{selectedLote.operador || '—'}</span></div>
                                                    {selectedLote.generado_por && selectedLote.generado_por !== selectedLote.operador && (
                                                        <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Operador</span><span className="text-xs font-bold">{selectedLote.generado_por}</span></div>
                                                    )}
                                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Representante</span><span className="text-xs font-bold">{selectedLote.representante || '—'}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Bidders Table */}
                        <div className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm mt-4">
                            <div className="bg-gray-50 border-b border-gray-100 p-3 flex justify-between items-center">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-600 flex items-center gap-2">
                                    <span className="text-blue-500">💬</span> Ofertantes ({ofertasMB2 ? ofertasMB2.length : (selectedLote.cant_ofertas || 0)})
                                </h4>
                            </div>
                            {loadingOfertas ? (
                                <div className="p-8 text-center text-sm font-bold text-gray-400 animate-pulse">
                                    Cargando ofertantes...
                                </div>
                            ) : (!ofertasMB2 || ofertasMB2.length === 0) ? (
                                <div className="p-8 text-center text-sm text-gray-400">
                                    Esta publicación no tiene ofertas registradas aún.
                                </div>
                            ) : (
                                <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto w-full">
                                    {ofertasMB2.map((of: any, idx: number) => (
                                        <li key={idx} className="flex justify-between items-center p-4 hover:bg-gray-50 transition-colors">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-gray-900">{of.soc_of || of.oferente || of.ofertante || of.ac_comprador || 'Desconocido'}</span>
                                                    {of.resp_oferta && of.resp_oferta !== 'Sin RESP' && (
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${of.resp_oferta === 'Oferta Aceptable' ? 'bg-emerald-100 text-emerald-700' : of.resp_oferta === 'Oferta Baja' || of.resp_oferta === 'Oferta Rechazada' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {of.resp_oferta}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-medium tracking-wide flex flex-wrap gap-x-1.5">
                                                    {(of.com_of !== undefined && of.com_of !== null) && <span>COM: {of.com_of}% &middot;</span>}
                                                    {of.tipo_flete && <span>Flete: {of.tipo_flete} &middot;</span>}
                                                    {of.tipo_precio && <span>({of.tipo_precio}) &middot;</span>}
                                                    {of.operador && <span className="text-blue-600 font-bold">AC: {of.operador} &middot;</span>}
                                                    {of.fecha_oferta && <span>{new Date(of.fecha_oferta).toLocaleDateString('es-AR', {day: '2-digit', month: '2-digit'})}</span>}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-mono text-emerald-600 font-black text-base leading-none">${of.precio_of || of.precio || of.monto || '-'}</span>
                                                    {of.precio_equivalente && <span className="text-[9px] text-gray-400 font-mono mt-0.5 hidden">Eq: ${Number(of.precio_equivalente).toFixed(0)}</span>}
                                                </div>
                                                <span className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">
                                                    {of.plazo_of ? `${of.plazo_of} días` : (of.plazo || of['of.plazo'] ? (String(of.plazo || of['of.plazo']).toLowerCase().includes('dia') || String(of.plazo || of['of.plazo']).toLowerCase().includes('día') ? (of.plazo || of['of.plazo']) : `${of.plazo || of['of.plazo']} días`) : 'Contado')}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </DetailPanel>
            )}
        </div>
    );
}
