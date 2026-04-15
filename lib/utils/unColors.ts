// ─── Colores canónicos por Unidad de Negocio ────────────────────────────────
// Una sola fuente de verdad usada en KPIsRio4, EvolucionAnual, UNMatrix, etc.

export const UN_HEX: Record<string, string> = {
    Faena:     '#3B82F6', // blue-500
    Invernada: '#B91C1C', // red-700
    MAG:       '#22C55E', // green-500
    'Inv. Neo':'#EF4444', // red-500
    Cría:      '#EAB308', // yellow-500
};

// Para Tailwind (breakdowns, badges, barras horizontales)
export const UN_BG: Record<string, string> = {
    Faena:     'bg-blue-500',
    Invernada: 'bg-red-700',
    MAG:       'bg-green-500',
    'Inv. Neo':'bg-red-500',
    Cría:      'bg-yellow-400',
};

export const UN_LIST = ['Faena', 'Invernada', 'MAG', 'Inv. Neo', 'Cría'];

// Helper: dada una cadena bruta de UN, devuelve la clave normalizada
export function normalizeUN(un: string): string {
    if (!un) return 'Otros';
    const u = un.toUpperCase().trim();
    if (u === 'FAENA' || u === 'FAE') return 'Faena';
    if (u === 'INVERNADA' || u === 'INV') return 'Invernada';
    if (u === 'INVERNADA NEO') return 'Inv. Neo';
    if (u === 'CRÍA' || u === 'CRIA') return 'Cría';
    if (u === 'MAG') return 'MAG';
    return un.trim() || 'Otros';
}
