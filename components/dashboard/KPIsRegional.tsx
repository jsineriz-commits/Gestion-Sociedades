'use client';

import React, { useState } from 'react';
import DetailPanel from '@/components/ui/DetailPanel';
import { UN_BG as UN_COLOR, UN_HEX, UN_LIST, normalizeUN } from '@/lib/utils/unColors';
import { normalizeEstado, ESTADO_CFG } from '@/lib/utils/estados';
import { COMPANY_ANUAL_TARGET, UN_TARGETS_ANUAL, resolveTarget } from '@/lib/data/targets';
import InfoTooltip from '@/components/ui/InfoTooltip';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('es-AR');
const fmtMoney = (n: number): string => {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000)     return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)         return `${sign}$${(abs / 1_000).toFixed(0)}k`;
    return `${sign}$${abs.toFixed(0)}`;
};

type MetricKey = 'ops' | 'cbzs' | 'ccc' | 'rend' | 'rendPct' | 'empresas' | 'precio' | 'caidas';

// ─── Nueva tabla de detalle estilo análisis ejecutivo ─────────────────────────
interface UNRowData {
    venta: number;
    compra: number;
    total: number;
    hasVenta?: boolean;
    hasCompra?: boolean;
    hasTotal?: boolean;
    motivos?: Record<string, { cbzs: number; ops: number }>;
    totalCbzs?: number;
    totalOps?: number;
    empresasVenta?: any[];
    empresasCompra?: any[];
    empresasTotal?: any[];
}
function pct(current: number, prev: number) {
    if (prev === 0 || !prev) return null;
    return ((current - prev) / Math.abs(prev)) * 100;
}

