export function normalizeEstado(raw: string): string {
    const u = raw.trim().toUpperCase();
    if (u.includes('PUBLI') || u === 'PUBLICADO' || u === 'PUBLICADA' || u === 'PUBLICADAS') return 'Publicadas';
    if (u.includes('OFREC') || u === 'OFRECIMIENTOS' || u === 'OFRECIMIENTO') return 'Ofrecimientos';
    if (u.includes('VENDI') || u.includes('TROPAS VENDIDAS') || u === 'VENDIDO' || u.includes('07_VENDIDO') || u.includes('07_VENDIDA')) return 'Tropas Vendidas';
    if (u === 'A CARGAR' || u === 'TROPAS A CARGAR' || u.includes('A CARGAR')) return 'A Cargar';
    if (u === 'CARGADAS' || u === 'TROPAS CARGADAS' || u.includes('CARGAD')) return 'Cargadas';
    if (u === 'FAENADAS' || u === 'FAENADA' || u.includes('FAENAD')) return 'Faenadas';
    if (u.includes('TERMINADO') || u.includes('TERMINAD')) return 'Negocios Terminados';
    if (u.includes('PAGOS VENCIDOS') || u.includes('VENCIDO')) return 'Pagos Vencidos';
    if (u.includes('NO CONCRET') || u.includes('ANULAD')) return 'No Concretadas';
    if (u.includes('CERRADA') || u.includes('CERRADOS') || u.includes('CERRADO')) return 'Cerrada';
    if (u.includes('BAJA')) return 'Dadas de Baja';
    if (u.includes('LIQUIDADA') || u === 'LIQUIDADAS') return 'Liquidadas';
    if (u.includes('LIQUIDAR')) return 'A Liquidar';
    return raw.trim() || 'Sin Estado';
}

export const ESTADO_CFG: Record<string, { icon: string; color: string; bg: string; ring: string; order: number }> = {
    'Publicadas':         { icon: '📢', color: 'text-purple-700',  bg: 'bg-purple-50',   ring: 'ring-purple-200',  order: -1 },
    'Ofrecimientos':      { icon: '👋', color: 'text-fuchsia-700', bg: 'bg-fuchsia-50',  ring: 'ring-fuchsia-200', order: 0 },
    'Tropas Vendidas':    { icon: '🤝', color: 'text-emerald-700', bg: 'bg-emerald-50',  ring: 'ring-emerald-200', order: 1 },
    'A Cargar':           { icon: '📥', color: 'text-sky-700',     bg: 'bg-sky-50',      ring: 'ring-sky-200',     order: 2 },
    'Cargadas':           { icon: '📦', color: 'text-blue-700',    bg: 'bg-blue-50',     ring: 'ring-blue-200',    order: 3 },
    'Faenadas':           { icon: '🥩', color: 'text-red-700',     bg: 'bg-red-50',      ring: 'ring-red-200',     order: 4 },
    'A Liquidar':         { icon: '⏳', color: 'text-amber-700',   bg: 'bg-amber-50',    ring: 'ring-amber-200',   order: 5 },
    'Pagos Vencidos':     { icon: '⚠️', color: 'text-orange-700',  bg: 'bg-orange-50',   ring: 'ring-orange-300',  order: 6 },
    'Liquidadas':         { icon: '💰', color: 'text-green-700',   bg: 'bg-green-50',    ring: 'ring-green-200',   order: 7 },
    'Negocios Terminados':{ icon: '🏁', color: 'text-slate-700',   bg: 'bg-slate-100',   ring: 'ring-slate-200',   order: 8 },
    'Cerrada':            { icon: '🔒', color: 'text-gray-600',    bg: 'bg-gray-100',    ring: 'ring-gray-200',    order: 9 },
    'No Concretadas':     { icon: '❌', color: 'text-rose-700',    bg: 'bg-rose-50',     ring: 'ring-rose-200',    order: 10 },
    'Dadas de Baja':      { icon: '🗑️', color: 'text-orange-700',  bg: 'bg-orange-50',   ring: 'ring-orange-200',  order: 11 },
    'Sin Estado':         { icon: '📋', color: 'text-gray-500',    bg: 'bg-gray-50',     ring: 'ring-gray-100',    order: 99 },
};
