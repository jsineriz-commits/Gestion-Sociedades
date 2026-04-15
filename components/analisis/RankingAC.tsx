'use client';

import { useState } from 'react';
import { TODOS_LOS_USUARIOS, AC_DIRECTA, AC_NOMBRES } from '@/lib/data/constants';



function getInitials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
function fmtMoney(n: number) {
    if (n === 0) return '$0';
    const abs = Math.abs(n), sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
    return `${sign}$${abs.toLocaleString('es-AR')}`;
}

interface PaletteEntry { avatar: string; bar: string; badge: string; }

interface OfficeRow {
    nombre: string; initials: string; palette: PaletteEntry; isDirecta: boolean;
    oficina?: string; canal?: string;
    negocios: number; cabezas: number; comoVend: number; comoComp: number; ambos: number;
    resultadoRegional: number; resultadoVend: number; resultadoComp: number;
    faena: number; invernada: number; invNeo: number; cria: number; mag: number;
    sociedadesUnicas: number;
    acsInvolucrados: Set<string>;
}

function computeStats(ops: any[], filterOficina?: string): OfficeRow[] {
    if (!ops.length) return [];

    // Si hay filtro de oficina, solo crear filas para ACs de esa oficina
    const allowedAcNames: Set<string> | null = filterOficina
        ? new Set(TODOS_LOS_USUARIOS.filter(u => u.oficina === filterOficina).map(u => u.nombre.toLowerCase()))
        : null;

    const COLORS = ["bg-[#3179a7]", "bg-indigo-600", "bg-emerald-600", "bg-rose-600", "bg-amber-500", "bg-violet-600", "bg-teal-600", "bg-cyan-600", "bg-pink-600", "bg-lime-600"];

    const acMap = new Map<string, any>();

    const getAcEntry = (acName: string) => {
        if (!acMap.has(acName)) {
            const idx = acMap.size;
            const p = COLORS[idx % COLORS.length];
            const pLight = p.replace(/-[0-9]+$/, '-50');
            const pText = p.replace('bg-', 'text-').replace(/-[0-9]+$/, '-700');
            const pRing = p.replace('bg-', 'ring-').replace(/-[0-9]+$/, '-200');
            const pBar = `from-${p.replace('bg-', '').replace(/-[0-9]+$/, '-500')} to-${p.replace('bg-', '').replace(/-[0-9]+$/, '-400')}`;

            const isDirecta = acName === 'Directa';
            // Buscar la oficina del AC en la lista de usuarios
            const acDef = isDirecta ? null : TODOS_LOS_USUARIOS.find(u => u.nombre.toLowerCase() === acName.toLowerCase());

            acMap.set(acName, {
                nombre: acName,
                oficina: isDirecta ? '' : (acDef?.oficina || ''),
                canal: isDirecta ? '' : (acDef?.canal || ''),
                initials: isDirecta ? 'DR' : getInitials(acName),
                palette: { avatar: p, bar: pBar, badge: `${pLight} ${pText} ${pRing}` },
                isDirecta,
                vendOps: [], compOps: [],
            });
        }
        return acMap.get(acName);
    };

    ops.forEach(o => {
        const vendName = (o.AC_Vend || '').trim();
        const compName = (o.AC_Comp || '').trim();

        // Verificar si el AC pertenece a la oficina filtrada (o si no hay filtro, aceptamos todos)
        const vendAllowed = vendName && (allowedAcNames === null || allowedAcNames.has(vendName.toLowerCase()));
        const compAllowed = compName && (allowedAcNames === null || allowedAcNames.has(compName.toLowerCase()));

        if (!vendAllowed && !compAllowed) {
            // Ninguno pertenece a la oficina → Directa
            getAcEntry('Directa').vendOps.push(o);
        } else {
            if (vendAllowed) getAcEntry(vendName).vendOps.push(o);
            if (compAllowed) getAcEntry(compName).compOps.push(o);
            // Si solo uno es allowed, la op igual se asocia al allowed AC
        }
    });

    const rows: OfficeRow[] = Array.from(acMap.values()).map(entry => {
        const { nombre, oficina, canal, initials, palette, isDirecta, vendOps, compOps } = entry;

        // Negocios únicos: cualquier op donde este AC estuvo involucrado
        const loteIds = new Set<number>([...vendOps.map((o: any) => o.id_lote), ...compOps.map((o: any) => o.id_lote)]);
        const opsUnicas = ops.filter(o => loteIds.has(o.id_lote));

        // Cabezas deduplicadas por id_lote
        const cbzMap = new Map<number, number>();
        opsUnicas.forEach(o => { if (!cbzMap.has(o.id_lote)) cbzMap.set(o.id_lote, o.Cabezas || 0); });

        // Ops donde aparece en AMBOS lados (vend Y comp)
        const compIds = new Set(compOps.map((o: any) => o.id_lote));
        const ambosIds = new Set(vendOps.filter((o: any) => compIds.has(o.id_lote)).map((o: any) => o.id_lote));

        const resultadoVend = vendOps.reduce((s: number, o: any) => s + (o.resultado_regional_vendedor || 0), 0);
        const resultadoComp = compOps.reduce((s: number, o: any) => s + (o.resultado_regional_comprador || 0), 0);

        const socSet = new Set<string>();
        opsUnicas.forEach(o => {
            if (o.RS_Vendedora) socSet.add(o.RS_Vendedora.trim());
            if (o.RS_Compradora) socSet.add(o.RS_Compradora.trim());
        });

        return {
            nombre, initials, palette, isDirecta, oficina, canal,
            negocios: loteIds.size,
            cabezas: Array.from(cbzMap.values()).reduce((s, c) => s + c, 0),
            comoVend: vendOps.length, comoComp: compOps.length, ambos: ambosIds.size,
            resultadoRegional: resultadoVend + resultadoComp, resultadoVend, resultadoComp,
            faena: opsUnicas.filter(o => { const u = (o.UN || '').toUpperCase(); return u === 'FAENA' || u === 'FAE'; }).length,
            invernada: opsUnicas.filter(o => { const u = (o.UN || '').toUpperCase(); return u === 'INVERNADA' || u === 'INV'; }).length,
            invNeo: opsUnicas.filter(o => (o.UN || '').toUpperCase() === 'INVERNADA NEO').length,
            cria: opsUnicas.filter(o => { const u = (o.UN || '').toUpperCase(); return u === 'CRÍA' || u === 'CRIA'; }).length,
            mag: opsUnicas.filter(o => (o.UN || '').toUpperCase() === 'MAG').length,
            sociedadesUnicas: socSet.size,
            acsInvolucrados: new Set<string>([nombre]),
        };
    });

    return rows;
}

