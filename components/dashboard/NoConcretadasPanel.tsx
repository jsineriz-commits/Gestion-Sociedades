'use client';

import { useState } from 'react';
import DetailPanel from '@/components/ui/DetailPanel';
import InfoTooltip from '@/components/ui/InfoTooltip';

interface BreakdownItem { label: string; val: number; pct: number; color: string; }

function OpTable({ ops }: { ops: any[] }) {
    return (
        <div className="overflow-x-auto text-xs">
            <table className="w-full">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                        {['ID', 'Fecha', 'UN', 'RS Vendedora', 'Cabezas', 'Motivo'].map(h => (
                            <th key={h} className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left whitespace-nowrap">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {ops.map((o, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-1.5 font-bold text-gray-700">#{o.id_lote}</td>
                            <td className="px-3 py-1.5 text-gray-500">{o.fecha_operacion ? new Date(o.fecha_operacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                            <td className="px-3 py-1.5 text-gray-600">{o.UN || '—'}</td>
                            <td className="px-3 py-1.5 font-semibold text-gray-900">{o.RS_Vendedora || '—'}</td>
                            <td className="px-3 py-1.5 font-black text-gray-900 text-right">{(o.Cabezas || 0).toLocaleString('es-AR')}</td>
                            <td className="px-3 py-1.5">
                                <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-full">
                                    {(o.Motivo_NC || o.motivo || 'Sin motivo').trim().replace('-', 'Sin motivo')}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

interface Props { ops: any[]; }

export default function NoConcretadasPanel({ ops }: Props) {
    const [panel, setPanel] = useState<{ label: string; ops: any[] } | null>(null);

    const noConcretadas = ops.filter((o: any) => {
        const eg = (o.estado_general || '').toUpperCase();
        return eg === 'NO CONCRETADAS' || eg === 'NO CONCRETADA' || eg === 'ANULADA';
    });

    const total = noConcretadas.length;

    const motivosRaw = Array.from(new Set(
        noConcretadas.map((o: any) =>
            (o.Motivo_NC || o.motivo || 'Sin motivo').trim().replace('-', 'Sin motivo')
        ).filter((m: string) => m && m !== '-')
    ));

    const MOTIVO_COLORS = ['bg-rose-600', 'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-rose-300'];

    const breakdown: BreakdownItem[] = motivosRaw.map((motivo, i) => {
        const list = noConcretadas.filter((o: any) => {
            const m = (o.Motivo_NC || o.motivo || 'Sin motivo').trim().replace('-', 'Sin motivo');
            return m === motivo;
        });
        return {
            label: String(motivo),
            val: list.length,
            pct: total > 0 ? (list.length / total) * 100 : 0,
            color: MOTIVO_COLORS[i] || 'bg-gray-400',
        };
    }).filter(b => b.val > 0).sort((a, b) => b.val - a.val).slice(0, 5);

    return (
        <>
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">📉</span>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h3 className="text-[11px] font-bold uppercase tracking-wider text-rose-700">No Concretadas</h3>
                                <InfoTooltip text="Total de operaciones que no llegaron a cerrarse exitosamente (rechazadas, caídas, etc). Ayuda a medir la tasa de bateo." />
                            </div>
                            <p className="text-[10px] text-gray-400">
                                {total > 0 ? `${total} operaciones · haz clic para ver detalle` : 'Sin no concretadas en el período'}
                            </p>
                        </div>
                    </div>
                    <span className={`text-3xl font-black ${total > 0 ? 'text-rose-600' : 'text-gray-300'}`}>{total}</span>
                </div>

                {total === 0 ? (
                    <div className="flex items-center justify-center py-6 text-gray-300">
                        <span className="text-sm">✅ Todas las operaciones fueron concretadas</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {breakdown.map((b, i) => (
                            <div
                                key={i}
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setPanel({
                                    label: b.label,
                                    ops: noConcretadas.filter((o: any) =>
                                        (o.Motivo_NC || o.motivo || 'Sin motivo').trim().replace('-', 'Sin motivo') === b.label
                                    )
                                })}
                            >
                                <div className="flex justify-between items-end mb-1.5">
                                    <span className="text-[10px] font-bold text-gray-600 leading-tight">{b.label}</span>
                                    <span className="text-base font-black text-gray-900">{b.val}</span>
                                </div>
                                <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${b.color} rounded-full transition-all duration-700`}
                                        style={{ width: `${b.pct}%` }}
                                    />
                                </div>
                                <p className="text-[9px] text-gray-400 mt-0.5">{b.pct.toFixed(0)}%</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <DetailPanel
                isOpen={!!panel}
                onClose={() => setPanel(null)}
                title={`No Concretadas · ${panel?.label}`}
                icon="📉"
                accentColor="border-rose-500"
                count={panel?.ops.length}
            >
                {panel && <OpTable ops={panel.ops} />}
            </DetailPanel>
        </>
    );
}
