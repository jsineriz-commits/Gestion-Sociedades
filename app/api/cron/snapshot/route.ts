/**
 * app/api/cron/snapshot/route.ts
 * Genera el snapshot histórico de Q95 (datos con fecha_operacion < cutoff = hoy - 90 días).
 *
 * Llamar semanalmente via cron: GET /api/cron/snapshot?secret=CRON_SECRET
 * También se puede forzar manualmente con ?force=true
 */

import { NextRequest, NextResponse } from 'next/server';
import { formatMetabaseData } from '@/lib/api/metabase-server';
import {
    getCutoffDate,
    writeSnapshot,
    buildAgregaciones,
    type SnapshotRow,
} from '@/lib/utils/snapshot';

const CRON_SECRET = (process.env.CRON_SECRET || 'dcac-cron-2026').trim();

// ─── Auth MB2 ─────────────────────────────────────────────────────────────────
async function getToken2(): Promise<string> {
    const r = await fetch(`${(process.env.METABASE2_URL || '').trim()}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: (process.env.METABASE2_USERNAME || '').trim(),
            password: (process.env.METABASE2_PASSWORD || '').trim(),
        }),
    });
    const { id } = await r.json();
    return id;
}

// ─── Query Q95 para rango histórico ──────────────────────────────────────────
async function fetchHistorico(token: string, desde: string, hasta: string): Promise<any[]> {
    const params = [
        { type: 'date/single', target: ['variable', ['template-tag', 'fecha_desde']], value: desde },
        { type: 'date/single', target: ['variable', ['template-tag', 'fecha_hasta']],  value: hasta },
    ];
    const res = await fetch(`${process.env.METABASE2_URL}/api/card/95/query/json?format_rows=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
        body: JSON.stringify({ parameters: params }),
    });
    if (!res.ok) throw new Error(`Q95 HTTP ${res.status}`);
    const data: any[] = await res.json();
    if (!Array.isArray(data)) throw new Error(`Q95: respuesta inesperada`);
    return data;
}

// ─── Normalizar fila a SnapshotRow (solo campos esenciales) ──────────────────
function toSnapshotRow(r: any): SnapshotRow {
    const res_final = Number(r.resultado_final) || 0;
    const hasAcVend = r.AC_Vend && String(r.AC_Vend).trim();
    const hasAcComp = r.AC_Comp && String(r.AC_Comp).trim();
    const hasRepVOfi = r.repre_vendedor && String(r.repre_vendedor).includes('Oficina');
    const hasRepCOfi = r.repre_comprador && String(r.repre_comprador).includes('Oficina');
    return {
        id_lote:          Number(r.id_lote),
        fecha_operacion:  r.fecha_operacion ? String(r.fecha_operacion).split('T')[0] : '',
        Fecha_op:         r.Fecha_op || '',
        Tipo:             r.Tipo || '',
        UN:               r.UN || '',
        RS_Vendedora:     r.RS_Vendedora || '',
        RS_Compradora:    r.RS_Compradora || '',
        Cabezas:          Number(r.Cabezas) || 0,
        importe_vendedor:  Number(r.importe_vendedor) || 0,
        importe_comprador: Number(r.importe_comprador) || 0,
        resultado_final:  res_final,
        resultado_regional_vendedor:  (hasAcVend || hasRepVOfi) ? res_final * (2 / 3) : 0,
        resultado_regional_comprador: (hasAcComp || hasRepCOfi) ? res_final * (1 / 3) : 0,
        estado_general:   r.ESTADO || r.estado_general || '',
        estado_tropas:    r.Estado_Trop || r.estado_tropas || '',
        AC_Vend:          r.AC_Vend || '',
        AC_Comp:          r.AC_Comp || '',
        repre_vendedor:   r.repre_vendedor || '',
        repre_comprador:  r.repre_comprador || '',
        Canal_Venta:      r.Canal_Venta || '',
        Canal_compra:     r.Canal_compra || '',
        Motivo_NC:        r.Motivo_NC || '',
        cuit_vend:        String(r.cuit_vend || ''),
        cuit_comp:        String(r.cuit_comp || ''),
        Cierre:           Number(r.Cierre) || 0,
        ACT_CI:           r.ACT_CI || '',
        YAER:             Number(r.YAER) || 0,
        Trimestre:        r.Trimestre || '',
        numero_semana:    Number(r.numero_semana) || 0,
        id_ac_vend:       Number(r.id_ac_vend) || 0,
        id_ac_comp:       Number(r.id_ac_comp) || 0,
        id_rep_vend:      Number(r.id_rep_vend) || 0,
        id_rep_comp:      Number(r.id_rep_comp) || 0,
    };
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    // Autenticación por secret
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const cutoff = getCutoffDate();                          // hoy - 90 días
        const desde  = '2023-01-01';                            // inicio del histórico
        const t0     = Date.now();

        console.log(`[Snapshot] Generando histórico desde ${desde} hasta ${cutoff}...`);
        const token = await getToken2();
        const rawRows = await fetchHistorico(token, desde, cutoff);

        const rows = rawRows.map(toSnapshotRow);
        const { por_mes, por_semana, por_trimestre, por_anio } = buildAgregaciones(rows);

        await writeSnapshot({
            generado_at:   new Date().toISOString(),
            cutoff_date:   cutoff,
            rows,
            por_mes,
            por_semana,
            por_trimestre,
            por_anio,
        });

        const ms = Date.now() - t0;
        console.log(`[Snapshot] ✅ ${rows.length} filas guardadas en ${ms}ms`);

        return NextResponse.json({
            ok:           true,
            filas:        rows.length,
            cutoff,
            desde,
            periodos_mes: Object.keys(por_mes).length,
            ms,
        });
    } catch (err: any) {
        console.error('[Snapshot] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
