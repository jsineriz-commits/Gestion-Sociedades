'use client';

import { useState } from 'react';
import DetailPanel from '@/components/ui/DetailPanel';

interface Props {
    ops: any[];   // opsOficina completas (sin filtrar por Cierre, para mostrar pendientes reales)
}

function formatFecha(raw: string | null): string {
    if (!raw) return '—';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fN(n: any) { return n == null ? '—' : Number(n).toLocaleString('es-AR'); }

// ─── Tabla de detalle para el panel ────────────────────────────────────────
function PagoTable({ ops }: { ops: any[] }) {
    return (
        <div className="overflow-x-auto text-xs">
            <table className="w-full">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                        {['ID', 'Fecha Op.', 'Vto. Pago', 'UN', 'RS Vendedora', 'RS Compradora', 'Cabezas', 'AC Vend', 'AC Comp', 'Plazo V', 'Estado'].map(h => (
                            <th key={h} className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left whitespace-nowrap">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {ops.map((o, i) => {
                        // Calcular fecha de vto pago
                        let fVto: Date | null = null;
                        if (o.fecha_operacion && o.plazo_vend != null) {
                            fVto = new Date(o.fecha_operacion);
                            fVto.setDate(fVto.getDate() + (o.plazo_vend || 0));
                        }
                        const vencida = fVto && fVto < new Date();
                        return (
                            <tr key={i} className={`hover:bg-gray-50 transition-colors ${vencida ? 'bg-rose-50/30' : ''}`}>
                                <td className="px-3 py-1.5 font-bold text-gray-700">#{o.id_lote}</td>
                                <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{formatFecha(o.fecha_operacion)}</td>
                                <td className={`px-3 py-1.5 whitespace-nowrap font-bold ${vencida ? 'text-rose-600' : 'text-amber-600'}`}>
                                    {fVto ? formatFecha(fVto.toISOString()) : '—'}
                                    {vencida && <span className="ml-1 text-[9px] bg-rose-100 text-rose-600 px-1 py-0.5 rounded">VENCIDO</span>}
                                </td>
                                <td className="px-3 py-1.5 text-gray-600">{o.UN || '—'}</td>
                                <td className="px-3 py-1.5 font-semibold text-gray-900 whitespace-nowrap">{o.RS_Vendedora || '—'}</td>
                                <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{o.RS_Compradora || '—'}</td>
                                <td className="px-3 py-1.5 font-black text-gray-900 text-right">{fN(o.Cabezas)}</td>
                                <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{o.AC_Vend || 'Directa'}</td>
                                <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{o.AC_Comp || '—'}</td>
                                <td className="px-3 py-1.5 text-gray-600">{o.plazo_vend != null ? `${o.plazo_vend}d` : '—'}</td>
                                <td className="px-3 py-1.5">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${vencida ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {vencida ? 'Vencido' : 'Por Vencer'}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default function PagosPanel({ ops }: Props) {
    const [panel, setPanel] = useState<{ title: string; icon: string; ops: any[] } | null>(null);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite7dias = new Date(hoy);
    limite7dias.setDate(limite7dias.getDate() + 7);
    limite7dias.setHours(23, 59, 59, 999);
    const ayerEnd = new Date(hoy);
    ayerEnd.setHours(23, 59, 59, 999);
    ayerEnd.setDate(ayerEnd.getDate() - 1);

    const parseDateLocal = (ds: string) => {
        const p = ds.includes('T') ? ds.split('T')[0].split('-') : ds.split(' ')[0].split('-');
        return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0) : new Date(ds);
    };

    // Ops concretadas sin cierre = pendientes de liquidación
    const concretadas = ops.filter(o => (o.estado_general || '').toUpperCase() === 'CONCRETADA');

    // Pagos por vencer: plazo no vencido aún, sin Cierre, solo lado comprador Rio4, máximo 7 días.
    const porVencer = concretadas.filter(o => {
        if (o.Cierre === 1) return false;
        if (!o.fecha_operacion || o.plazo_vend == null) return false;
        if (!o.AC_Comp || String(o.AC_Comp).trim() === '') return false;
        const vto = parseDateLocal(o.fecha_operacion);
        vto.setDate(vto.getDate() + (o.plazo_vend || 0));
        return vto >= hoy && vto <= limite7dias;
    }).sort((a, b) => {
        const va = parseDateLocal(a.fecha_operacion); va.setDate(va.getDate() + (a.plazo_vend || 0));
        const vb = parseDateLocal(b.fecha_operacion); vb.setDate(vb.getDate() + (b.plazo_vend || 0));
        return va.getTime() - vb.getTime();
    });

    // Pagos vencidos: plazo superado sin Cierre, solo lado comprador Rio4
    const vencidos = concretadas.filter(o => {
        if (o.Cierre === 1) return false;
        if (!o.fecha_operacion || o.plazo_vend == null) return false;
        if (!o.AC_Comp || String(o.AC_Comp).trim() === '') return false;
        const vto = parseDateLocal(o.fecha_operacion);
        vto.setDate(vto.getDate() + (o.plazo_vend || 0));
        return vto <= ayerEnd;
    }).sort((a, b) => {
        const va = parseDateLocal(a.fecha_operacion); va.setDate(va.getDate() + (a.plazo_vend || 0));
        const vb = parseDateLocal(b.fecha_operacion); vb.setDate(vb.getDate() + (b.plazo_vend || 0));
        return va.getTime() - vb.getTime();
    });

    // Ops marcadas con Pagos_por_vencer flag
    const conFlag = ops.filter(o => (o.Pagos_por_vencer || 0) > 0);

    const cbzVencer = porVencer.reduce((s: number, o: any) => s + (o.Cabezas || 0), 0);
    const cbzVencidos = vencidos.reduce((s: number, o: any) => s + (o.Cabezas || 0), 0);

    if (!porVencer.length && !vencidos.length && !conFlag.length) return null;

    return (
        <>
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-amber-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">💳</span>
                        <div>
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Estado de Pagos</h3>
                            <p className="text-[10px] text-gray-400 mt-0.5">Ops concretadas · pagos pendientes de liquidación (Cierre=0)</p>
                        </div>
                    </div>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Por Vencer */}
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
                        onClick={() => porVencer.length > 0 && setPanel({ title: 'Pagos por Vencer', icon: '⏰', ops: porVencer })}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white text-sm">⏰</span>
                                <div>
                                    <p className="text-xs font-black text-gray-900">Por Vencer</p>
                                    <p className="text-[9px] text-amber-700">Próximos en vencer</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-black text-amber-600">{porVencer.length}</p>
                                <p className="text-[9px] text-gray-400">tropas</p>
                            </div>
                        </div>
                        <div className="flex justify-between text-[10px]">
                            <span className="text-gray-500">{cbzVencer.toLocaleString('es-AR')} cabezas</span>
                            <span className="text-amber-700 font-bold">Ver detalle →</span>
                        </div>
                        {/* Próximos 3 */}
                        {porVencer.slice(0, 3).map((o, i) => {
                            const vto = new Date(o.fecha_operacion);
                            vto.setDate(vto.getDate() + (o.plazo_vend || 0));
                            const diasR = Math.ceil((vto.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                            return (
                                <div key={i} className="mt-2 flex items-center justify-between bg-white/60 rounded-lg px-2 py-1.5">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-800 truncate max-w-[140px]">{o.RS_Compradora || '—'}</p>
                                        <p className="text-[9px] text-gray-500">{o.AC_Comp}</p>
                                    </div>
                                    <span className="text-[10px] font-black text-amber-600">{diasR}d</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Vencidos */}
                    <div className="bg-rose-50 rounded-xl p-4 border border-rose-100 cursor-pointer hover:bg-rose-100 transition-colors"
                        onClick={() => vencidos.length > 0 && setPanel({ title: 'Pagos Vencidos', icon: '🚨', ops: vencidos })}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center text-white text-sm">🚨</span>
                                <div>
                                    <p className="text-xs font-black text-gray-900">Vencidos</p>
                                    <p className="text-[9px] text-rose-700">Plazo superado, sin liquidar</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-black text-rose-600">{vencidos.length}</p>
                                <p className="text-[9px] text-gray-400">tropas</p>
                            </div>
                        </div>
                        <div className="flex justify-between text-[10px]">
                            <span className="text-gray-500">{cbzVencidos.toLocaleString('es-AR')} cabezas</span>
                            <span className="text-rose-700 font-bold">Ver detalle →</span>
                        </div>
                        {/* Primeros 3 */}
                        {vencidos.slice(0, 3).map((o, i) => {
                            const vto = new Date(o.fecha_operacion);
                            vto.setDate(vto.getDate() + (o.plazo_vend || 0));
                            const diasVen = Math.floor((hoy.getTime() - vto.getTime()) / (1000 * 60 * 60 * 24));
                            return (
                                <div key={i} className="mt-2 flex items-center justify-between bg-white/60 rounded-lg px-2 py-1.5">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-800 truncate max-w-[140px]">{o.RS_Compradora || '—'}</p>
                                        <p className="text-[9px] text-gray-500">{o.AC_Comp}</p>
                                    </div>
                                    <span className="text-[10px] font-black text-rose-600">+{diasVen}d</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <DetailPanel
                isOpen={!!panel} onClose={() => setPanel(null)}
                title={panel?.title || ''} icon={panel?.icon}
                accentColor={panel?.icon === '🚨' ? 'border-rose-500' : 'border-amber-500'}
                count={panel?.ops.length}
            >
                {panel && <PagoTable ops={panel.ops} />}
            </DetailPanel>
        </>
    );
}
