'use client';
import { useState, useEffect, useMemo } from 'react';

// ── Province abbreviations ────────────────────────────────────────────────────
const PROV_ABBR: Record<string, string> = {
    'buenos aires': 'BUE', 'córdoba': 'CBA', 'cordoba': 'CBA',
    'santa fe': 'SF', 'entre ríos': 'ER', 'entre rios': 'ER',
    'la pampa': 'LP', 'corrientes': 'CTE', 'formosa': 'FMC',
    'santiago del estero': 'SGO', 'salta': 'SAL', 'tucumán': 'TUC',
    'tucuman': 'TUC', 'misiones': 'MIS', 'chaco': 'CHA', 'neuquén': 'NQN',
    'neuquen': 'NQN', 'río negro': 'RN', 'rio negro': 'RN',
    'mendoza': 'MDZ', 'san luis': 'SLU', 'jujuy': 'JUJ',
    'chubut': 'CHU', 'santa cruz': 'SCZ', 'tierra del fuego': 'TDF',
};

function getProvincia(origen: string): string {
    if (!origen) return 'S/D';
    const parts = origen.split(',').map(s => s.trim());
    const prov = (parts[parts.length - 1] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return PROV_ABBR[parts[parts.length - 1]?.toLowerCase()] ||
           PROV_ABBR[prov] ||
           (parts[parts.length - 1] ? parts[parts.length - 1].substring(0, 6).toUpperCase() : 'S/D');
}

function normalizeUN(tipo: string): string {
    const u = (tipo || '').toUpperCase().trim();
    if (u === 'FAENA' || u === 'FAE') return 'Faena';
    if (u === 'INVERNADA' || u === 'INV') return 'Invernada';
    if (u === 'INVERNADA NEO' || u === 'INV. NEO' || u === 'INV.NEO') return 'Inv. Neo';
    if (u === 'CRÍA' || u === 'CRIA') return 'Cría';
    if (u === 'MAG') return 'MAG';
    return 'Otros';
}

function getUN(op: any): string {
    // Priorizar UN, fallback a Tipo
    return normalizeUN(op.UN || op.Tipo || '');
}

// ── Heat map color (yellow-orange-red spectrum) ───────────────────────────────
function heatColor(value: number, max: number): string {
    if (max === 0 || value === 0) return 'rgba(15,23,42,0.3)';
    const ratio = Math.sqrt(value / max);
    // From cool blue → warm amber → hot red
    if (ratio < 0.33) {
        const r2 = ratio / 0.33;
        return `rgba(59,130,246,${0.15 + r2 * 0.5})`;  // blue
    } else if (ratio < 0.66) {
        const r2 = (ratio - 0.33) / 0.33;
        return `rgba(251,146,60,${0.5 + r2 * 0.3})`;   // orange
    } else {
        const r2 = (ratio - 0.66) / 0.34;
        return `rgba(239,68,68,${0.75 + r2 * 0.25})`;  // red
    }
}

function heatTextColor(value: number, max: number): string {
    const ratio = value / max;
    return ratio > 0.4 ? '#fff' : 'rgba(226,232,240,0.8)';
}

// ── kg per head bins ──────────────────────────────────────────────────────────
const KG_BINS = [
    { label: '<100',     min: 0,   max: 100  },
    { label: '100-150',  min: 100, max: 150  },
    { label: '150-200',  min: 150, max: 200  },
    { label: '200-250',  min: 200, max: 250  },
    { label: '250-320',  min: 250, max: 320  },
    { label: '320-400',  min: 320, max: 400  },
    { label: '400+',     min: 400, max: Infinity },
];
const CBZ_BINS = [
    { label: '1-30',   min: 1,   max: 30   },
    { label: '31-80',  min: 31,  max: 80   },
    { label: '81-150', min: 81,  max: 150  },
    { label: '151-300',min: 151, max: 300  },
    { label: '301-600',min: 301, max: 600  },
    { label: '601+',   min: 601, max: Infinity },
];

const CATS = ['Faena', 'Invernada', 'Inv. Neo', 'Cría', 'MAG', 'Otros'];
const CAT_COLOR: Record<string, string> = {
    Faena: 'bg-blue-500', Invernada: 'bg-red-500', 'Inv. Neo': 'bg-orange-400',
    Cría: 'bg-yellow-400', MAG: 'bg-green-500', Otros: 'bg-gray-400',
};

const MESES = ['Todos','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmt(n: number) {
    if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n/1_000).toFixed(0)}k`;
    return n.toLocaleString('es-AR');
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
    acId?: string | null;
    acName?: string | null;
    isAdmin?: boolean;
    canal?: string | null;
    selectedYear?: number;
    selectedMes?: number;
}

export default function InsightsClient({ acId, acName, isAdmin, canal, selectedYear = new Date().getFullYear(), selectedMes = 0 }: Props) {
    const [tropas, setTropas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'heatmaps' | 'zonas' | 'compradores' | 'sociedades'>('heatmaps');
    // Drill-down state – declared here, drillTropas memo is added after concretadas
    const [drillDown, setDrillDown] = useState<
        | { type: 'hm1'; prov: string; cat: string }
        | { type: 'hm2'; kgLabel: string; cbzLabel: string; ki: number; ci: number }
        | null
    >(null);

    // Fetch tropas
    useEffect(() => {
        const load = async () => {
            setLoading(true); setError(null);
            try {
                const y = selectedYear;
                const params = new URLSearchParams({
                    fecha_desde: `${y}-01-01`,
                    fecha_hasta: `${y}-12-31`,
                });
                if (isAdmin) params.set('isAdmin', 'true');
                else {
                    if (acId) params.set('acId', acId);
                    if (acName) params.set('acName', acName);
                    if (canal) params.set('canal', canal);
                }
                const res = await fetch(`/api/regional/tropas?${params}`);
                const data = await res.json();
                if (!res.ok || data.error) throw new Error(data.error || 'Error');
                setTropas(data.tropas || []);
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        };
        load();
    }, [selectedYear, acId, acName, isAdmin, canal]);

    // Filter: concretadas + mes
    const concretadas = useMemo(() => {
        return tropas.filter(t => {
            const estado = (t.ESTADO || t.estado_general || '').trim().toUpperCase();
            if (estado !== 'CONCRETADA') return false;
            if (selectedMes === 0) return true;
            const fecha = t.fecha_operacion || t.Fecha_Oper;
            if (!fecha) return false;
            const d = new Date(fecha.includes('T') ? fecha : fecha + 'T00:00:00');
            return (d.getMonth() + 1) === selectedMes;
        });
    }, [tropas, selectedMes]);

    // Tropas del drill-down (filtradas on-the-fly) — declarado DESPUÉS de concretadas
    const drillTropas = useMemo(() => {
        if (!drillDown) return [];
        if (drillDown.type === 'hm1') {
            const { prov, cat } = drillDown;
            return concretadas.filter(t => getProvincia(t.origen) === prov && getUN(t) === cat);
        }
        const { ki, ci } = drillDown;
        const kgBin = KG_BINS[ki];
        const cbzBin = CBZ_BINS[ci];
        return concretadas.filter(t => {
            const kg = Number(t.kg) || 0;
            const cbz = Number(t.Cabezas) || 0;
            return kg >= kgBin.min && kg < kgBin.max && cbz >= cbzBin.min && cbz < cbzBin.max;
        });
    }, [drillDown, concretadas]);

    // Summary stats
    const summary = useMemo(() => {
        const totalCbzs = concretadas.reduce((s, t) => s + (Number(t.Cabezas) || 0), 0);
        const totalKg = concretadas.reduce((s, t) => s + ((Number(t.kg) || 0) * (Number(t.Cabezas) || 0)), 0);
        const zonas = new Set(concretadas.map(t => getProvincia(t.origen))).size;
        const socs = new Set([
            ...concretadas.map(t => t.RS_Vendedora).filter(Boolean),
            ...concretadas.map(t => t.RS_Compradora).filter(Boolean),
        ]).size;
        return { count: concretadas.length, totalCbzs, kgProm: totalCbzs > 0 ? totalKg / totalCbzs : 0, zonas, socs };
    }, [concretadas]);

    // ── Heatmap 1: Origen x Categoría ─────────────────────────────────────────
    const hm1 = useMemo(() => {
        const map: Record<string, Record<string, number>> = {};
        const provSet = new Set<string>();
        for (const t of concretadas) {
            const prov = getProvincia(t.origen);
            const cat = getUN(t);
            const cbz = Number(t.Cabezas) || 0;
            if (!map[prov]) map[prov] = {};
            map[prov][cat] = (map[prov][cat] || 0) + cbz;
            provSet.add(prov);
        }
        // Sort provinces by total cabezas desc
        const provs = Array.from(provSet).sort((a, b) => {
            const ta = CATS.reduce((s, c) => s + (map[a][c] || 0), 0);
            const tb = CATS.reduce((s, c) => s + (map[b][c] || 0), 0);
            return tb - ta;
        }).slice(0, 18); // max 18 rows
        const maxVal = Math.max(1, ...Object.values(map).flatMap(r => Object.values(r)));
        return { map, provs, maxVal };
    }, [concretadas]);

    // ── Heatmap 2: Kg/cab x Cabezas (densidad de tropas) ─────────────────────
    const hm2 = useMemo(() => {
        const matrix: number[][] = KG_BINS.map(() => CBZ_BINS.map(() => 0));
        for (const t of concretadas) {
            const kgVal = Number(t.kg) || 0;
            const cbzVal = Number(t.Cabezas) || 0;
            if (kgVal === 0 && cbzVal === 0) continue;
            const ki = KG_BINS.findIndex(b => kgVal >= b.min && kgVal < b.max);
            const ci = CBZ_BINS.findIndex(b => cbzVal >= b.min && cbzVal < b.max);
            if (ki >= 0 && ci >= 0) matrix[ki][ci]++;
        }
        const maxVal = Math.max(1, ...matrix.flat());
        return { matrix, maxVal };
    }, [concretadas]);

    // ── Top Zonas ─────────────────────────────────────────────────────────────
    const topZonas = useMemo(() => {
        const map: Record<string, { cbzs: number; tropas: number; kgTotal: number; kgMax: number; cats: Record<string, number> }> = {};
        for (const t of concretadas) {
            const prov = getProvincia(t.origen);
            const cbz = Number(t.Cabezas) || 0;
            const kg = Number(t.kg) || 0;
    const cat = getUN(t);
            if (!map[prov]) map[prov] = { cbzs: 0, tropas: 0, kgTotal: 0, kgMax: 0, cats: {} };
            map[prov].cbzs += cbz;
            map[prov].tropas++;
            map[prov].kgTotal += kg * cbz;
            map[prov].kgMax = Math.max(map[prov].kgMax, kg);
            map[prov].cats[cat] = (map[prov].cats[cat] || 0) + cbz;
        }
        return Object.entries(map)
            .map(([zona, d]) => ({ zona, ...d, kgProm: d.cbzs > 0 ? d.kgTotal / d.cbzs : 0, topCat: Object.entries(d.cats).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—' }))
            .sort((a, b) => b.cbzs - a.cbzs)
            .slice(0, 20);
    }, [concretadas]);

    // ── Top Compradores x Categoría ────────────────────────────────────────────
    const [activeCat, setActiveCat] = useState('Faena');
    const topCompradores = useMemo(() => {
        const map: Record<string, { cbzs: number; tropas: number }> = {};
        for (const t of concretadas) {
            const cat = getUN(t);
            if (cat !== activeCat) continue;
            const comp = (t.RS_Compradora || '').trim();
            if (!comp) continue;
            if (!map[comp]) map[comp] = { cbzs: 0, tropas: 0 };
            map[comp].cbzs += Number(t.Cabezas) || 0;
            map[comp].tropas++;
        }
        return Object.entries(map).map(([soc, d]) => ({ soc, ...d })).sort((a, b) => b.cbzs - a.cbzs).slice(0, 15);
    }, [concretadas, activeCat]);

    const topVendedores = useMemo(() => {
        const map: Record<string, { cbzs: number; tropas: number }> = {};
        for (const t of concretadas) {
            const cat = getUN(t);
            if (cat !== activeCat) continue;
            const vend = (t.RS_Vendedora || '').trim();
            if (!vend) continue;
            if (!map[vend]) map[vend] = { cbzs: 0, tropas: 0 };
            map[vend].cbzs += Number(t.Cabezas) || 0;
            map[vend].tropas++;
        }
        return Object.entries(map).map(([soc, d]) => ({ soc, ...d })).sort((a, b) => b.cbzs - a.cbzs).slice(0, 15);
    }, [concretadas, activeCat]);

    const topSociedades = useMemo(() => {
        const venta: Record<string, { cbzs: number; tropas: number }> = {};
        const compra: Record<string, { cbzs: number; tropas: number }> = {};
        for (const t of concretadas) {
            const cbz = Number(t.Cabezas) || 0;
            const v = (t.RS_Vendedora || '').trim();
            const c = (t.RS_Compradora || '').trim();
            if (v) { if (!venta[v]) venta[v] = { cbzs: 0, tropas: 0 }; venta[v].cbzs += cbz; venta[v].tropas++; }
            if (c) { if (!compra[c]) compra[c] = { cbzs: 0, tropas: 0 }; compra[c].cbzs += cbz; compra[c].tropas++; }
        }
        const topV = Object.entries(venta).map(([s,d])=>({soc:s,...d})).sort((a,b)=>b.cbzs-a.cbzs).slice(0,12);
        const topC = Object.entries(compra).map(([s,d])=>({soc:s,...d})).sort((a,b)=>b.cbzs-a.cbzs).slice(0,12);
        return { venta: topV, compra: topC };
    }, [concretadas]);

    // Years available
    const hoy = new Date();
    const years = Array.from({ length: 5 }, (_, i) => hoy.getFullYear() - i);

    return (
      <>
        <div className="min-h-screen bg-[#080f1e] text-white rounded-2xl overflow-hidden shadow-2xl" style={{ fontFamily: 'var(--font-inter, Inter, sans-serif)' }}>
            <div className="p-4 sm:px-6 sm:py-6 space-y-6">
                
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                        <span className="text-amber-400">🔬</span> Insights de Mercado
                    </h1>
                </div>
                {loading && (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="relative w-12 h-12">
                            <svg className="animate-spin text-white/10 w-full h-full absolute" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/></svg>
                            <svg className="animate-spin text-amber-400 w-full h-full absolute" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="16 40" d="M12 2a10 10 0 1010 10"/></svg>
                        </div>
                        <p className="text-white/70 text-sm font-semibold">Cargando datos de mercado…</p>
                        <p className="text-white/30 text-xs max-w-xs text-center">La primera carga puede tardar hasta 20 segundos mientras se consulta la base de datos. Las siguientes serán instantáneas.</p>
                    </div>
                )}
                {error && <div className="bg-rose-900/40 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-sm">{error}</div>}

                {!loading && !error && <>
                    {/* ── Summary Cards ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Tropas concretadas', value: fmt(summary.count), icon: '🤝', sub: MESES[selectedMes] + ' ' + selectedYear },
                            { label: 'Cabezas totales', value: fmt(summary.totalCbzs), icon: '🐄', sub: `~${fmt(Math.round(summary.totalCbzs / Math.max(1, summary.count)))} prom` },
                            { label: 'Kg prom / cab', value: summary.kgProm > 0 ? `${Math.round(summary.kgProm)} kg` : '—', icon: '⚖️', sub: 'peso promedio' },
                            { label: 'Zonas activas', value: summary.zonas, icon: '📍', sub: `${summary.socs} sociedades` },
                        ].map(c => (
                            <div key={c.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">{c.icon} {c.label}</p>
                                <p className="text-2xl sm:text-3xl font-black text-white leading-none">{c.value}</p>
                                <p className="text-[10px] text-white/30 mt-1">{c.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── Tabs ── */}
                    <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
                        {([
                            ['heatmaps', '🔥 Mapas de Calor'],
                            ['zonas', '📍 Top Zonas'],
                            ['compradores', '🛒 Compradores'],
                            ['sociedades', '🏢 Sociedades'],
                        ] as const).map(([tab, label]) => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-amber-400 text-amber-400' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* ── HEATMAPS TAB ── */}
                    {activeTab === 'heatmaps' && (
                        <div className="space-y-6">
                            {/* Heatmap 1: Origen x Categoria */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                <div className="px-5 py-4 border-b border-white/10">
                                    <h2 className="text-sm font-black text-white uppercase tracking-wider">🌎 Origen × Categoría — Volumen de Cabezas</h2>
                                    <p className="text-[11px] text-white/60 mt-1 leading-relaxed max-w-2xl">
                                        <strong className="text-white/80">¿Qué muestra?</strong> El volumen total de cabezas concretadas cruzando la <strong className="text-amber-300">provincia de origen</strong> de cada tropa (filas) con su <strong className="text-amber-300">categoría de negocio</strong> (columnas).
                                    </p>
                                    <div className="flex flex-wrap gap-4 mt-2 text-[10px] text-white/40">
                                        <span>📍 <strong className="text-white/60">Fila</strong> = provincia de origen (abrev.)</span>
                                        <span>🏷️ <strong className="text-white/60">Columna</strong> = categoría UN (Faena, Invernada…)</span>
                                        <span>🔢 <strong className="text-white/60">Celda</strong> = cabezas operadas en ese cruce</span>
                                        <span>🌡️ <strong className="text-white/60">Color</strong> azul → naranja → rojo = mayor volumen</span>
                                        <span>📅 <strong className="text-white/60">Fecha</strong> operación (fecha_operacion)</span>
                                    </div>
                                </div>
                                <div className="p-4 overflow-x-auto">
                                    {hm1.provs.length === 0 ? (
                                        <p className="text-center text-white/30 text-sm py-8">Sin datos para el período seleccionado</p>
                                    ) : (
                                        <table className="w-full text-xs border-collapse" style={{ minWidth: 480 }}>
                                            <thead>
                                                <tr>
                                                    <th className="text-left text-[9px] font-black text-white/30 uppercase tracking-wider py-1 pr-3 w-16">Zona</th>
                                                    {CATS.map(cat => (
                                                        <th key={cat} className="text-center text-[9px] font-black text-white/50 uppercase tracking-wider pb-2 px-1">
                                                            <span className={`inline-block px-1.5 py-0.5 rounded text-white text-[8px] ${CAT_COLOR[cat] || 'bg-gray-500'}`}>{cat}</span>
                                                        </th>
                                                    ))}
                                                    <th className="text-[9px] text-white/30 uppercase px-1">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {hm1.provs.map(prov => {
                                                    const rowTotal = CATS.reduce((s, c) => s + (hm1.map[prov]?.[c] || 0), 0);
                                                    return (
                                                        <tr key={prov} className="border-t border-white/5">
                                                            <td className="py-1.5 pr-3 font-black text-white/80 text-[11px] whitespace-nowrap">{prov}</td>
                                                            {CATS.map(cat => {
                                                                const v = hm1.map[prov]?.[cat] || 0;
                                                                const bg = heatColor(v, hm1.maxVal);
                                                                const tc = heatTextColor(v, hm1.maxVal);
                                                                return (
                                                                    <td key={cat} className="px-1 py-1 text-center">
                                                                        <button
                                                                            onClick={() => v > 0 && setDrillDown({ type: 'hm1', prov, cat })}
                                                                            disabled={v === 0}
                                                                            className={`w-full rounded-lg py-2 px-1 transition-all font-bold text-xs ${v > 0 ? 'hover:scale-110 hover:ring-2 hover:ring-white/40 cursor-pointer active:scale-95' : 'cursor-default'}`}
                                                                            style={{ backgroundColor: bg, color: tc, minWidth: 56 }}
                                                                            title={v > 0 ? `${prov} · ${cat}: ${fmt(v)} cab — click para ver tropas` : undefined}
                                                                        >
                                                                            {v > 0 ? fmt(v) : <span className="text-white/15">—</span>}
                                                                        </button>
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="px-1 text-center font-black text-white/60 text-[11px]">{fmt(rowTotal)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                                {/* Legend */}
                                <div className="px-5 pb-4 flex items-center gap-3">
                                    <span className="text-[9px] text-white/30 uppercase tracking-wider">Intensidad:</span>
                                    {[0.1, 0.3, 0.55, 0.8, 1].map(r => (
                                        <div key={r} className="w-6 h-4 rounded" style={{ backgroundColor: heatColor(r, 1) }} />
                                    ))}
                                    <span className="text-[9px] text-white/30">↑ mayor volumen</span>
                                </div>
                            </div>

                            {/* Heatmap 2: Kg/cab x Cabezas */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                <div className="px-5 py-4 border-b border-white/10">
                                    <h2 className="text-sm font-black text-white uppercase tracking-wider">⚖️ Kg/cabeza × Tamaño de Tropa — Concentración</h2>
                                    <p className="text-[11px] text-white/60 mt-1 leading-relaxed max-w-2xl">
                                        <strong className="text-white/80">¿Qué muestra?</strong> Dónde se concentran las tropas según su <strong className="text-amber-300">peso promedio por cabeza</strong> y su <strong className="text-amber-300">tamaño en cabezas</strong>. Permite ver qué perfil productivo domina el mercado.
                                    </p>
                                    <div className="flex flex-wrap gap-4 mt-2 text-[10px] text-white/40">
                                        <span>⬆️ <strong className="text-white/60">Fila (Y)</strong> = rango de kg/cabeza prom. de la tropa</span>
                                        <span>➡️ <strong className="text-white/60">Columna (X)</strong> = rango de cabezas por tropa</span>
                                        <span>🔢 <strong className="text-white/60">Celda</strong> = nº de tropas en ese cruce de rangos</span>
                                        <span>🌡️ <strong className="text-white/60">Color</strong> = mayor concentración de tropas</span>
                                        <span>💡 <strong className="text-white/60">Utildad</strong> Identificar combos peso-tamaño más frecuentes</span>
                                    </div>
                                </div>
                                <div className="p-4 overflow-x-auto">
                                    <table className="w-full text-xs border-collapse" style={{ minWidth: 420 }}>
                                        <thead>
                                            <tr>
                                                <th className="text-left text-[9px] font-black text-white/30 uppercase tracking-wider py-1 pr-4 w-20">kg/cab ↓</th>
                                                {CBZ_BINS.map(b => (
                                                    <th key={b.label} className="text-center text-[10px] font-black text-white/50 pb-2 px-1">{b.label} cbz</th>
                                                ))}
                                                <th className="text-[9px] text-white/30 px-1">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {KG_BINS.map((kgBin, ki) => {
                                                const rowTotal = hm2.matrix[ki].reduce((s, v) => s + v, 0);
                                                return (
                                                    <tr key={kgBin.label} className="border-t border-white/5">
                                                        <td className="py-1.5 pr-4 font-black text-amber-300/80 text-[11px] whitespace-nowrap">{kgBin.label} kg</td>
                                                        {hm2.matrix[ki].map((v, ci) => {
                                                            const bg = heatColor(v, hm2.maxVal);
                                                            const tc = heatTextColor(v, hm2.maxVal);
                                                            return (
                                                                <td key={ci} className="px-1 py-1 text-center">
                                                                    <button
                                                                        onClick={() => v > 0 && setDrillDown({ type: 'hm2', kgLabel: kgBin.label, cbzLabel: CBZ_BINS[ci].label, ki, ci })}
                                                                        disabled={v === 0}
                                                                        className={`w-full rounded-lg py-2 px-1 transition-all font-bold text-xs ${v > 0 ? 'hover:scale-110 hover:ring-2 hover:ring-white/40 cursor-pointer active:scale-95' : 'cursor-default'}`}
                                                                        style={{ backgroundColor: bg, color: tc, minWidth: 48 }}
                                                                        title={v > 0 ? `${kgBin.label} kg · ${CBZ_BINS[ci].label} cbz: ${v} tropas — click para ver detalle` : undefined}
                                                                    >
                                                                        {v > 0 ? v : <span className="text-white/15">—</span>}
                                                                    </button>
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-1 text-center font-black text-white/60 text-[11px]">{rowTotal}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── ZONAS TAB ── */}
                    {activeTab === 'zonas' && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-white/10">
                                <h2 className="text-sm font-black text-white uppercase tracking-wider">📍 Top Zonas por Volumen</h2>
                                <p className="text-[10px] text-white/40 mt-0.5">Ordenado por cabezas totales concretadas</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="border-b border-white/10">
                                        <tr>
                                            {['#', 'Zona', 'Tropas', 'Cabezas', 'Kg prom', 'Kg máx', 'Categoría top'].map(h => (
                                                <th key={h} className="text-left text-[9px] font-black text-white/30 uppercase tracking-wider px-4 py-3">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {topZonas.map((z, i) => (
                                            <tr key={z.zona} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-2.5 font-black text-white/30 text-[10px]">{i + 1}</td>
                                                <td className="px-4 py-2.5 font-black text-white text-sm">{z.zona}</td>
                                                <td className="px-4 py-2.5 text-white/70 font-semibold">{z.tropas}</td>
                                                <td className="px-4 py-2.5 font-black text-amber-300">{fmt(z.cbzs)}</td>
                                                <td className="px-4 py-2.5 text-white/70">{z.kgProm > 0 ? `${Math.round(z.kgProm)} kg` : '—'}</td>
                                                <td className="px-4 py-2.5 text-white/70">{z.kgMax > 0 ? `${Math.round(z.kgMax)} kg` : '—'}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full text-white ${CAT_COLOR[z.topCat] || 'bg-gray-500'}`}>{z.topCat}</span>
                                                </td>
                                            </tr>
                                        ))}
                                        {topZonas.length === 0 && (
                                            <tr><td colSpan={7} className="px-4 py-10 text-center text-white/30 text-sm">Sin datos</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── COMPRADORES + VENDEDORES TAB ── */}
                    {activeTab === 'compradores' && (
                        <div className="space-y-6">
                            {/* Filtro de categoría compartido */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Categoría:</span>
                                {CATS.map(cat => (
                                    <button key={cat} onClick={() => setActiveCat(cat)}
                                        className={`text-[9px] font-black px-2.5 py-1 rounded-full transition-all ${activeCat === cat ? `${CAT_COLOR[cat] || 'bg-gray-500'} text-white scale-105` : 'bg-white/10 text-white/50 hover:text-white'}`}>
                                        {cat}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Compradores */}
                                {[{ title: '🛒 Top Compradores', data: topCompradores, color: 'text-blue-400' },
                                  { title: '🤝 Top Vendedores', data: topVendedores, color: 'text-emerald-400' }]
                                .map(({ title, data, color }) => (
                                    <div key={title} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                        <div className="px-5 py-4 border-b border-white/10">
                                            <h3 className="text-sm font-black text-white uppercase tracking-wider">{title} — {activeCat}</h3>
                                            <p className="text-[10px] text-white/40 mt-0.5">Por cabezas totales</p>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead className="border-b border-white/10">
                                                    <tr>
                                                        {['#', 'Sociedad', 'Tropas', 'Cabezas', '%'].map(h => (
                                                            <th key={h} className="text-left text-[9px] font-black text-white/30 uppercase tracking-wider px-4 py-3">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {data.map((c, i) => {
                                                        const maxCbz = data[0]?.cbzs || 1;
                                                        const pct = Math.round((c.cbzs / maxCbz) * 100);
                                                        return (
                                                            <tr key={c.soc} className="hover:bg-white/5 transition-colors">
                                                                <td className="px-4 py-2.5 font-black text-white/30 text-[10px]">{i + 1}</td>
                                                                <td className="px-4 py-2.5 font-semibold text-white text-sm max-w-[180px] truncate">{c.soc}</td>
                                                                <td className="px-4 py-2.5 text-white/70">{c.tropas}</td>
                                                                <td className={`px-4 py-2.5 font-black ${color}`}>{fmt(c.cbzs)}</td>
                                                                <td className="px-4 py-2.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden" style={{ minWidth: 40 }}>
                                                                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                                                                        </div>
                                                                        <span className="text-[10px] text-white/50">{pct}%</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {data.length === 0 && (
                                                        <tr><td colSpan={5} className="px-4 py-10 text-center text-white/30 text-sm">Sin datos para {activeCat}</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── SOCIEDADES TAB ── */}
                    {activeTab === 'sociedades' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {([
                                { title: '🤝 Top Vendedoras', data: topSociedades.venta, color: 'text-emerald-400' },
                                { title: '🛒 Top Compradoras', data: topSociedades.compra, color: 'text-blue-400' },
                            ] as const).map(({ title, data, color }) => (
                                <div key={title} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                    <div className="px-5 py-4 border-b border-white/10">
                                        <h2 className="text-sm font-black text-white uppercase tracking-wider">{title}</h2>
                                        <p className="text-[10px] text-white/40 mt-0.5">Ordenado por cabezas totales</p>
                                    </div>
                                    <div className="divide-y divide-white/5">
                                        {data.map((s, i) => {
                                            const maxCbz = data[0]?.cbzs || 1;
                                            return (
                                                <div key={s.soc} className="px-5 py-2.5 hover:bg-white/5 transition-colors flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-white/20 w-4">{i + 1}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-semibold text-white truncate">{s.soc}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full bg-amber-400"
                                                                    style={{ width: `${Math.round((s.cbzs / maxCbz) * 100)}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className={`text-sm font-black ${color}`}>{fmt(s.cbzs)}</p>
                                                        <p className="text-[9px] text-white/30">{s.tropas} tropas</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {data.length === 0 && (
                                            <p className="px-5 py-10 text-center text-white/30 text-sm">Sin datos</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>}
            </div>
        </div>

        {/* ── Drill-down panel ── */}
        {drillDown && (() => {
            const dd = drillDown;
            const hm1Title = dd.type === 'hm1' ? `${dd.prov} · ${dd.cat}` : null;
            const hm2Title = dd.type === 'hm2' ? `${dd.kgLabel} kg/cab · ${dd.cbzLabel} cabezas` : null;
            const title = hm1Title ?? hm2Title ?? '';
            return (
              <>
                <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40" onClick={() => setDrillDown(null)} />
                <div className="fixed right-0 top-0 h-full w-full max-w-lg z-50 flex flex-col bg-[#0d1b2e] border-l border-white/10 shadow-2xl">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0a1628]">
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <span>🔍</span> {title}
                            </h2>
                            <p className="text-[10px] text-white/40 mt-0.5">
                                {drillTropas.length} tropas · {fmt(drillTropas.reduce((s, t) => s + (Number(t.Cabezas) || 0), 0))} cabezas
                            </p>
                        </div>
                        <button onClick={() => setDrillDown(null)}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-lg transition-colors">
                            ×
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {drillTropas.length === 0 ? (
                            <p className="text-center text-white/30 text-sm py-12">Sin tropas en este rango</p>
                        ) : [...drillTropas]
                            .sort((a, b) => (Number(b.Cabezas) || 0) - (Number(a.Cabezas) || 0))
                            .map((t, i) => {
                                const un = getUN(t);
                                const cbz = Number(t.Cabezas) || 0;
                                const kg = Number(t.kg) || 0;
                                const fecha = (t.fecha_operacion || '').split('T')[0];
                                return (
                                    <div key={`${t.id_lote}-${i}`} className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-amber-400/30 transition-all">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black text-white/30">#{t.id_lote || '—'}</span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${CAT_COLOR[un] || 'bg-gray-500'}`}>{un}</span>
                                                    {kg > 0 && <span className="text-[9px] text-amber-300 font-semibold">{kg} kg/cab</span>}
                                                </div>
                                                <p className="text-[12px] font-semibold text-white truncate">{t.RS_Vendedora || '—'}</p>
                                                <p className="text-[10px] text-white/50 truncate">→ {t.RS_Compradora || '—'}</p>
                                                <p className="text-[9px] text-white/30 mt-1">
                                                    {getProvincia(t.origen)}{t.origen ? ` · ${t.origen.split(',')[0]}` : ''}
                                                    {fecha && <span className="ml-2">📅 {fecha}</span>}
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0 text-right">
                                                <p className="text-xl font-black text-amber-300">{fmt(cbz)}</p>
                                                <p className="text-[9px] text-white/30">cab</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                    <div className="border-t border-white/10 px-5 py-3 bg-[#0a1628] flex items-center justify-between">
                        <span className="text-[10px] text-white/30 uppercase tracking-wider">Total</span>
                        <span className="text-lg font-black text-amber-300">
                            {fmt(drillTropas.reduce((s, t) => s + (Number(t.Cabezas) || 0), 0))} <span className="text-xs font-semibold text-white/30">cabezas</span>
                        </span>
                    </div>
                </div>
              </>
            );
        })()}
      </>
    );
}