function VarBadge({ valCurrent, valPrev, isRate, isMoney }: { valCurrent: number, valPrev?: number, isRate?: boolean, isMoney?: boolean }) {
    if (valPrev === undefined || valPrev === 0 || isNaN(valPrev)) return <span className="text-xs text-gray-300 font-medium">=</span>;
    const delta = valCurrent - valPrev;
    const pctVal = isRate ? null : ((delta) / Math.abs(valPrev)) * 100;
    const pos = delta >= 0;
    
    const netStr = isRate
        ? `${pos ? '+' : ''}${delta.toFixed(1)}pp`
        : isMoney
        ? `${pos ? '+' : ''}${fmtMoney(delta)}`
        : `${pos ? '+' : ''}${Math.round(delta).toLocaleString('es-AR')}`;

    const pctStr = pctVal !== null ? `${pos ? '+' : ''}${pctVal.toFixed(1)}%` : '';
    
    const mainStr = pctStr || netStr;
    const detailStr = pctStr ? `${netStr} (${pctStr})` : netStr;

    return (
        <span className="group relative cursor-help inline-block">
            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border border-transparent ${pos ? 'bg-emerald-100 text-emerald-700 hover:border-emerald-300' : 'bg-rose-100 text-rose-600 hover:border-rose-300'} transition-colors`}>
                {mainStr}
            </span>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-bold py-1 px-2 rounded pointer-events-none whitespace-nowrap z-50 shadow-lg transition-opacity duration-200">
                Dif: {detailStr}
            </div>
        </span>
    );
}

function buildUNRows(
    ops: any[],
    metric: MetricKey,
    sideField: { venta: string; compra: string } | null,
    cbzsField: string = 'Cabezas',
    ventaFilter = (o: any) => o.AC_Vend && String(o.AC_Vend).trim() !== '',
    compraFilter = (o: any) => o.AC_Comp && String(o.AC_Comp).trim() !== '',
): Record<string, UNRowData> {
    const result: Record<string, UNRowData> = {};

    UN_LIST.forEach(un => {
        const unOps = ops.filter((o: any) => normalizeUN(o.UN || o.Tipo || '') === un);
        if (unOps.length === 0) return;

        const computeVal = (list: any[], side: 'venta' | 'compra' | 'total'): number => {
            if (metric === 'cbzs') {
                // TOTAL: suma directa de ALL ops de la UN (sin duplicar)
                // VENTA/COMPRA: son breakdown informativos del mismo total
                return list.reduce((s, o) => s + (Number(o[cbzsField]) || 0), 0);
            }
            if (metric === 'ops') {
                return list.length;
            }
            if (metric === 'empresas') {
                return new Set(list.map(o => {
                    if (side === 'venta') return (o.RS_Vendedora || '').trim();
                    if (side === 'compra') return (o.RS_Compradora || '').trim();
                    return (o.RS_Vendedora || o.RS_Compradora || '').trim();
                }).filter(Boolean)).size;
            }
            if (metric === 'rend') {
                // Prorrateo: si la op tiene AMBOS lados → venta=2/3, compra=1/3
                //           si solo un lado → ese lado obtiene el total
                // Total: suma resultado_final directo (sin split)
                return list.reduce((s, o) => {
                    const res = Number(o.resultado_final) || 0;
                    const hasV = ventaFilter(o);
                    const hasC = compraFilter(o);
                    if (side === 'total') return s + res;
                    if (side === 'venta') return s + res * (hasC ? 2/3 : 1);
                    if (side === 'compra') return s + res * (hasV ? 1/3 : 1);
                    return s;
                }, 0);
            }
            if (metric === 'precio') {
                // Precio = importe_vendedor total / cabezas (solo ops con importe > 0)
                const ventaList = list.filter(o => (o.importe_vendedor || 0) > 0);
                const imp = ventaList.reduce((s, o) => s + (o.importe_vendedor || 0), 0);
                const cab = ventaList.reduce((s, o) => s + (Number(o[cbzsField]) || 0), 0);
                return cab > 0 ? imp / cab : 0;
            }
            if (metric === 'rendPct') {
                const conRendimiento = list.filter(o => o.rendimiento !== undefined && o.rendimiento !== null && Number(o.rendimiento) > 0);
                if (conRendimiento.length > 0) {
                    const sumProd = conRendimiento.reduce((s, o) => s + (Number(o.rendimiento) || 0) * (Number(o[cbzsField]) || 0), 0);
                    const cab = conRendimiento.reduce((s, o) => s + (Number(o[cbzsField]) || 0), 0);
                    // rendimiento ya viene como porcentaje directo, NO multiplicar por 100
                    return cab > 0 ? sumProd / cab : 0;
                }
                const res = list.reduce((s, o) => {
                    if (side === 'venta') return s + (o[sideField?.venta || 'resultado_regional_vendedor'] || 0);
                    if (side === 'compra') return s + (o[sideField?.compra || 'resultado_regional_comprador'] || 0);
                    return s + (o[sideField?.venta || 'resultado_regional_vendedor'] || 0) + (o[sideField?.compra || 'resultado_regional_comprador'] || 0);
                }, 0);
                const base = list.reduce((s, o) => {
                    if (side === 'venta') return s + (o[sideField?.venta || 'importe_vendedor'] || 0);
                    if (side === 'compra') return s + (o[sideField?.compra || 'importe_comprador'] || 0);
                    return s + (o[sideField?.venta || 'importe_vendedor'] || 0) + (o[sideField?.compra || 'importe_comprador'] || 0);
                }, 0);
                return base > 0 ? (res / base) * 100 : 0;
            }
            if (metric === 'ccc') {
                const conc = list.filter(o => (o.estado_general || '').toUpperCase() === 'CONCRETADA').length;
                return list.length > 0 ? (conc / list.length) * 100 : 0;
            }
            return 0;
        };

        const ventaOps = unOps.filter(ventaFilter);
        const compraOps = unOps.filter(compraFilter);

        // Para cbzs: total es la UN completa (sin duplicar), venta/compra son desglose informativo
        const resultData: UNRowData = {
            venta: metric === 'cbzs' ? computeVal(ventaOps, 'venta') : computeVal(ventaOps, 'venta'),
            compra: metric === 'ccc' ? 0 : (metric === 'cbzs' ? computeVal(compraOps, 'compra') : computeVal(compraOps, 'compra')),
            total: metric === 'ccc' ? computeVal(ventaOps, 'venta') : computeVal(unOps, 'total'),
            hasVenta: ventaOps.length > 0,
            hasCompra: compraOps.length > 0,
            hasTotal: unOps.length > 0,
        };

        if (metric === 'empresas') {
            resultData.empresasVenta = Array.from(new Map(
                ventaOps.map(o => (o.RS_Vendedora || '').trim()).filter(Boolean).map(rs => [rs, ventaOps.find(o => o.RS_Vendedora === rs)])
            ).values());
            resultData.empresasCompra = Array.from(new Map(
                compraOps.map(o => (o.RS_Compradora || '').trim()).filter(Boolean).map(rs => [rs, compraOps.find(o => o.RS_Compradora === rs)])
            ).values());
        }

        result[un] = resultData;
    });
    return result;
}

function fmtMetric(v: number, metric: MetricKey): string {
    if (metric === 'cbzs' || metric === 'ops') return fmt(Math.round(v));
    if (metric === 'empresas') return fmt(Math.round(v));
    if (metric === 'ccc' || metric === 'rendPct') return `${v.toFixed(1)}%`;
    if (metric === 'rend' || metric === 'precio') return fmtMoney(v);
    return fmt(Math.round(v));
}

function AnalisisTable({
    title,
    ops,
    prevMoM,
    prevYoY,
    metric,
    selectedMes,
    acFilter,
}: {
    title: string;
    ops: any[];
    prevMoM: any[];
    prevYoY: any[];
    metric: MetricKey;
    selectedMes: number;
    acFilter?: string | null;
    isUnfilteredCompanyView?: boolean;
}) {
    const [expandedUn, setExpandedUn] = useState<{un: string, side: 'venta'|'compra'|'total'} | null>(null);

    const vFilter = (o: any) => {
        if (acFilter) {
            const ac = acFilter.toLowerCase().split(' ')[0].trim();
            return (o.AC_Vend || '').toLowerCase().includes(ac) || (o.repre_vendedor || '').toLowerCase().includes(ac);
        }
        return o.AC_Vend && String(o.AC_Vend).trim() !== '';
    };

    const cFilter = (o: any) => {
        if (acFilter) {
            const ac = acFilter.toLowerCase().split(' ')[0].trim();
            return (o.AC_Comp || '').toLowerCase().includes(ac) || (o.repre_comprador || '').toLowerCase().includes(ac);
        }
        return o.AC_Comp && String(o.AC_Comp).trim() !== '';
    };

    const rows = buildUNRows(ops, metric, null, 'Cabezas', vFilter, cFilter);
    const rowsMoM = buildUNRows(prevMoM, metric, null, 'Cabezas', vFilter, cFilter);
    const rowsYoY = buildUNRows(prevYoY, metric, null, 'Cabezas', vFilter, cFilter);

    const activatedUNs = UN_LIST.filter(un => rows[un]);

    // Métricas que NO se pueden sumar (son promedios/proporciones)
    const isRatioMetric = metric === 'precio' || metric === 'ccc' || metric === 'rendPct';

    // Para métricas de ratio: calcular el global ponderado real en lugar de sumar valores por UN
    const computeGlobalWeighted = (opsList: any[], side: 'venta' | 'compra' | 'total' = 'total'): number => {
        if (metric === 'ccc') {
            if (side === 'compra') return 0; // CCC no aplica desglose a compradores visualmente
            const qualifying = opsList.filter(vFilter).filter((o: any) => {
                const eg = (o.estado_general || '').toUpperCase();
                const et = (o.estado_tropas || '').trim().toLowerCase();
                if ((eg === 'NO CONCRETADAS' || eg === 'NO CONCRETADA' || eg === 'ANULADA') && et === 'no la comercializo') return false;
                return true;
            });
            const conc = qualifying.filter((o: any) => (o.estado_general || '').toUpperCase() === 'CONCRETADA').reduce((s:number, o:any)=>s+(Number(o.Cabezas)||0),0);
            const total = qualifying.reduce((s:number, o:any)=>s+(Number(o.Cabezas)||0),0);
            return total > 0 ? (conc / total) * 100 : 0;
        }
        if (metric === 'rendPct') {
            const conRend = opsList.filter(o => o.rendimiento !== undefined && o.rendimiento !== null && Number(o.rendimiento) > 0);
            if (conRend.length > 0) {
                const sumProd = conRend.reduce((s, o) => s + (Number(o.rendimiento) || 0) * (Number(o.Cabezas) || 0), 0);
                const cab = conRend.reduce((s, o) => s + (Number(o.Cabezas) || 0), 0);
                // rendimiento ya viene como porcentaje directo (ej: 3.97 = 3.97%), NO multiplicar por 100
                return cab > 0 ? sumProd / cab : 0;
            }
            const res = opsList.reduce((s: number, o: any) => {
                if (side === 'venta') return s + (o.resultado_regional_vendedor || 0);
                if (side === 'compra') return s + (o.resultado_regional_comprador || 0);
                return s + (o.resultado_regional_vendedor || 0) + (o.resultado_regional_comprador || 0);
            }, 0);
            const base = opsList.reduce((s: number, o: any) => {
                if (side === 'venta') return s + (o.importe_vendedor || 0);
                if (side === 'compra') return s + (o.importe_comprador || 0);
                return s + (o.importe_vendedor || 0) + (o.importe_comprador || 0);
            }, 0);
            return base > 0 ? (res / base) * 100 : 0;
        }
        if (metric === 'rend') {
            // Suma con prorrateo usando vFilter/cFilter del scope de AnalisisTable
            return opsList.reduce((s: number, o: any) => {
                const res = Number(o.resultado_final) || 0;
                const isV = vFilter(o);
                const isC = cFilter(o);
                if (side === 'total') return s + res;
                if (side === 'venta') return s + res * (isC ? 2/3 : 1);
                if (side === 'compra') return s + res * (isV ? 1/3 : 1);
                return s;
            }, 0);
        }
        if (metric === 'precio') {
            const ventaList = opsList.filter((o: any) => (o.importe_vendedor || 0) > 0);
            const imp = ventaList.reduce((s: number, o: any) => s + (o.importe_vendedor || 0), 0);
            const cab = ventaList.reduce((s: number, o: any) => s + (Number(o.Cabezas) || 0), 0);
            return cab > 0 ? imp / cab : 0;
        }
        // Métricas aditivas (cbzs, ops): suma directa desde opsList (NO usar rows cacheados del período actual)
        if (metric === 'cbzs') {
            return opsList.reduce((s: number, o: any) => s + (Number(o.Cabezas) || 0), 0);
        }
        if (metric === 'ops') {
            return opsList.length;
        }
        if (metric === 'empresas') {
            // Para empresas: deduplicar sociedades del período correcto
            return new Set(opsList.map((o: any) => (o.RS_Vendedora || '').trim()).filter(Boolean)).size;
        }
        return opsList.reduce((s: number, o: any) => s + (Number(o.Cabezas) || 0), 0);
    };

    // Para el footer: venta/compra son desglose informativo (para cbzs el total es la fuente de verdad)
    const computeGlobalSide = (opsList: any[], side: 'venta' | 'compra'): number => {
        if (metric === 'ccc' && side === 'compra') return 0;
        if (!isRatioMetric) {
            // Para cbzs: filtrar las ops del lado y sumar cabezas (desglose informativo)
            if (metric === 'cbzs') {
                const sideFilter = side === 'venta' ? vFilter : cFilter;
                return opsList.filter(sideFilter).reduce((s: number, o: any) => s + (Number(o.Cabezas) || 0), 0);
            }
            if (metric === 'ops') {
                const sideFilter = side === 'venta' ? vFilter : cFilter;
                return opsList.filter(sideFilter).length;
            }
            return activatedUNs.reduce((s, un) => s + (buildUNRows(opsList, metric, null)[un]?.[side] || 0), 0);
        }
        const sideOps = opsList.filter((o: any) =>
            side === 'venta'
                ? o.AC_Vend && String(o.AC_Vend).trim() !== ''
                : o.AC_Comp && String(o.AC_Comp).trim() !== ''
        );
        return computeGlobalWeighted(sideOps, side);
    };

    const totalTotal   = computeGlobalWeighted(ops);
    const totalVenta   = computeGlobalSide(ops, 'venta');
    const totalCompra  = computeGlobalSide(ops, 'compra');


    const prevMoMTotal  = computeGlobalWeighted(prevMoM);
    const prevYoYTotal  = computeGlobalWeighted(prevYoY);

    const isDesglosable = metric === 'cbzs' || metric === 'ops' || metric === 'rend';
    // Mostrar split V/C solo cuando hay un comercial específico seleccionado
    const showSplit = !!acFilter && !(acFilter ? acFilter.toLowerCase().startsWith('oficina') : false);


    return (
        <div>
            {/* ─── Layout Mobile: cards apiladas ─── */}
            <div className="flex flex-col gap-2 sm:hidden">
                {activatedUNs.map(un => {
                    const r = rows[un];
                    const rm = rowsMoM[un];
                    const ry = rowsYoY[un];
                    const hex = UN_HEX[un] || '#9CA3AF';
                    return (
                        <div key={un} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Header de la UN */}
                            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: hex}} />
                                    <span className="text-sm font-black text-gray-800">{un}</span>
                                </div>
                                <span className="text-lg font-black text-gray-900">{fmtMetric(r.total, metric)}</span>
                            </div>
                            {/* Desglose V/C + variaciones */}
                            <div className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 items-center">
                                {showSplit && isDesglosable && r.hasVenta && (
                                    <span className="text-[11px] text-gray-500">
                                        <span className="font-bold text-[#3179a7]">V</span> {fmtMetric(r.venta, metric)}
                                    </span>
                                )}
                                {showSplit && isDesglosable && r.hasCompra && (
                                    <span className="text-[11px] text-gray-500">
                                        <span className="font-bold text-emerald-500">C</span> {fmtMetric(r.compra, metric)}
                                    </span>
                                )}
                                <div className="ml-auto flex items-center gap-2">
                                    {selectedMes !== 0 && <VarBadge valCurrent={r.total} valPrev={rm?.total || 0} isRate={metric === 'ccc' || metric === 'rendPct'} isMoney={metric === 'rend' || metric === 'precio'} />}
                                    <VarBadge valCurrent={r.total} valPrev={ry?.total || 0} isRate={metric === 'ccc' || metric === 'rendPct'} isMoney={metric === 'rend' || metric === 'precio'} />
                                </div>
                            </div>
                            {/* Panel de empresas expandible en mobile */}
                            {expandedUn?.un === un && metric === 'empresas' && (
                                <div className="px-4 py-3 bg-slate-50 border-t border-gray-100">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                                        {expandedUn.side === 'venta' ? 'Vendedoras' : expandedUn.side === 'compra' ? 'Compradoras' : 'Involucradas'}
                                    </p>
                                    <div className="flex flex-col gap-1.5">
                                        {(expandedUn.side === 'venta' ? r.empresasVenta : expandedUn.side === 'compra' ? r.empresasCompra : [...(r.empresasVenta||[]), ...(r.empresasCompra||[])])?.filter(Boolean)?.map((e: any, idx: number) => {
                                            const side = expandedUn.side;
                                            const nombre = side === 'venta' ? e.RS_Vendedora : side === 'compra' ? e.RS_Compradora : (e.RS_Vendedora || e.RS_Compradora);
                                            const cuit = side === 'venta' ? e.cuit_vend : side === 'compra' ? e.cuit_comp : (e.cuit_vend || e.cuit_comp);
                                            return (
                                                <div key={idx} className="bg-white px-3 py-2 rounded-xl border border-slate-200 flex flex-col shadow-sm">
                                                    <span className="text-[11px] font-bold text-slate-800">{nombre || 'Sin Razón Social'}</span>
                                                    <span className="text-[10px] text-slate-400">CUIT: {cuit || 'S/D'}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {/* Footer mobile */}
                <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between">
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Consolidado</p>
                        {showSplit && isDesglosable && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                {totalVenta > 0 && <span className="text-blue-300 font-bold">V {fmtMetric(totalVenta, metric)}</span>}
                                {totalVenta > 0 && totalCompra > 0 && <span className="text-slate-600 mx-1">·</span>}
                                {totalCompra > 0 && <span className="text-emerald-300 font-bold">C {fmtMetric(totalCompra, metric)}</span>}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-xl font-black text-white">{fmtMetric(totalTotal, metric)}</span>
                        <div className="flex gap-1.5">
                            {selectedMes !== 0 && <VarBadge valCurrent={totalTotal} valPrev={prevMoMTotal} isRate={metric === 'ccc' || metric === 'rendPct'} isMoney={metric === 'rend' || metric === 'precio'} />}
                            <VarBadge valCurrent={totalTotal} valPrev={prevYoYTotal} isRate={metric === 'ccc' || metric === 'rendPct'} isMoney={metric === 'rend' || metric === 'precio'} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Layout Desktop: tabla ─── */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full min-w-[520px] border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Unidad de Negocio</th>
                            {showSplit && <th className="px-4 py-3 text-center text-[10px] font-semibold text-[#3179a7] uppercase tracking-wider">Venta</th>}
                            {showSplit && <th className="px-4 py-3 text-center text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Compra</th>}
                            <th className="px-4 py-3 text-center text-[10px] font-semibold text-[#235677] uppercase tracking-wider">Total</th>
                            <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Var vs Mes</th>
                            <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Var vs Año</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {activatedUNs.map(un => {
                            const r = rows[un];
                            const rm = rowsMoM[un];
                            const ry = rowsYoY[un];
                            const hex = UN_HEX[un] || '#9CA3AF';
                            return (
                                <React.Fragment key={un}>
                                <tr className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor: hex}} />
                                            <span className="text-sm font-semibold text-gray-700">{un}</span>
                                        </div>
                                    </td>
                                    {showSplit && (
                                        <td className="px-4 py-3.5 text-center text-sm text-gray-500">
                                            {metric === 'empresas' && r.hasVenta ? (
                                                <button onClick={() => setExpandedUn(expandedUn?.un === un && expandedUn.side === 'venta' ? null : { un, side: 'venta' })} className="hover:text-blue-600 underline decoration-dashed underline-offset-4 focus:outline-none">
                                                    {fmtMetric(r.venta, metric)}
                                                </button>
                                            ) : r.hasVenta ? fmtMetric(r.venta, metric) : <span className="text-gray-200">—</span>}
                                        </td>
                                    )}
                                    {showSplit && (
                                        <td className="px-4 py-3.5 text-center text-sm text-gray-500">
                                            {metric === 'empresas' && r.hasCompra ? (
                                                <button onClick={() => setExpandedUn(expandedUn?.un === un && expandedUn.side === 'compra' ? null : { un, side: 'compra' })} className="hover:text-blue-600 underline decoration-dashed underline-offset-4 focus:outline-none">
                                                    {fmtMetric(r.compra, metric)}
                                                </button>
                                            ) : r.hasCompra ? fmtMetric(r.compra, metric) : <span className="text-gray-200">—</span>}
                                        </td>
                                    )}
                                    <td className="px-4 py-3.5 text-center">
                                        {metric === 'empresas' && r.total > 0 ? (
                                            <button onClick={() => setExpandedUn(expandedUn?.un === un && expandedUn.side === 'total' ? null : { un, side: 'total' })} className="text-base tracking-tight font-black text-gray-900 hover:text-blue-600 underline decoration-dashed underline-offset-4 focus:outline-none">
                                                {fmtMetric(r.total, metric)}
                                            </button>
                                        ) : <span className="text-base font-black text-gray-900">{fmtMetric(r.total, metric)}</span>}
                                    </td>
                                    <td className="px-4 py-3.5 text-center">
                                        {selectedMes === 0 ? <span className="text-gray-300 font-black">-</span> : <VarBadge valCurrent={r.total} valPrev={rm?.total || 0} isRate={metric === 'ccc' || metric === 'rendPct'} isMoney={metric === 'rend' || metric === 'precio'} />}
                                    </td>
                                    <td className="px-4 py-3.5 text-center">
                                        <VarBadge valCurrent={r.total} valPrev={ry?.total || 0} isRate={metric === 'ccc' || metric === 'rendPct'} isMoney={metric === 'rend' || metric === 'precio'} />
                                    </td>
                                </tr>
                                {expandedUn?.un === un && metric === 'empresas' && (
                                    <tr className="bg-slate-50 border-b border-gray-100">
                                        <td colSpan={showSplit ? 6 : 4} className="px-6 py-4">
                                            <div className="flex flex-col gap-3">
                                                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                                    Detalle de Sociedades {expandedUn.side === 'venta' ? 'Vendedoras' : expandedUn.side === 'compra' ? 'Compradoras' : 'Involucradas'} ({un})
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {(expandedUn.side === 'venta' ? r.empresasVenta : expandedUn.side === 'compra' ? r.empresasCompra : [...(r.empresasVenta||[]), ...(r.empresasCompra||[])])?.filter(Boolean)?.map((e: any, idx: number) => {
                                                        const side = expandedUn.side;
                                                        const nombre = side === 'venta' ? e.RS_Vendedora : side === 'compra' ? e.RS_Compradora : (e.RS_Vendedora || e.RS_Compradora);
                                                        const cuit = side === 'venta' ? e.cuit_vend : side === 'compra' ? e.cuit_comp : (e.cuit_vend || e.cuit_comp);
                                                        return (
                                                            <div key={idx} className="bg-white px-3 py-2.5 rounded-xl border border-slate-200 flex flex-col shadow-sm gap-0.5">
                                                                <span className="text-[11px] font-bold text-slate-800 line-clamp-1 break-all" title={nombre}>
                                                                    {nombre || 'Sin Razón Social'}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                                                                    CUIT: {cuit || 'S/D'}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-800">
                            <td className="px-4 py-3 text-left text-[11px] font-black text-white uppercase tracking-wider rounded-bl-xl">Total Consolidado</td>
                            {showSplit && (
                                <td className="px-4 py-3 text-center text-sm font-bold text-[#bfd5e4]">
                                    {totalVenta > 0 ? fmtMetric(totalVenta, metric) : <span className="text-slate-600">—</span>}
                                </td>
                            )}
                            {showSplit && (
                                <td className="px-4 py-3 text-center text-sm font-bold text-emerald-300">
                                    {totalCompra > 0 ? fmtMetric(totalCompra, metric) : <span className="text-slate-600">—</span>}
                                </td>
                            )}
                            <td className="px-4 py-3 text-center">
                                <span className="text-lg font-black text-white">{fmtMetric(totalTotal, metric)}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                                {selectedMes === 0 ? <span className="text-slate-500 font-black">-</span> : <VarBadge valCurrent={totalTotal} valPrev={prevMoMTotal} isRate={metric === 'ccc' || metric === 'rendPct'} isMoney={metric === 'rend' || metric === 'precio'} />}
                            </td>
                            <td className="px-4 py-3 text-center rounded-br-xl">
                                <VarBadge valCurrent={totalTotal} valPrev={prevYoYTotal} isRate={metric === 'ccc' || metric === 'rendPct'} isMoney={metric === 'rend' || metric === 'precio'} />
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

function NoConcretadasTable({ title, icon, caidas }: { title: string; icon: string; caidas: any[] }) {
    if (caidas.length === 0) return <p className="text-gray-400 text-sm">No hay operaciones caídas en este período.</p>;

    // Group by UN then by Motivo
    const byUN: Record<string, { totalCbzs: number; totalOps: number; motivos: Record<string, { cbzs: number; ops: number }> }> = {};
    
    caidas.forEach(o => {
        const un = normalizeUN(o.UN || o.Tipo || '');
        if (!UN_LIST.includes(un)) return;
        
        // El motivo puede venir de diferentes campos dependiendo de la vista. Priorizamos: motivo > estado_general > Estado_Trop
        let motivoStr = (o.motivo || o.estado_general || o.Estado_Trop || 'Sin especificar');
        const motivo = (String(motivoStr).trim().charAt(0).toUpperCase() + String(motivoStr).trim().slice(1).toLowerCase());

        if (!byUN[un]) byUN[un] = { totalCbzs: 0, totalOps: 0, motivos: {} };
        if (!byUN[un].motivos[motivo]) byUN[un].motivos[motivo] = { cbzs: 0, ops: 0 };

        const cbzs = Number(o.Cabezas) || 0;
        byUN[un].totalCbzs += cbzs;
        byUN[un].totalOps += 1;
        byUN[un].motivos[motivo].cbzs += cbzs;
        byUN[un].motivos[motivo].ops += 1;
    });

    const activeUNs = UN_LIST.filter(un => byUN[un]);
    const grandTotalCbzs = activeUNs.reduce((s, un) => s + byUN[un].totalCbzs, 0);
    const grandTotalOps = activeUNs.reduce((s, un) => s + byUN[un].totalOps, 0);

    return (
        <div>
            
            <div className="space-y-4">
                {activeUNs.map(un => {
                    const data = byUN[un];
                    const hex = UN_HEX[un] || '#9CA3AF';
                    const motivosSorted = Object.entries(data.motivos).sort((a,b) => b[1].cbzs - a[1].cbzs);
                    
                    return (
                        <div key={un} className="rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm">
                            <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: hex}} />
                                    <span className="text-sm font-black text-gray-800 uppercase tracking-wide">{un}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-bold text-gray-900">{fmt(data.totalCbzs)} cab</span>
                                    <span className="text-xs text-gray-500 ml-1">({data.totalOps} ops)</span>
                                </div>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {motivosSorted.map(([m, stats]) => (
                                    <div key={m} className="px-4 py-2.5 flex justify-between items-center hover:bg-gray-50/50 transition-colors">
                                        <span className="text-[13px] text-gray-600 font-medium">{m}</span>
                                        <div className="flex gap-4 text-sm">
                                            <span className="text-gray-800 font-semibold">{fmt(stats.cbzs)} cab</span>
                                            <span className="text-gray-400 min-w-[40px] text-right">{stats.ops} op</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-6 bg-slate-800 rounded-xl px-4 py-3 flex justify-between items-center text-white">
                <span className="text-xs font-black uppercase tracking-wider">Total Caídas</span>
                <div className="text-right">
                    <span className="text-lg font-black">{fmt(grandTotalCbzs)} cab</span>
                    <span className="text-sm text-slate-300 ml-2">({grandTotalOps} ops)</span>
                </div>
            </div>
        </div>
    );
}

// ─── GridCard compacto con MoM + YoY inline (a la derecha) ──────────────────
interface GridCardProps {
    title: string;
    icon: string;
    val: number | string;
    unit?: string;
    isMoney?: boolean;
    isRate?: boolean;
    isNegative?: boolean;
    prevMoM?: number;
    prevYoY?: number;
    labelMoM?: string;
    labelYoY?: string;
    dashMoM?: boolean;
    onClick?: () => void;
    tooltip?: string;
}

function GridCard({ title, icon, val, unit, isMoney, isRate, isNegative, prevMoM, prevYoY, labelMoM, labelYoY, dashMoM, onClick, tooltip }: GridCardProps) {
    const numVal = typeof val === 'number' ? val : 0;

    const displayVal = typeof val === 'number'
        ? (isMoney ? fmtMoney(val) : val.toLocaleString('es-AR', { maximumFractionDigits: isRate ? 1 : 0 }))
        : val;

    function VarBadgeInline({ prev, label }: { prev?: number; label: string }) {
        if (prev === undefined || prev === 0 || isNaN(prev)) return null;
        const delta = numVal - prev;
        const pctVal = isRate ? null : (prev !== 0 ? (delta / Math.abs(prev)) * 100 : 0);
        const positive = delta >= 0;
        const good = isNegative ? !positive : positive;
        const arrow = good ? '▲' : '▼';
        const color = good ? 'text-emerald-600' : 'text-rose-500';

        const netStr = isRate
            ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}pp`
            : isMoney
            ? `${delta > 0 ? '+' : ''}${fmtMoney(delta)}`
            : `${delta > 0 ? '+' : ''}${Math.round(delta).toLocaleString('es-AR')}`;

        const pctStr = pctVal !== null ? `${pctVal > 0 ? '+' : ''}${pctVal.toFixed(1)}%` : '';

        const mainStr = pctStr || netStr;
        const detailStr = pctStr ? `${netStr} (${pctStr})` : netStr;

        return (
            <div className="text-right group relative cursor-help">
                <div className={`text-[12px] font-black ${color} leading-tight whitespace-nowrap`}>
                    {arrow} {mainStr}
                </div>
                <div className="text-[9px] text-gray-400 font-medium leading-tight whitespace-nowrap">{label}</div>
                {detailStr && (
                    <div className="absolute right-0 bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-bold py-1 px-2 rounded pointer-events-none whitespace-nowrap z-50 shadow-lg transition-opacity duration-200">
                        Dif: {detailStr} {unit && !pctStr ? ` ${unit}` : ''}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col p-4 lg:p-5 rounded-xl shadow-none transition-all duration-200 border border-[#ededed] bg-white hover:border-[#c0c0c0] hover:shadow-sm min-w-0 ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            {/* Header: title + icon */}
            <div className="flex justify-between items-start mb-2 gap-2 min-w-0">
                <div className="flex items-center min-w-0">
                    <h4 className="text-[11px] lg:text-xs font-semibold uppercase tracking-wider text-[#888888] truncate">{title}</h4>
                    {tooltip && <InfoTooltip text={tooltip} />}
                </div>
                <span className="text-lg opacity-80 shrink-0">{icon}</span>
            </div>
            {/* Body: value izquierda, badges derecha */}
            <div className="flex flex-wrap items-end justify-between gap-2 min-w-0">
                <div className="flex items-baseline gap-1 min-w-0">
                    <span className={`${isMoney ? 'text-xl md:text-2xl lg:text-3xl' : 'text-2xl md:text-3xl lg:text-4xl'} font-black tracking-tight text-[#555555] leading-none truncate max-w-full block`}>
                        {displayVal}
                    </span>
                    {isRate && <span className="text-lg text-gray-400 font-medium shrink-0">%</span>}
                    {unit && <span className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase tracking-widest shrink-0">{unit}</span>}
                </div>
                {/* Badges a la derecha */}
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-auto">
                    {dashMoM ? (
                        <div className="text-right">
                            <div className="text-[10px] font-black text-gray-300 leading-tight pr-1 whitespace-nowrap">-</div>
                            <div className="text-[9px] text-gray-400 font-medium leading-tight whitespace-nowrap">{labelMoM || 'vs mes'}</div>
                        </div>
                    ) : (
                        <VarBadgeInline prev={prevMoM} label={labelMoM || 'vs mes'} />
                    )}
                    <VarBadgeInline prev={prevYoY} label={labelYoY || 'vs año'} />
                    {(prevMoM === undefined || prevMoM === 0) && (prevYoY === undefined || prevYoY === 0) && !dashMoM && (
                        <span className="text-[9px] text-gray-300 font-semibold">{onClick ? '→' : '–'}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── CCC Meta ──────────────────────────────────────────────────────────────────
const CCC_META = 75; // Meta CCC %

// ─── Props ──────────────────────────────────────────────────────────────────
interface Props {
    lotes: any[];
    opsOficina: any[];
    opsPeriodoRaw: any[];
    totalOfertas: number;
    opsAll?: any[];
    selectedMes?: number;
    selectedYear?: number;
    compMode?: 'MoM' | 'YoY' | 'YTD';
    showBothSides?: boolean;
    acFilter?: string | null;
    filterCierre?: boolean;
    officeMemberNames?: string[]; // para calcular target de oficina automáticamente
}

interface PanelState {
    title: string;
    icon: string;
    metric: MetricKey;
    ops: any[];
    prevMoM: any[];
    prevYoY: any[];
}

// ─── Etiquetas dinámicas de período ─────────────────────────────────────────
function getMoMLabel(selectedMes: number, selectedYear: number): string {
    const today = new Date();
    let prevYear = selectedYear;
    let prevMes = selectedMes === 0 ? today.getMonth() : selectedMes - 1;
    if (prevMes < 1) { prevMes = 12; prevYear -= 1; }
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const yy = String(prevYear).slice(-2);
    return `vs ${meses[prevMes - 1]}'${yy}`;
}

function getYoYLabel(selectedMes: number, selectedYear: number): string {
    const prevYear = selectedYear - 1;
    const yy = String(prevYear).slice(-2);
    if (selectedMes === 0) return `vs YTD'${yy}`;
    const mes = selectedMes;
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `vs ${meses[mes - 1]}'${yy}`;
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function KPIsRegional({
    lotes,
    opsOficina,
    opsPeriodoRaw,
    totalOfertas,
    opsAll = [],
    selectedMes = 0,
    selectedYear = new Date().getFullYear(),
    compMode = 'YTD' as const,
    showBothSides = false,
    acFilter = null,
    filterCierre = false,
    officeMemberNames,
}: Props) {
    const [panel, setPanel] = useState<PanelState | null>(null);

    // ── Normalización ─────────────────────────────────────────────────────────
    const normOpsOficina = opsOficina.map(o => ({ ...o, UN: normalizeUN(o.UN || o.Tipo || '') }));
    const normOpsPeriodoRaw = opsPeriodoRaw.map(o => ({ ...o, UN: normalizeUN(o.UN || o.Tipo || '') }));
    const normOpsAll = opsAll.map(o => ({ ...o, UN: normalizeUN(o.UN || o.Tipo || '') }));

    const ops = normOpsOficina;

    // ── Date helper — debe estar definida ANTES de ser usada (opsParaCccBase) ──
    const parseDateLocal = (ds: string) => {
        if (!ds) return new Date(NaN);
        const p = ds.includes('T') ? ds.split('T')[0].split('-') : ds.split(' ')[0].split('-');
        return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0) : new Date(ds);
    };

    const concretadas = ops.filter((o: any) => (o.estado_general || '').toUpperCase() === 'CONCRETADA');

    
    const normStr = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const acFirstWord = acFilter ? normStr(acFilter).split(' ')[0] : null;

    // Para vistas de oficina el server ya devuelve solo las ops de esa oficina;
    // el match por 'acFirstWord = oficina' excluiría ops con ACs individuales (ej: 'Valentin Torriglia').
    const isOficinaView = acFilter ? normStr(acFilter).startsWith('oficina') : false;

    const isMiVenta = (o: any) => {
        if (!o.AC_Vend || String(o.AC_Vend).trim() === '') return false;
        if (!acFilter || isOficinaView) return true; // oficina: datos ya pre-filtrados
        return normStr(o.AC_Vend).includes(acFirstWord!);
    };
    const isMiCompra = (o: any) => {
        if (!o.AC_Comp || String(o.AC_Comp).trim() === '') return false;
        if (!acFilter || isOficinaView) return true; // oficina: datos ya pre-filtrados
        return normStr(o.AC_Comp).includes(acFirstWord!);
    };

    // ── KPIs ──────────────────────────────────────────────────────────────────

    const totalOps   = concretadas.length;
    const totalCbzs  = concretadas.reduce((s: number, o: any) => s + (Number(o.Cabezas) || 0), 0);
    const cbzsVenta  = concretadas.filter(isMiVenta).reduce((s, o) => s + (Number(o.Cabezas) || 0), 0);
    const cbzsCompra = concretadas.filter(isMiCompra).reduce((s, o) => s + (Number(o.Cabezas) || 0), 0);
    const opsVenta   = concretadas.filter(isMiVenta).length;
    const opsCompra  = concretadas.filter(isMiCompra).length;

    const sociedadesUnicas = new Set(concretadas.map((o: any) => (o.RS_Vendedora || '').trim()).filter(Boolean)).size;

    // CCC% — usa normOpsPeriodoRaw que ya viene SIN filtro de cierre desde DashboardClient
    // Así el CCC siempre refleja el período completo, independientemente del filtro CIERRE
    const opsParaCccBase = normOpsPeriodoRaw;


    const opsParaCcc = opsParaCccBase.filter((o: any) => {
        const eg = (o.estado_general || '').toUpperCase();
        const et = (o.estado_tropas || '').trim().toLowerCase();
        if ((eg === 'NO CONCRETADAS' || eg === 'NO CONCRETADA' || eg === 'ANULADA') && et === 'no la comercializo') return false;
        return (eg === 'CONCRETADA' || eg === 'NO CONCRETADAS' || eg === 'NO CONCRETADA' || eg === 'ANULADA') && isMiVenta(o);
    });
    const cccConcs = opsParaCcc.filter(o => (o.estado_general || '').toUpperCase() === 'CONCRETADA').length;
    const cccTotal = opsParaCcc.length;
    const ccc = cccTotal > 0 ? (cccConcs / cccTotal) * 100 : 100;

    // CCC por UN — también usa la base correcta
    const cccByUN = UN_LIST.map(un => {
        const concUN = opsParaCccBase.filter((o: any) => o.UN === un && (o.estado_general || '').toUpperCase() === 'CONCRETADA' && isMiVenta(o));
        const noConc  = opsParaCccBase.filter((o: any) => {
            const eg = (o.estado_general || '').toUpperCase();
            const et = (o.estado_tropas || '').trim().toLowerCase();
            if ((eg === 'NO CONCRETADAS' || eg === 'NO CONCRETADA' || eg === 'ANULADA') && et === 'no la comercializo') return false;
            return o.UN === un && (eg === 'NO CONCRETADAS' || eg === 'NO CONCRETADA' || eg === 'ANULADA') && isMiVenta(o);
        });
        const tot = concUN.length + noConc.length;
        if (tot === 0) return null;
        return { un, pct: (concUN.length / tot) * 100, color: UN_COLOR[un] || 'bg-gray-400', hex: UN_HEX[un] || '#9CA3AF' };
    }).filter(Boolean) as { un: string; pct: number; color: string; hex: string }[];

    // Resultado — usa resultado_final con prorrateo según filtro activo
    // Sin filtro (admin): suma todo resultado_final sin prorrateo (cada op es única)
    // Con filtro: aplica factor según si el filtro está en parte venta (2/3), compra (1/3) o ambas (1)
    const totalResultado = concretadas.reduce((s: number, o: any) => {
        const res = Number(o.resultado_final) || 0;
        // Admin sin filtro u Oficina: suma directa (datos ya pre-scoped al contexto)
        if (!acFilter || isOficinaView) return s + res;
        const isV = isMiVenta(o);
        const isC = isMiCompra(o);
        if (isV && isC) return s + res;
        if (isV)        return s + res * (2 / 3);
        if (isC)        return s + res * (1 / 3);
        return s;
    }, 0);

    // Precio/cab — solo parte vendedora
    const ventaOps     = concretadas.filter(isMiVenta);
    const sumImpVenta  = ventaOps.reduce((s: number, o: any) => s + (o.importe_vendedor || 0), 0);
    const cbzsVentaNum = ventaOps.reduce((s: number, o: any) => s + (Number(o.Cabezas) || 0), 0);
    const precioTotal  = cbzsVentaNum > 0 ? sumImpVenta / cbzsVentaNum : 0;

    // Rendimiento % — ponderado por cabezas usando condicion_rendimiento (campo 'rendimiento' en ops Q95)
    // Si hay ops con rendimiento negociado (ej: Faena), usa promedio ponderado real.
    // Si no, cae al ratio financiero resultado_final / (importe_vendedor + bonif_vend)
    const calcRendimiento = (opsList: any[]): number => {
        const conRend = opsList.filter((o: any) =>
            o.rendimiento !== undefined && o.rendimiento !== null && !isNaN(Number(o.rendimiento)) && Number(o.rendimiento) > 0
        );
        if (conRend.length > 0) {
            const sumProd = conRend.reduce((s: number, o: any) => s + (Number(o.rendimiento) || 0) * (Number(o.Cabezas) || 0), 0);
            const sumCab  = conRend.reduce((s: number, o: any) => s + (Number(o.Cabezas) || 0), 0);
            // rendimiento ya viene como porcentaje directo (ej: 3.97 = 3.97%), NO multiplicar por 100
            return sumCab > 0 ? sumProd / sumCab : 0;
        }
        // fallback financiero
        const cierre = opsList.filter((o: any) => o.Cierre === 1);
        const sumRes  = cierre.reduce((s: number, o: any) => s + (o.resultado_final  || 0), 0);
        const sumBase = cierre.reduce((s: number, o: any) => s + (o.importe_vendedor || 0) + (o.bonif_vend || 0), 0);
        return sumBase > 0 ? (sumRes / sumBase) * 100 : 0;
    };
    const rendimiento = calcRendimiento(concretadas);

    // ── Pipeline: todas las ops del período (no solo concretadas) ────────────────
    const pipeMap: Record<string, {ops: number; cbzs: number}> = {};
    // Inicializar con todos los estados conocidos
    Object.keys(ESTADO_CFG).forEach(k => { pipeMap[k] = { ops: 0, cbzs: 0 }; });

    // En admin sin filtro: incluir TODAS las ops. Con filtro de AC: solo sus ops.
    // Oficina: mostrar TODAS las ops pre-filtradas (isMiVenta ya devuelve true para cualquier op con AC)
    const pipeOps = !acFilter || isOficinaView
        ? normOpsPeriodoRaw
        : normOpsPeriodoRaw.filter((o: any) => isMiVenta(o) || isMiCompra(o));
    pipeOps.forEach((o: any) => {
        const estadoG = (o.estado_general || '').trim().toUpperCase();
        const estadoT = (o.estado_tropas || o.Estado_Trop || '').trim().toUpperCase();
        // Excluir 'No la comercializo' del pipeline
        if ((estadoG === 'NO CONCRETADAS' || estadoG === 'NO CONCRETADA' || estadoG === 'ANULADA') && estadoT.toLowerCase() === 'no la comercializo') return;
        const k = normalizeEstado(o.estado_tropas || o.Estado_Trop || o.estado_general || o.ESTADO || '');
        if (pipeMap[k]) {
            pipeMap[k].ops++;
            pipeMap[k].cbzs += Number(o.Cabezas) || 0;
        }
    });

    // Publicadas: lotes activos en el marketplace (fuente: lotes prop)
    const lotesActivos = lotes.filter((l: any) => l.estado === 'Publicado' || l.activo === true || l.publicado === true || (!l.estado && !l.cierre));
    const pubCbzs = lotesActivos.reduce((s: number, l: any) => s + (Number(l.cabezas_venta) || Number(l.cabezas) || 0), 0);
    if (pipeMap['Publicadas']) {
        pipeMap['Publicadas'].ops += lotesActivos.length;
        pipeMap['Publicadas'].cbzs += pubCbzs;
    }
    const pipelineTotalCbzs = Object.values(pipeMap).reduce((s, p) => s + p.cbzs, 0);

    // Ordenar por ESTADO_CFG.order y filtrar los que tienen datos
    const pipeRows = Object.entries(pipeMap)
        .filter(([, v]) => v.ops > 0)
        .sort(([a], [b]) => (ESTADO_CFG[a]?.order ?? 99) - (ESTADO_CFG[b]?.order ?? 99))
        .map(([label, v]) => ({ label, icon: ESTADO_CFG[label]?.icon || '📋', ...v }));

    // ── Períodos de comparación ──────────────────────────────────────────────
    // parseDateLocal ya definida arriba

    const soloConc = (o: any) => (o.estado_general || '').toUpperCase() === 'CONCRETADA';
    const today = new Date();

    const getMoM = (): any[] => {
        if (!normOpsAll.length) return [];
        let prevYear = selectedYear;
        let prevMes: number;
        if (selectedMes === 0) {
            // Todo el año: comparar contra el mes anterior al actual
            prevMes = today.getMonth(); // getMonth() es 0-based: si hoy es Marzo (2), devuelve 2 = Febrero (1-based)
            prevYear = selectedYear;
            if (prevMes < 1) { prevMes = 12; prevYear -= 1; }
        } else {
            prevMes = selectedMes - 1;
            if (prevMes < 1) { prevMes = 12; prevYear -= 1; }
        }
        // Para el cut de día: limitar al día de hoy solo si prevMes es el mes actual
        const isCurrentMonth = prevYear === today.getFullYear() && prevMes === today.getMonth() + 1;
        return normOpsAll.filter((o: any) => {
            if (!o.fecha_operacion || !soloConc(o)) return false;
            const d = parseDateLocal(o.fecha_operacion);
            if (isNaN(d.getTime()) || d.getFullYear() !== prevYear || (d.getMonth() + 1) !== prevMes) return false;
            if (isCurrentMonth && d.getDate() > today.getDate()) return false;
            return true;
        });
    };

    const getYoY = (): any[] => {
        if (!normOpsAll.length) return [];
        if (selectedMes === 0) {
            const prevYear = selectedYear - 1;
            const cutoff = new Date(prevYear, today.getMonth(), today.getDate(), 23, 59, 59);
            const start = new Date(prevYear, 0, 1);
            return normOpsAll.filter((o: any) => {
                if (!o.fecha_operacion || !soloConc(o)) return false;
                const d = parseDateLocal(o.fecha_operacion);
                return !isNaN(d.getTime()) && d >= start && d <= cutoff;
            });
        }
        const isCurrentMonth = selectedYear === today.getFullYear() && selectedMes === today.getMonth() + 1;
        return normOpsAll.filter((o: any) => {
            if (!o.fecha_operacion || !soloConc(o)) return false;
            const d = parseDateLocal(o.fecha_operacion);
            if (isNaN(d.getTime()) || d.getFullYear() !== (selectedYear - 1) || (d.getMonth() + 1) !== selectedMes) return false;
            if (isCurrentMonth && d.getDate() > today.getDate()) return false;
            return true;
        });
    };

    const prevMoM = getMoM();
    const prevYoY = getYoY();

    // Comparativos para dark card
    const prevMoMCbzs = prevMoM.reduce((s: number, o: any) => s + (Number(o.Cabezas) || 0), 0);
    const prevYoYCbzs = prevYoY.reduce((s: number, o: any) => s + (Number(o.Cabezas) || 0), 0);

    // Comparativos para mini cards
    const prevMoMSocs = new Set(prevMoM.map((o: any) => (o.RS_Vendedora || '').trim()).filter(Boolean)).size;
    const prevYoYSocs = new Set(prevYoY.map((o: any) => (o.RS_Vendedora || '').trim()).filter(Boolean)).size;

    const prevMoMResultV = prevMoM.filter((o: any) => o.AC_Vend && String(o.AC_Vend).trim() !== '').reduce((s: number, o: any) => s + (o.resultado_regional_vendedor || 0), 0);
    const prevMoMResultC = prevMoM.filter((o: any) => o.AC_Comp && String(o.AC_Comp).trim() !== '').reduce((s: number, o: any) => s + (o.resultado_regional_comprador || 0), 0);
    const prevMoMResult = prevMoMResultV + prevMoMResultC;

    const prevYoYResultV = prevYoY.filter((o: any) => o.AC_Vend && String(o.AC_Vend).trim() !== '').reduce((s: number, o: any) => s + (o.resultado_regional_vendedor || 0), 0);
    const prevYoYResultC = prevYoY.filter((o: any) => o.AC_Comp && String(o.AC_Comp).trim() !== '').reduce((s: number, o: any) => s + (o.resultado_regional_comprador || 0), 0);
    const prevYoYResult = prevYoYResultV + prevYoYResultC;

    const prevMoMRend = calcRendimiento(prevMoM.filter((o: any) => (o.estado_general || '').toUpperCase() === 'CONCRETADA'));
    const prevYoYRend = calcRendimiento(prevYoY.filter((o: any) => (o.estado_general || '').toUpperCase() === 'CONCRETADA'));

    // Precio/Cab comparativos — solo venta
    const calcPrecio = (list: any[]) => {
        const ventaList = list.filter((o: any) => (o.importe_vendedor || 0) > 0);
        const imp = ventaList.reduce((s: number, o: any) => s + (o.importe_vendedor || 0), 0);
        const cbz = ventaList.reduce((s: number, o: any) => s + (Number(o.Cabezas) || 0), 0);
        return cbz > 0 ? Math.round(imp / cbz) : 0;
    };
    const prevMoMPrecio = calcPrecio(prevMoM);
    const prevYoYPrecio = calcPrecio(prevYoY);

    // ── UN breakdown para dark card ───────────────────────────────────────────────
    const _oficinaNormKpi = acFilter ? normStr(acFilter) : '';
    const concByUN = UN_LIST.map(un => {
        const unOps = concretadas.filter((o: any) => o.UN === un);
        if (unOps.length === 0) return null;
        // Para oficinas: usar Oficina_Venta/Oficina_Compra para evitar doble conteo
        // cuando la oficina opera en ambos lados de la misma transacción
        const ventaUN  = isOficinaView
            ? unOps.filter((o: any) => normStr(o.Oficina_Venta || '') === _oficinaNormKpi)
            : unOps.filter((o: any) => o.AC_Vend && String(o.AC_Vend).trim() !== '');
        const compraUN = isOficinaView
            ? unOps.filter((o: any) => normStr(o.Oficina_Compra || '') === _oficinaNormKpi)
            : unOps.filter((o: any) => o.AC_Comp && String(o.AC_Comp).trim() !== '');
        const totalCbzs = unOps.reduce((s: number, o: any) => s + (Number(o.Cabezas) || 0), 0);
        const ventaCbzs  = ventaUN.reduce((s: number, o: any) => s + (Number(o.Cabezas) || 0), 0);
        const compraCbzs = compraUN.reduce((s: number, o: any) => s + (Number(o.Cabezas) || 0), 0);
        return { un, totalCbzs, ventaCbzs, compraCbzs, hex: UN_HEX[un] || '#9CA3AF' };
    }).filter(Boolean) as { un: string; totalCbzs: number; ventaCbzs: number; compraCbzs: number; hex: string }[];

    // ── Labels de período ─────────────────────────────────────────────────────
    const labelMoM = getMoMLabel(selectedMes, selectedYear);
    const labelYoY = getYoYLabel(selectedMes, selectedYear);

    // ── Ops ofrecidas para CCC (concretadas + no concretadas + anuladas) ────────
    const esOfrecida = (o: any) => {
        const eg = (o.estado_general || '').toUpperCase();
        return eg === 'CONCRETADA' || eg === 'NO CONCRETADAS' || eg === 'NO CONCRETADA' || eg === 'ANULADA';
    };

    const offeredOps = normOpsPeriodoRaw.filter(esOfrecida);
    // getMoM / getYoY sin filtro soloConc — para comparación de CCC
    const getMoMRaw = (): any[] => {
        if (!normOpsAll.length) return [];
        let prevYear = selectedYear;
        let prevMes = selectedMes - 1;
        if (selectedMes === 0) { prevMes = today.getMonth(); prevYear = selectedYear; }
        if (prevMes < 1) { prevMes = 12; prevYear -= 1; }
        const isCurrentMonth = selectedYear === today.getFullYear() && (selectedMes === 0 || selectedMes === today.getMonth() + 1);
        return normOpsAll.filter((o: any) => {
            if (!o.fecha_operacion || !esOfrecida(o)) return false;
            const d = parseDateLocal(o.fecha_operacion);
            if (isNaN(d.getTime()) || d.getFullYear() !== prevYear || (d.getMonth() + 1) !== prevMes) return false;
            if (isCurrentMonth && d.getDate() > today.getDate()) return false;
            return true;
        });
    };
    const getYoYRaw = (): any[] => {
        if (!normOpsAll.length) return [];
        if (selectedMes === 0) {
            const prevYear = selectedYear - 1;
            const cutoff = new Date(prevYear, today.getMonth(), today.getDate(), 23, 59, 59);
            const start = new Date(prevYear, 0, 1);
            return normOpsAll.filter((o: any) => {
                if (!o.fecha_operacion || !esOfrecida(o)) return false;
                const d = parseDateLocal(o.fecha_operacion);
                return !isNaN(d.getTime()) && d >= start && d <= cutoff;
            });
        }
        const isCurrentMonth = selectedYear === today.getFullYear() && selectedMes === today.getMonth() + 1;
        return normOpsAll.filter((o: any) => {
            if (!o.fecha_operacion || !esOfrecida(o)) return false;
            const d = parseDateLocal(o.fecha_operacion);
            if (isNaN(d.getTime()) || d.getFullYear() !== (selectedYear - 1) || (d.getMonth() + 1) !== selectedMes) return false;
            if (isCurrentMonth && d.getDate() > today.getDate()) return false;
            return true;
        });
    };

    // ── Abrir panel ───────────────────────────────────────────────────────────
    const openPanel = (
        metric: MetricKey,
        title: string,
        icon: string,
        opsOverride?: any[],
        prevMoMOverride?: any[],
        prevYoYOverride?: any[],
    ) => setPanel({
        title, icon, metric,
        ops:     opsOverride     ?? concretadas,
        prevMoM: prevMoMOverride ?? prevMoM,
        prevYoY: prevYoYOverride ?? prevYoY,
    });

    return (
        <>
            {/* ── Fila 1: 3 tarjetas principales (Volumen · Pipeline · Meta) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5 items-start">

                {/* CARD 1: Volumen Concretado (dark) */}
                <div
                    className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 lg:p-6 shadow-md cursor-pointer hover:from-slate-700 hover:to-slate-800 transition-all"
                    onClick={() => totalCbzs > 0 ? openPanel('cbzs', 'Volumen Concretado (Cabezas)', '🐄') : undefined}
                >
                    {/* Fila 1: título + Detalle → */}
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] lg:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-blue-400" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2h14v2H1V2Zm0 4h14v2H1V6Zm0 4h10v2H1v-2Z"/></svg>
                            VOLUMEN CONCRETADO
                        </span>
                        <span className="text-[9px] text-slate-600 font-medium">Detalle →</span>
                    </div>

                    {/* Fila 2: número grande (izq) + variaciones (der) */}
                    <div className="flex flex-wrap items-start md:items-baseline justify-between gap-2 md:gap-3 mb-2 min-w-0">
                        <div className="min-w-0 max-w-full">
                            <div className="flex items-baseline gap-2 min-w-0">
                                <span className="text-4xl md:text-5xl lg:text-5xl font-black text-white tracking-tighter whitespace-nowrap">{fmt(totalCbzs)}</span>
                                <span className="text-slate-400 text-[11px] lg:text-[10px] xl:text-[11px] font-bold uppercase tracking-wide leading-none shrink-0">CABEZAS</span>
                            </div>
                            <p className="text-slate-500 text-[10px] md:text-[11px] mt-1 whitespace-nowrap truncate max-w-full block">
                                {!acFilter || isOficinaView ? (
                                    <>
                                        <span className="text-slate-300 font-bold">{fmt(totalOps)}</span>
                                        {' '}<span className="text-slate-400">tropas</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-slate-300 font-bold">{fmt(totalOps)}</span> ops ·{' '}
                                        <span className="text-slate-400">{fmt(opsVenta)} venta</span> ·{' '}
                                        <span className="text-slate-400">{fmt(opsCompra)} compra</span>
                                    </>
                                )}
                            </p>
                        </div>
                        {/* Variaciones alineadas a la derecha */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {selectedMes === 0 ? (
                                <div className="flex flex-col items-end text-right text-[10px] font-black leading-tight text-slate-500">
                                    <span className="whitespace-nowrap pr-1">-</span>
                                    <span className="text-[9px] text-slate-600 font-medium whitespace-nowrap">{labelMoM}</span>
                                </div>
                            ) : prevMoMCbzs > 0 ? (
                                <div className={`flex flex-col items-end text-right text-[12px] font-black leading-tight whitespace-nowrap group relative cursor-help ${totalCbzs >= prevMoMCbzs ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    <span>{totalCbzs >= prevMoMCbzs ? '▲' : '▼'} {totalCbzs >= prevMoMCbzs ? '+' : ''}{((totalCbzs - prevMoMCbzs) / (prevMoMCbzs || 1) * 100).toFixed(1)}%</span>
                                    <span className="text-[9px] text-slate-500 font-medium whitespace-nowrap">{labelMoM}</span>
                                    <div className="absolute right-0 bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-900 text-slate-200 border border-slate-700 text-[10px] font-bold py-1 px-2 rounded pointer-events-none whitespace-nowrap z-50 shadow-lg transition-opacity duration-200">
                                        Dif: {totalCbzs >= prevMoMCbzs ? '+' : ''}{fmt(totalCbzs - prevMoMCbzs)} cab ({totalCbzs >= prevMoMCbzs ? '+' : ''}{((totalCbzs - prevMoMCbzs) / (prevMoMCbzs || 1) * 100).toFixed(1)}%)
                                    </div>
                                </div>
                            ) : null}
                            {prevYoYCbzs > 0 && (
                                <div className={`flex flex-col items-end text-right text-[12px] font-black leading-tight whitespace-nowrap group relative cursor-help ${totalCbzs >= prevYoYCbzs ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    <span>{totalCbzs >= prevYoYCbzs ? '▲' : '▼'} {totalCbzs >= prevYoYCbzs ? '+' : ''}{((totalCbzs - prevYoYCbzs) / (prevYoYCbzs || 1) * 100).toFixed(1)}%</span>
                                    <span className="text-[9px] text-slate-500 font-medium whitespace-nowrap">{labelYoY}</span>
                                    <div className="absolute right-0 bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-900 text-slate-200 border border-slate-700 text-[10px] font-bold py-1 px-2 rounded pointer-events-none whitespace-nowrap z-50 shadow-lg transition-opacity duration-200">
                                        Dif: {totalCbzs >= prevYoYCbzs ? '+' : ''}{fmt(totalCbzs - prevYoYCbzs)} cab ({totalCbzs >= prevYoYCbzs ? '+' : ''}{((totalCbzs - prevYoYCbzs) / (prevYoYCbzs || 1) * 100).toFixed(1)}%)
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Fila 3: UN breakdown + META */}
                    {concByUN.length > 0 && (
                        <div className="border-t border-slate-700 pt-2 space-y-1">
                            {concByUN.map(b => (
                                <div key={b.un} className="flex items-center gap-2">
                                    {/* Nombre */}
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: b.hex}} />
                                        <span className="text-[11px] text-slate-300 font-semibold truncate">{b.un}</span>
                                    </div>
                                    {/* V / C centrado */}
                                    {!!acFilter && !isOficinaView && (
                                        <span className="text-[9px] text-slate-500 font-medium text-center">
                                            {[b.ventaCbzs > 0 ? `V:${fmt(b.ventaCbzs)}` : null, b.compraCbzs > 0 ? `C:${fmt(b.compraCbzs)}` : null].filter(Boolean).join(' · ')}
                                        </span>
                                    )}
                                    {/* Total der */}
                                    <span className="text-[12px] text-slate-100 font-black flex-shrink-0">{fmt(b.totalCbzs)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                </div>

                {/* CARD 2: Pipeline de Concretadas */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                                <span>⏱</span> PIPELINE
                            </h4>
                            <InfoTooltip text="Reúne TODAS las operaciones vinculadas (tanto No Concretadas, Dadas de Baja y Publicadas) así como aquellas concretadas que siguen ciclo administrativo (a revisar, por liquidar, proformas...)." />
                        </div>
                        <span className="text-[10px] font-black text-gray-500">{fmt(pipelineTotalCbzs)} cab</span>
                    </div>
                    <div className="space-y-2">
                        {pipeRows.length > 0 ? pipeRows.map(p => (
                            <div key={p.label} className="flex items-center gap-2">
                                <span className="text-sm w-5 flex-shrink-0">{p.icon}</span>
                                <span className="text-[11px] text-gray-600 font-medium flex-1 truncate">{p.label}</span>
                                <span className="text-[10px] text-gray-400 flex-shrink-0">{fmt(p.cbzs)} cab</span>
                                <span className="text-sm font-black text-gray-800 w-8 text-right flex-shrink-0">{p.ops}</span>
                            </div>
                        )) : (
                            <p className="text-gray-300 text-sm text-center py-4">Sin datos</p>
                        )}
                    </div>
                </div>
                {/* CARD META: Donut chart de avance vs meta */}
                {(() => {
                    const indivMeta = resolveTarget(acFilter, showBothSides ?? false, selectedMes);
                    const globalMeta = selectedMes === 0 ? COMPANY_ANUAL_TARGET : Math.round(COMPANY_ANUAL_TARGET / 12);
                    const meta = indivMeta ?? globalMeta;
                    const pct = Math.min((totalCbzs / meta) * 100, 100);
                    const over = totalCbzs >= meta;

                    // SVG donut params
                    const r = 38, cx = 50, cy = 50;
                    const circ = 2 * Math.PI * r;
                    const offset = circ * (1 - pct / 100);
                    const color = over ? '#10b981' : '#22c55e';

                    // UN rows
                    const unMeta = !acFilter ? concByUN.map(b => {
                        const tAnual = UN_TARGETS_ANUAL[b.un] ?? 0;
                        const tPeriod = selectedMes === 0 ? tAnual : Math.round(tAnual / 12);
                        const p = tPeriod > 0 ? Math.min((b.totalCbzs / tPeriod) * 100, 100) : 0;
                        return { ...b, tPeriod, p, over: b.totalCbzs >= tPeriod };
                    }).filter(b => b.tPeriod > 0) : [];

                    return (
                        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col items-center justify-between gap-3">
                            <div className="w-full flex justify-between items-center">
                                <div className="flex items-center">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                                        <span>🎯</span> META
                                    </h4>
                                    <InfoTooltip text="Mide el progreso contra el objetivo comercial establecido de Volumen Concretado para la compañía o el individuo. Anual o Mensualizado." />
                                </div>
                                <span className="text-[9px] text-gray-400 font-medium">
                                    {selectedMes === 0 ? 'ANUAL' : 'MENSUAL'}
                                    {indivMeta && <span className="ml-1 opacity-70">· individual</span>}
                                </span>
                            </div>

                            {/* Contenido Principal */}
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 w-full h-full">
                                {/* Donut SVG y Fracción */}
                                <div className="flex flex-col items-center flex-shrink-0">
                                    <div className="relative flex items-center justify-center">
                                        <svg viewBox="0 0 100 100" width="110" height="110" className="-rotate-90">
                                            {/* Track */}
                                            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="11" />
                                            {/* Progress arc */}
                                            <circle
                                                cx={cx} cy={cy} r={r} fill="none"
                                                stroke={color}
                                                strokeWidth="11"
                                                strokeLinecap="round"
                                                strokeDasharray={circ}
                                                strokeDashoffset={offset}
                                                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                                            />
                                        </svg>
                                        {/* Centro */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className={`text-2xl font-black leading-none ${over ? 'text-emerald-600' : 'text-gray-800'}`}>
                                                {pct.toFixed(0)}%
                                            </span>
                                            <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">alcanzado</span>
                                        </div>
                                    </div>
                                    <p className="text-[12px] font-black text-gray-800 mt-2 leading-none">
                                        {fmt(totalCbzs)} <span className="text-gray-400 font-medium text-[10px]">/ {fmt(meta)} cab</span>
                                    </p>
                                </div>

                                {/* Textos / Métricas */}
                                <div className="flex flex-col text-center sm:text-left min-w-0 w-full sm:w-auto flex-1">
                                    
                                    {(() => {
                                        const hoy = new Date();
                                        const isPeriodoActivo = selectedYear === hoy.getFullYear() && (selectedMes === hoy.getMonth() + 1 || selectedMes === 0);
                                        
                                        if (!over) {
                                            if (isPeriodoActivo) {
                                                const missing = meta - totalCbzs;
                                                let weeksLeft = 1;
                                                if (selectedMes === 0) {
                                                    const daysLeft = (new Date(selectedYear, 11, 31).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
                                                    weeksLeft = Math.max(0.5, daysLeft / 7);
                                                } else {
                                                    const curMonth = hoy.getMonth();
                                                    const nextMonth = new Date(selectedYear, curMonth + 1, 1);
                                                    const daysLeft = (nextMonth.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
                                                    weeksLeft = Math.max(0.5, daysLeft / 7);
                                                }
                                                
                                                const cabezasPromedioPorTropa = concretadas.length > 0 ? totalCbzs / concretadas.length : 45;
                                                const totalCcc = offeredOps.length > 0 ? (concretadas.length / offeredOps.length) * 100 : 0;
                                                
                                                let cabezasPorSemana = 0;
                                                if (totalCcc > 0) cabezasPorSemana = Math.floor((missing / (totalCcc / 100)) / weeksLeft);
                                                else cabezasPorSemana = Math.floor(missing / weeksLeft);
                                                
                                                const tropasPorSemana = Math.max(1, Math.ceil(cabezasPorSemana / cabezasPromedioPorTropa));
                                                const accionStr = totalCcc > 0 ? 'Traer' : 'Concretar';

                                                return (
                                                    <div className="mt-2 flex flex-col gap-1.5 w-full bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                                                            ⏱️ Faltan {fmt(missing)} cab.
                                                        </span>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[10px] lg:text-[11px] font-medium text-slate-600">
                                                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></div>
                                                                <span>{accionStr} <span className="font-bold text-slate-800">{tropasPorSemana} {tropasPorSemana === 1 ? 'tropa' : 'tropas'}</span>/sem.</span>
                                                            </div>
                                                            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[10px] lg:text-[11px] font-medium text-slate-600">
                                                                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full flex-shrink-0"></div>
                                                                <span>Aprox. <span className="font-bold text-slate-800">{fmt(cabezasPorSemana)} cab</span>/sem.</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <p className="text-[9px] md:text-[10px] font-bold text-gray-400 mt-2 bg-gray-50 rounded py-1 px-2 border border-gray-200 uppercase">
                                                    No se alcanzó por {fmt(meta - totalCbzs)} cab
                                                </p>
                                            );
                                        } else {
                                            return (
                                                <p className="text-[10px] md:text-[11px] font-bold text-emerald-600 mt-2 bg-emerald-50 rounded py-1.5 px-2 border border-emerald-100 uppercase">
                                                    🏆 ¡Superaste en {fmt(totalCbzs - meta)} cab!
                                                </p>
                                            );
                                        }
                                    })()}
                                </div>
                            </div>
                        </div>
                    );
                })()}

            </div>

            {/* ── Fila 2: Concreción + 3 mini KPIs ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-5">
                {/* Concreción — sin desglose por UN */}
                <div
                    className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm cursor-pointer hover:border-gray-300 hover:shadow-md transition-all col-span-1"
                    onClick={() => {
                        const ofrecidas = normOpsPeriodoRaw.filter(esOfrecida);
                        if (ofrecidas.length > 0) openPanel('ccc', 'Concreción — Tropas Ofrecidas vs Concretadas', '🎯', ofrecidas, getMoMRaw(), getYoYRaw());
                    }}
                >
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">CONCRECIÓN</h4>
                            <InfoTooltip text="Mide el porcentaje de acierto comercial: del 100% de tropas y/o ofertas involucradas este mes, cuántas lograste concretar con éxito." />
                        </div>
                        <span className="text-base">🎯</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-1.5">
                        <span className="text-3xl font-black text-[#555555]">{(Math.round(ccc * 10) / 10).toLocaleString('es-AR')}</span>
                        <span className="text-lg text-gray-400 font-medium">%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                        <div className="h-full bg-[#3179a7] rounded-full transition-all duration-700" style={{width: `${Math.min(ccc, 100)}%`}} />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                        <span>{fmt(cccConcs)} conc.</span>
                        <span>{fmt(cccTotal)} tot.</span>
                    </div>
                    <p className="text-[9px] text-gray-300 mt-1.5 uppercase tracking-wide">Click para detalle →</p>
                </div>

                <GridCard
                    title="Resultado" icon="💰" isMoney
                    val={Math.round(totalResultado)}
                    prevMoM={prevMoMResult !== 0 ? Math.round(prevMoMResult) : undefined}
                    prevYoY={prevYoYResult !== 0 ? Math.round(prevYoYResult) : undefined}
                    labelMoM={labelMoM} labelYoY={labelYoY}
                    onClick={() => totalResultado !== 0 ? openPanel('rend', 'Resultado por Unidad de Negocio', '💰') : undefined}
                    tooltip="Calculado sobre las operaciones cerradas en liquidación o cobradas. El resultado de los negocios de DeCampoACampo se diversifica: parte vendedora 2/3 y parte compradora 1/3."
                />
                <GridCard
                    title="Rendimiento %" icon="📈"
                    val={Math.round(rendimiento * 100) / 100} isRate
                    prevMoM={prevMoMRend !== 0 ? prevMoMRend : undefined}
                    prevYoY={prevYoYRend !== 0 ? prevYoYRend : undefined}
                    labelMoM={labelMoM} labelYoY={labelYoY}
                    onClick={() => concretadas.length > 0 ? openPanel('rendPct', 'Rendimiento % por Unidad de Negocio', '📈') : undefined}
                    tooltip="El porcentaje de margen generado respecto al monto total en pesos o dólares operados."
                />
                <GridCard
                    title="Sociedades" icon="🏢"
                    val={sociedadesUnicas} unit="socs"
                    prevMoM={prevMoMSocs || undefined}
                    prevYoY={prevYoYSocs || undefined}
                    labelMoM={labelMoM} labelYoY={labelYoY}
                    tooltip="Cantidad de Clientes únicos con los que se operó (indistintamente si fue de manera Directa o como Vendedor/Comprador cruce)."
                    onClick={() => sociedadesUnicas > 0 ? openPanel('empresas', 'Sociedades por Unidad de Negocio', '🏢') : undefined}
                />
            </div>

            {/* ── Detail Panel ── */}
            <DetailPanel
                isOpen={!!panel}
                onClose={() => setPanel(null)}
                title={panel?.title || ''}
                icon={panel?.icon}
                accentColor="border-[#3179a7]"
            >
                {panel && (
                    panel.metric === 'caidas' ? (
                        <NoConcretadasTable
                            title={panel.title}
                            icon={panel.icon}
                            caidas={panel.ops.filter(o => !soloConc(o))}
                        />
                    ) : (
                        <AnalisisTable
                            title={panel.title}
                            ops={panel.ops}
                            prevMoM={panel.prevMoM}
                            prevYoY={panel.prevYoY}
                            metric={panel.metric}
                            selectedMes={selectedMes}
                            acFilter={acFilter}
                        />
                    )
                )}
            </DetailPanel>
        </>
    );
}