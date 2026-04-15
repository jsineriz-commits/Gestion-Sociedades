'use client';
import { useMemo } from 'react';

interface Props {
    opsAll: any[];           // todas las ops del usuario (sin filtro de período)
    acName?: string | null;  // para filtrar solo lado vendedor cuando hay múltiples ACs
    isOficina?: boolean;     // si es oficina: contar cualquier op donde AC_Vend pertenece a la oficina
    memberNames?: string[];  // nombres de miembros de la oficina
}

function getMonday(d: Date): Date {
    const day = d.getDay(); // 0=Sun, 1=Mon ...
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff);
}

function toLocalDate(ds: string | null): Date | null {
    if (!ds) return null;
    const p = ds.includes('T') ? ds.split('T')[0].split('-') : ds.split(' ')[0].split('-');
    return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null;
}

interface PeriodStat { tropas: number; cabezas: number }

export default function OfrecimientosCard({ opsAll, acName, isOficina, memberNames }: Props) {
    const nombresSet = useMemo(() =>
        memberNames ? new Set(memberNames.map(n => n.toLowerCase().trim())) : null,
    [memberNames]);

    const stats = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart  = getMonday(now);
        const mesStart   = new Date(now.getFullYear(), now.getMonth(), 1);
        const prevMesStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMesEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); // último día mes anterior

        const empty = (): PeriodStat => ({ tropas: 0, cabezas: 0 });
        const hoy = empty(), semana = empty(), mes = empty(), prevMes = empty();

        for (const op of opsAll) {
            const vend = (op.AC_Vend || '').toLowerCase().trim();
            // Filtrar solo lado vendedor
            if (!vend) continue;
            if (isOficina && nombresSet) {
                if (!nombresSet.has(vend)) continue;
            } else if (acName) {
                if (vend !== acName.toLowerCase().trim()) continue;
            }

            const d = toLocalDate(op.fecha_operacion);
            if (!d) continue;
            const cbzs = Number(op.Cabezas) || 0;

            if (d >= todayStart) {
                hoy.tropas++;    hoy.cabezas    += cbzs;
            }
            if (d >= weekStart) {
                semana.tropas++; semana.cabezas += cbzs;
            }
            if (d >= mesStart) {
                mes.tropas++;    mes.cabezas    += cbzs;
            }
            if (d >= prevMesStart && d <= prevMesEnd) {
                prevMes.tropas++; prevMes.cabezas += cbzs;
            }
        }
        return { hoy, semana, mes, prevMes };
    }, [opsAll, acName, isOficina, nombresSet]);

    const mesPctChange = stats.prevMes.cabezas > 0
        ? Math.round(((stats.mes.cabezas - stats.prevMes.cabezas) / stats.prevMes.cabezas) * 100)
        : null;

    const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const now = new Date();
    const mesActualLabel = MESES[now.getMonth()];
    const mesAnteriorLabel = MESES[now.getMonth() === 0 ? 11 : now.getMonth() - 1];

    type ColKey = 'hoy' | 'semana' | 'mes' | 'prevMes';
    const cols: { key: ColKey; label: string; icon: string; accent: string; bg: string }[] = [
        { key: 'hoy',     label: 'Hoy',           icon: '📅', accent: 'text-violet-600', bg: 'bg-violet-50' },
        { key: 'semana',  label: 'Esta semana',    icon: '📆', accent: 'text-blue-600',   bg: 'bg-blue-50'   },
        { key: 'mes',     label: mesActualLabel,   icon: '📊', accent: 'text-emerald-600',bg: 'bg-emerald-50'},
        { key: 'prevMes', label: mesAnteriorLabel, icon: '🕐', accent: 'text-gray-500',   bg: 'bg-gray-50'   },
    ];

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
            {/* Header */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">🐄 Ofrecimientos</p>
                    <p className="text-xs text-gray-500 font-medium">Tropas ofrecidas — lado vendedor</p>
                </div>
                {mesPctChange !== null && (
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${mesPctChange >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                        {mesPctChange >= 0 ? '▲' : '▼'} {Math.abs(mesPctChange)}% vs {mesAnteriorLabel}
                    </span>
                )}
            </div>

            {/* Grid 4 columnas */}
            <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
                {cols.map(({ key, label, icon, accent, bg }) => {
                    const s = stats[key];
                    const isCurrentMonth = key === 'mes';
                    return (
                        <div key={key} className={`px-3 py-3 flex flex-col gap-1 ${isCurrentMonth ? bg : ''}`}>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <span>{icon}</span>{label}
                            </p>
                            {/* Tropas */}
                            <div className="flex items-baseline gap-1">
                                <span className={`text-xl font-black leading-none ${accent}`}>
                                    {s.tropas}
                                </span>
                                <span className="text-[9px] text-gray-400 font-semibold">tropas</span>
                            </div>
                            {/* Cabezas */}
                            <div className="flex items-baseline gap-1">
                                <span className="text-sm font-bold text-gray-600">
                                    {s.cabezas.toLocaleString('es-AR')}
                                </span>
                                <span className="text-[9px] text-gray-400 font-semibold">cab.</span>
                            </div>
                            {/* Promedio cab/tropa */}
                            {s.tropas > 0 && (
                                <p className="text-[9px] text-gray-300">
                                    ~{Math.round(s.cabezas / s.tropas)} cab/tropa
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
