/**
 * lib/snapshot.ts
 * Gestión del snapshot histórico de Q95.
 *
 * El snapshot almacena filas de Q95 con fecha_operacion anterior al corte (hoy - 90 días).
 * Se regenera semanalmente via /api/cron/snapshot.
 * Esto permite que la query en vivo a Q95 solo pida los últimos 3 meses.
 */

import fs from 'fs';
import path from 'path';
import { put, head } from '@vercel/blob';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface SnapshotRow {
    id_lote:           number;
    fecha_operacion:   string;       // 'YYYY-MM-DD'
    Fecha_op:          string;       // 'YYYYMM'
    Tipo:              string;
    UN:                string;
    RS_Vendedora:      string;
    RS_Compradora:     string;
    Cabezas:           number;
    importe_vendedor:  number;
    importe_comprador: number;
    resultado_final:   number;
    resultado_regional_vendedor: number;
    resultado_regional_comprador: number;
    estado_general:    string;
    estado_tropas:     string;
    AC_Vend:           string;
    AC_Comp:           string;
    repre_vendedor:    string;
    repre_comprador:   string;
    Canal_Venta:       string;
    Canal_compra:      string;
    Motivo_NC:         string;
    cuit_vend:         string;
    cuit_comp:         string;
    Cierre:            number;
    ACT_CI:            string;
    YAER:              number;
    Trimestre:         string;
    numero_semana:     number;
    id_ac_vend:        number;
    id_ac_comp:        number;
    id_rep_vend:       number;
    id_rep_comp:       number;
}

export interface SnapshotPeriod {
    tropas:           number;
    cabezas:          number;
    importe_vend:     number;
    importe_comp:     number;
    resultado:        number;
    concretadas:      number;
    no_concretadas:   number;
    bajas:            number;
}

export interface Snapshot {
    generado_at:  string;
    cutoff_date:  string;          // datos CON fecha_operacion < cutoff_date
    rows:         SnapshotRow[];
    // Pre-agrupaciones para comparaciones rápidas
    por_mes:       Record<string, SnapshotPeriod>;
    por_semana:    Record<string, SnapshotPeriod>;
    por_trimestre: Record<string, SnapshotPeriod>;
    por_anio:      Record<string, SnapshotPeriod>;
}

// ─── Ruta del archivo ─────────────────────────────────────────────────────────
const SNAPSHOT_PATH = path.join(process.cwd(), 'data', 'historico_snapshot.json');

// ─── Fecha de corte: hoy - 90 días ───────────────────────────────────────────
export function getCutoffDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
}

// ─── Leer snapshot ────────────────────────────────────────────────────────────
let _cached: Snapshot | null = null;
let _cachedAt = 0;
const MEMORY_TTL = 60 * 60 * 1000; // 1h en memoria

const BLOB_KEY       = 'historico_snapshot.json';
const IS_VERCEL_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

export async function readSnapshot(): Promise<Snapshot | null> {
    if (_cached && Date.now() - _cachedAt < MEMORY_TTL) return _cached;
    try {
        let raw: string;
        if (IS_VERCEL_BLOB) {
            const meta = await head(BLOB_KEY).catch(() => null);
            if (!meta) return null;
            const res = await fetch(meta.url, { cache: 'no-store' });
            if (!res.ok) return null;
            raw = await res.text();
        } else {
            if (!fs.existsSync(SNAPSHOT_PATH)) return null;
            raw = fs.readFileSync(SNAPSHOT_PATH, 'utf-8');
        }
        _cached = JSON.parse(raw) as Snapshot;
        _cachedAt = Date.now();
        return _cached;
    } catch {
        return null;
    }
}

// ─── Escribir snapshot ────────────────────────────────────────────────────────
export async function writeSnapshot(snap: Snapshot): Promise<void> {
    const json = JSON.stringify(snap);
    _cached = snap;
    _cachedAt = Date.now();
    if (IS_VERCEL_BLOB) {
        await put(BLOB_KEY, json, {
            access: 'public',
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: 'application/json',
        });
    } else {
        const dir = path.dirname(SNAPSHOT_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SNAPSHOT_PATH, json, 'utf-8');
    }
}

// ─── Generar pre-agrupaciones ─────────────────────────────────────────────────
function emptyPeriod(): SnapshotPeriod {
    return { tropas: 0, cabezas: 0, importe_vend: 0, importe_comp: 0, resultado: 0, concretadas: 0, no_concretadas: 0, bajas: 0 };
}

function acumular(bucket: SnapshotPeriod, row: SnapshotRow) {
    bucket.tropas++;
    bucket.cabezas     += row.Cabezas || 0;
    bucket.importe_vend += row.importe_vendedor || 0;
    bucket.importe_comp += row.importe_comprador || 0;
    bucket.resultado    += row.resultado_final || 0;
    const eg = (row.estado_general || '').toUpperCase();
    if (eg === 'CONCRETADA')    bucket.concretadas++;
    else if (eg === 'NO CONCRETADAS' || eg === 'BAJA') bucket.no_concretadas++;
    if ((row.estado_general || '').toUpperCase() === 'BAJA') bucket.bajas++;
}

export function buildAgregaciones(rows: SnapshotRow[]) {
    const por_mes:       Record<string, SnapshotPeriod> = {};
    const por_semana:    Record<string, SnapshotPeriod> = {};
    const por_trimestre: Record<string, SnapshotPeriod> = {};
    const por_anio:      Record<string, SnapshotPeriod> = {};

    for (const row of rows) {
        const mes = row.Fecha_op || '';          // '202601'
        const sem = `${row.YAER || ''}S${String(row.numero_semana || '').padStart(2, '0')}`;
        const tri = row.Trimestre ? `${row.YAER}${row.Trimestre}` : ''; // '2026Q1'
        const ani = String(row.YAER || '');

        if (mes) { if (!por_mes[mes]) por_mes[mes] = emptyPeriod(); acumular(por_mes[mes], row); }
        if (sem && sem !== 'S00') { if (!por_semana[sem]) por_semana[sem] = emptyPeriod(); acumular(por_semana[sem], row); }
        if (tri) { if (!por_trimestre[tri]) por_trimestre[tri] = emptyPeriod(); acumular(por_trimestre[tri], row); }
        if (ani) { if (!por_anio[ani]) por_anio[ani] = emptyPeriod(); acumular(por_anio[ani], row); }
    }

    return { por_mes, por_semana, por_trimestre, por_anio };
}

export function filterSnapshotByAc(snap: Snapshot, acId?: number, acName?: string | null): SnapshotRow[] {
    if (!acId && !acName) return snap.rows;
    
    const uname = acName?.toLowerCase().trim();

    return snap.rows.filter(r => {
        if (acId && (
            r.id_ac_vend === acId ||
            r.id_ac_comp === acId ||
            r.id_rep_vend === acId ||
            r.id_rep_comp === acId
        )) return true;
        
        if (uname) {
            if (r.AC_Vend?.toLowerCase().trim() === uname ||
                r.AC_Comp?.toLowerCase().trim() === uname ||
                r.repre_vendedor?.toLowerCase().trim() === uname ||
                r.repre_comprador?.toLowerCase().trim() === uname) {
                return true;
            }
        }
        return false;
    });
}
