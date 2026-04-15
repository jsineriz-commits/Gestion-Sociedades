'use client';

import { useMemo, useEffect, useState } from 'react';
import {
    ComposedChart, Area, Bar, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer
} from 'recharts';
import { UN_HEX } from '@/lib/utils/unColors';
import InfoTooltip from '@/components/ui/InfoTooltip';

interface Props {
    opsAll: any[];
    selectedYear: number;
    filterCierre: boolean;
    historyLoaded?: boolean;  // cuando es false → el histórico año anterior aún carga
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const TopLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (!value || value <= 0) return null;
    return (
        <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={12} fontWeight={800} fill="#374151">
            {fmtK(value)}
        </text>
    );
};

export default function EvolucionAnual({ opsAll, selectedYear, filterCierre, historyLoaded = true }: Props) {
    // Detectar mobile para simplificar el gráfico
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const data = useMemo(() => {
        const parseDateLocal = (ds: string | null) => {
            if (!ds) return new Date(NaN);
            const p = ds.includes('T') ? ds.split('T')[0].split('-') : ds.split(' ')[0].split('-');
            return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0) : new Date(ds);
        };

        const monthlyData = MESES.map((mes) => ({
            mes,
            cabezasFaena: 0, cabezasInvernada: 0, cabezasMAG: 0, cabezasInvNeo: 0, cabezasCria: 0,
            totalCabezas: 0,
            totalCabezasPrev: 0,
            labelAnchor: 0,   // siempre 0 — solo para anclar el LabelList en el tope del stack
            rendSum: 0, rendCab: 0, // acumuladores para promedio ponderado por cabezas (campo rendimiento Q95)
            concretadas: 0, noConc: 0,
            rendimiento: undefined as number | undefined,
            cccPct: undefined as number | undefined,
        }));

        opsAll.forEach(o => {
            const d = parseDateLocal(o.fecha_operacion);
            if (isNaN(d.getTime())) return;
            const y = d.getFullYear();
            
            if (y === selectedYear - 1) {
                const eg = (o.estado_general || o.ESTADO || o.estado_general_raw || '').trim().toUpperCase();
                const isConcPrev = eg === 'CONCRETADA' || eg === 'CONCRETADAS' || eg === 'VENDIDA' || eg === 'VENDIDAS';
                if (!isConcPrev) return;
                const cbzPrev = Number(o.Cabezas ?? o.cabezas ?? o.CABEZAS ?? 0);
                monthlyData[d.getMonth()].totalCabezasPrev += cbzPrev;
                return;
            }

            if (y !== selectedYear) return;

            const monthIdx = d.getMonth();
            const eg = (o.estado_general || '').trim().toUpperCase();
            const isConcretada = eg === 'CONCRETADA';
            const isNoConc = eg === 'NO CONCRETADAS' || eg === 'NO CONCRETADA' || eg === 'ANULADA';

            if (isConcretada) monthlyData[monthIdx].concretadas++;
            if (isNoConc)    monthlyData[monthIdx].noConc++;

            if (!isConcretada) return;
            if (filterCierre && o.Cierre !== 1) return;

            const un = (o.UN || '').trim().toUpperCase();
            const cbzs = Number(o.Cabezas || 0);
            monthlyData[monthIdx].totalCabezas += cbzs;
            if (un === 'FAENA' || un === 'FAE')          monthlyData[monthIdx].cabezasFaena     += cbzs;
            else if (un === 'INVERNADA' || un === 'INV') monthlyData[monthIdx].cabezasInvernada  += cbzs;
            else if (un === 'MAG')                       monthlyData[monthIdx].cabezasMAG        += cbzs;
            else if (un === 'INVERNADA NEO')             monthlyData[monthIdx].cabezasInvNeo     += cbzs;
            else if (un === 'CRÍA' || un === 'CRIA')     monthlyData[monthIdx].cabezasCria       += cbzs;

            // Acumular rendimiento ponderado por cabezas (campo directo de Q95)
            const rend = Number(o.rendimiento);
            if (!isNaN(rend) && rend > 0) {
                monthlyData[monthIdx].rendSum += rend * cbzs;
                monthlyData[monthIdx].rendCab += cbzs;
            }
        });

        monthlyData.forEach(m => {
            // Promedio ponderado por cabezas del campo rendimiento de Q95 (igual metodología que KPI card)
            m.rendimiento = m.rendCab > 0 ? Math.round((m.rendSum / m.rendCab) * 100) / 100 : undefined;
            const totalCCC = m.concretadas + m.noConc;
            m.cccPct = totalCCC > 0 ? Math.round((m.concretadas / totalCCC) * 1000) / 10 : undefined;
            if (m.cabezasFaena === 0)     (m as any).cabezasFaena = undefined;
            if (m.cabezasInvernada === 0) (m as any).cabezasInvernada = undefined;
            if (m.cabezasMAG === 0)       (m as any).cabezasMAG = undefined;
            if (m.cabezasInvNeo === 0)    (m as any).cabezasInvNeo = undefined;
            if (m.cabezasCria === 0)      (m as any).cabezasCria = undefined;
            if (m.totalCabezas === 0)     (m as any).totalCabezas = undefined;
            // No seteamos a undefined totalCabezasPrev para asegurar que el área dibuje base en 0
            // labelAnchor siempre queda en 0 — NO lo nullificamos
        });

        return monthlyData;
    }, [opsAll, selectedYear, filterCierre]);

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col h-full">
            <div className="flex items-center mb-4 gap-2">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <span>📈</span> Evolución Anual {selectedYear}
                </h3>
                {!historyLoaded && (
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                        <span className="w-2.5 h-2.5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                        Cargando histórico {selectedYear - 1}…
                    </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">
                    Histórico {selectedYear - 1}: {data.reduce((acc, m) => acc + (m.totalCabezasPrev || 0), 0)} cab
                </span>
                <InfoTooltip text="Muestra el volumen de cabezas operado segmentado por mes y Unidad de Negocio, junto a un resumen de Rendimiento y Concreción. El gráfico interactivo filtra según la selección superior." />
            </div>

            {/* Gráfico */}
            <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 28, right: 40, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                            dataKey="mes"
                            axisLine={false} tickLine={false}
                            tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 600 }}
                            dy={8}
                        />
                        <YAxis
                            yAxisId="left"
                            axisLine={false} tickLine={false}
                            tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }}
                            tickFormatter={(v) => fmtK(v)}
                            width={36}
                        />
                        {/* Eje Y derecho (Rendimiento%) — oculto en mobile */}
                        {!isMobile && (
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            axisLine={false} tickLine={false}
                            tick={{ fontSize: 10, fill: '#374151', fontWeight: 600 }}
                            tickFormatter={(v) => `${v}%`}
                            width={36}
                        />
                        )}
                        <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                            formatter={(value: any, name: any) => {
                                if (name === 'Rendimiento') return [`${value}%`, name];
                                return [Number(value).toLocaleString('es-AR') + ' cab', name];
                            }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '8px' }} />

                        {/* Sombra Año Anterior */}
                        <Area yAxisId="left" type="step" dataKey="totalCabezasPrev" name={`Año ant. (${selectedYear - 1})`} fill="#e5e7eb" stroke="#9ca3af" strokeWidth={2} strokeDasharray="4 4" fillOpacity={0.6} activeDot={{ r: 4, fill: '#9ca3af' }} connectNulls={true} />

                        <Bar yAxisId="left" dataKey="cabezasInvernada" name="Invernada" stackId="a" fill={UN_HEX['Invernada']}  radius={[0,0,0,0]} maxBarSize={36} />
                        <Bar yAxisId="left" dataKey="cabezasFaena"     name="Faena"     stackId="a" fill={UN_HEX['Faena']}      radius={[0,0,0,0]} maxBarSize={36} />
                        <Bar yAxisId="left" dataKey="cabezasMAG"       name="MAG"       stackId="a" fill={UN_HEX['MAG']}        radius={[0,0,0,0]} maxBarSize={36} />
                        <Bar yAxisId="left" dataKey="cabezasInvNeo"    name="Inv. Neo"  stackId="a" fill={UN_HEX['Inv. Neo']}   radius={[0,0,0,0]} maxBarSize={36} />
                        <Bar yAxisId="left" dataKey="cabezasCria"      name="Cría"      stackId="a" fill={UN_HEX['Cría']}       radius={[3,3,0,0]} maxBarSize={36} />
                        {/* Barra 0-altura en el mismo stack — solo ancla la etiqueta de total */}
                        <Bar yAxisId="left" dataKey="labelAnchor" stackId="a" fill="transparent" maxBarSize={36} legendType="none" isAnimationActive={false}>
                            <LabelList dataKey="totalCabezas" content={<TopLabel />} />
                        </Bar>

                        {/* Línea de rendimiento — oculta en mobile */}
                        {!isMobile && (
                        <Line
                            yAxisId="right" type="monotone" dataKey="rendimiento"
                            name="Rendimiento"
                            stroke="#111111" strokeWidth={2.5}
                            dot={{ r: 4, fill: '#111111', strokeWidth: 2, stroke: '#ffffff' }}
                            activeDot={{ r: 6, fill: '#111111' }}
                            connectNulls
                        >
                            <LabelList
                                dataKey="rendimiento"
                                position="top"
                                formatter={(v: any) => v !== undefined && v !== null ? `${v}%` : ''}
                                style={{ fontSize: '10px', fontWeight: 800, fill: '#111111' }}
                            />
                        </Line>
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Tabla CCC% + Rend% — solo en desktop */}
            <div className="hidden md:block mt-2 border-t border-gray-100 pt-2 space-y-1">
                {/* Fila Rend% */}
                <div className="flex items-center">
                    <div style={{ width: 36, flexShrink: 0 }} className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-right pr-1">
                        Rend%
                    </div>
                    <div className="flex-1 grid grid-cols-12">
                        {data.map((m) => {
                            const v = m.rendimiento;
                            const color = v === undefined ? 'text-gray-200'
                                : v >= 2.5 ? 'text-emerald-600'
                                : v >= 1.5 ? 'text-amber-500'
                                : 'text-rose-500';
                            return (
                                <div key={m.mes} className="text-center">
                                    <span className={`text-[10px] font-black ${color}`}>
                                        {v !== undefined ? `${v}%` : '—'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ width: 76, flexShrink: 0 }} />
                </div>
                {/* Fila CCC% */}
                <div className="flex items-center">
                    <div style={{ width: 36, flexShrink: 0 }} className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-right pr-1">
                        CCC%
                    </div>
                    <div className="flex-1 grid grid-cols-12">
                        {data.map((m) => {
                            const v = m.cccPct;
                            const color = v === undefined ? 'text-gray-200'
                                : v >= 80 ? 'text-emerald-600'
                                : v >= 60 ? 'text-amber-500'
                                : 'text-rose-500';
                            return (
                                <div key={m.mes} className="text-center">
                                    <span className={`text-[10px] font-black ${color}`}>
                                        {v !== undefined ? `${v}%` : '—'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ width: 76, flexShrink: 0 }} />
                </div>
                {/* Fila Cabezas */}
                <div className="flex items-center">
                    <div style={{ width: 36, flexShrink: 0 }} className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-right pr-1">
                        Cab.
                    </div>
                    <div className="flex-1 grid grid-cols-12">
                        {data.map((m) => (
                            <div key={m.mes} className="text-center">
                                <span className={`text-[10px] font-bold ${m.totalCabezas ? 'text-gray-600' : 'text-gray-200'}`}>
                                    {m.totalCabezas ? fmtK(m.totalCabezas) : '—'}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div style={{ width: 76, flexShrink: 0 }} />
                </div>
            </div>
        </div>
    );
}