interface Props { ops: any[]; filterOficina?: string; }

export default function RankingAC({ ops, filterOficina }: Props) {
    const [sortBy, setSortBy] = useState<'negocios' | 'cabezas' | 'resultado' | 'socs'>('negocios');

    const stats = computeStats(ops, filterOficina);
    const sorted = [...stats].sort((a, b) => {
        if (sortBy === 'negocios') return b.negocios - a.negocios;
        if (sortBy === 'cabezas') return b.cabezas - a.cabezas;
        if (sortBy === 'socs') return b.sociedadesUnicas - a.sociedadesUnicas;
        return b.resultadoRegional - a.resultadoRegional;
    });
    const maxRef = Math.max(...sorted.map(s =>
        sortBy === 'negocios' ? s.negocios : sortBy === 'cabezas' ? s.cabezas :
            sortBy === 'socs' ? s.sociedadesUnicas : Math.abs(s.resultadoRegional)
    ), 1);

    const totalNegocios = ops.length;
    const totalCabezas = stats.reduce((s, x) => s + x.cabezas, 0);
    const totalResReg = ops.reduce((s: number, o: any) => s + (o.resultado_regional_vendedor || 0) + (o.resultado_regional_comprador || 0), 0);
    const totalSocs = new Set(ops.flatMap(o => [o.RS_Vendedora, o.RS_Compradora].filter(Boolean).map((x: string) => x.trim()))).size;

    if (!ops.length) return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center text-gray-400 text-sm">
            Sin operaciones en el período.
        </div>
    );

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <span>🏆</span> Ranking por Comercial
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">{stats.length} Comerciales · Directa + ACs</p>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex gap-3">
                        {[
                            { label: totalNegocios.toLocaleString('es-AR'), sub: 'negs' },
                            { label: totalCabezas.toLocaleString('es-AR'), sub: 'cbzs' },
                            { label: totalSocs.toLocaleString('es-AR'), sub: 'socs únicas' },
                            ...(totalResReg !== 0 ? [{ label: fmtMoney(totalResReg), sub: 'res. reg.', color: totalResReg >= 0 ? 'text-emerald-600' : 'text-rose-600' }] : []),
                        ].map((item, i) => (
                            <div key={i} className="text-right">
                                <p className={`text-xs font-black ${'color' in item ? item.color : 'text-gray-900'}`}>{item.label}</p>
                                <p className="text-[9px] text-gray-400 uppercase">{item.sub}</p>
                            </div>
                        ))}
                    </div>
                    <div className="flex bg-gray-100 p-0.5 rounded-lg">
                        {(['negocios', 'cabezas', 'socs', 'resultado'] as const).map(k => (
                            <button key={k} onClick={() => setSortBy(k)}
                                className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all ${sortBy === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                                {k === 'resultado' ? '$' : k === 'negocios' ? 'Negs' : k === 'cabezas' ? 'Cbzs' : 'Socs'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Lista */}
            <div className="divide-y divide-gray-50">
                {sorted.map((ac, idx) => {
                    const refVal = sortBy === 'negocios' ? ac.negocios : sortBy === 'cabezas' ? ac.cabezas : sortBy === 'socs' ? ac.sociedadesUnicas : Math.abs(ac.resultadoRegional);
                    const barPct = maxRef > 0 ? (refVal / maxRef) * 100 : 0;
                    return (
                        <div key={ac.nombre} className="px-5 py-3 hover:bg-gray-50/60 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-shrink-0">
                                    <div className={`w-9 h-9 rounded-xl ${ac.palette.avatar} flex items-center justify-center text-white font-black text-[10px] shadow-sm`}>
                                        {ac.initials}
                                    </div>
                                    {idx < 3 && !ac.isDirecta && (
                                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 text-white text-[8px] font-black flex items-center justify-center shadow">
                                            {idx + 1}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-sm font-bold text-gray-900 truncate">
                                            {ac.nombre}
                                            {ac.isDirecta && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">DIRECTA</span>}
                                        </span>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-sm font-black text-gray-900">
                                                {sortBy === 'resultado' ? fmtMoney(ac.resultadoRegional) : sortBy === 'cabezas' ? ac.cabezas.toLocaleString('es-AR') : sortBy === 'socs' ? ac.sociedadesUnicas : ac.negocios}
                                            </p>
                                            <p className="text-[9px] text-gray-400">{sortBy === 'resultado' ? 'res. reg.' : sortBy === 'cabezas' ? 'cbzs' : sortBy === 'socs' ? 'socs' : ' negs'}</p>
                                        </div>
                                    </div>
                                    {!ac.isDirecta && (ac.oficina || ac.canal) && (
                                        <p className="text-[9px] text-gray-400 truncate w-full mb-1">
                                            {[ac.oficina, ac.canal].filter(Boolean).join(' · ')}
                                        </p>
                                    )}
                                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                                        <div className={`h-full bg-gradient-to-r ${ac.palette.bar} rounded-full transition-all duration-700`} style={{ width: `${barPct}%` }} />
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {!ac.isDirecta && ac.comoVend > 0 && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 ${ac.palette.badge}`}>V {ac.comoVend}</span>}
                                        {!ac.isDirecta && ac.comoComp > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 bg-gray-50 text-gray-600 ring-gray-200">C {ac.comoComp}</span>}
                                        {ac.ambos > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 bg-purple-50 text-purple-700 ring-purple-200">⇔ {ac.ambos}</span>}
                                        {ac.faena > 0 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#eaf2f6] text-[#3179a7] ring-1 ring-[#bfd5e4]">{ac.faena} Fae</span>}
                                        {ac.invernada > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">{ac.invernada} Inv</span>}
                                        {ac.mag > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 ring-1 ring-green-100">{ac.mag} MAG</span>}
                                        {ac.invNeo > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 ring-1 ring-orange-100">{ac.invNeo} Neo</span>}
                                        {ac.cria > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-50 text-yellow-600 ring-1 ring-yellow-100">{ac.cria} Cría</span>}
                                        {ac.sociedadesUnicas > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-600 ring-1 ring-gray-200">🏢 {ac.sociedadesUnicas} socs</span>}
                                        {ac.resultadoRegional !== 0 && (
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 ml-auto ${ac.resultadoRegional >= 0 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>
                                                {fmtMoney(ac.resultadoRegional)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
