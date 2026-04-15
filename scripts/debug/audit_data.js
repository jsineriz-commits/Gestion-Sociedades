/**
 * audit_data.js — Diff concretadas Q95 vs 4553, YTD 2026
 * Uso: node audit_data.js
 */

const MB1 = { url: 'https://bi.decampoacampo.com', user: 'sdewey@decampoacampo.com', pass: 'Gallardo@25' };
const MB2 = { url: 'https://metabase.dcac.ar',      user: 'sdewey@decampoacampo.com', pass: '434N?EKJgng9ML' };

const CARD_OPS = 4553;
const CARD_Q95 = 95;
const hoy   = new Date().toISOString().split('T')[0];
const desde = `${new Date().getFullYear()}-01-01`;
const YEAR  = new Date().getFullYear();

const fNum = n => Number(n || 0).toLocaleString('es-AR');

// Normaliza estado de Q95 (igual que EstadoTropas.tsx)
function normalizeEstado(raw) {
    const u = (raw || '').toUpperCase().trim();
    if (u.includes('A CARGAR')) return 'A Cargar';
    if (u.includes('CARGAD') && !u.includes('A CARGAR') && !u.includes('DES')) return 'Cargadas';
    if (u.includes('A LIQUID')) return 'A Liquidar';
    if (u.includes('LIQUID') && !u.includes('A LIQUID')) return 'Liquidadas';
    if (u.includes('TERMIN') || u.includes('NEGOC')) return 'Negocios Terminados';
    if (u.includes('CERRAD')) return 'Cerrada';
    if (u.includes('VEND') && !u.includes('NO')) return 'Tropas Vendidas';
    if (u.includes('NO CONCRET') || u.includes('ANULAD')) return 'No Concretadas';
    if (u.includes('BAJA')) return 'Dadas de Baja';
    return raw || 'Sin Estado';
}

const ESTADOS_CONCRETADOS = new Set(['A Cargar','Cargadas','A Liquidar','Liquidadas','Negocios Terminados','Cerrada','Tropas Vendidas']);
const esConcretadaQ95  = raw => ESTADOS_CONCRETADOS.has(normalizeEstado(raw));
const esConcretada4553 = row => (row.estado_general || '').toUpperCase() === 'CONCRETADA';

// ─── Auth / query ─────────────────────────────────────────────────────────────
const tokens = {};
async function getToken(mb) {
    if (tokens[mb.url]) return tokens[mb.url];
    const r = await fetch(`${mb.url}/api/session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: mb.user, password: mb.pass }),
    });
    const { id } = await r.json();
    tokens[mb.url] = id;
    return id;
}

async function queryCard(mb, cardId, params = []) {
    const token = await getToken(mb);
    const res = await fetch(`${mb.url}/api/card/${cardId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
        body: JSON.stringify({ parameters: params, constraints: { 'max-results': 1_000_000 } }),
    });
    const raw = await res.json();
    if (raw.error) throw new Error(`Card ${cardId}: ${raw.error}`);
    const rows = raw?.data?.rows || raw?.rows || [];
    const cols = (raw?.data?.cols || raw?.cols || []).map(c => c.name || c);
    return rows.map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
}

const buildMap = (rows, idField) => {
    const m = new Map();
    rows.forEach(r => {
        const id = String(r[idField] ?? '').trim();
        if (!id || id === 'null') return;
        if (!m.has(id)) m.set(id, { rows: [], cab: 0 });
        const e = m.get(id);
        e.rows.push(r);
        e.cab += Number(r.Cabezas) || 0;
    });
    return m;
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n== DIFF CONCRETADAS YTD ${YEAR}: Q95 vs Card 4553 ==`);
    console.log(`   Período: ${desde} → ${hoy}\n`);

    console.log('⏳ Descargando datos...');
    const [q95All, ops4553All] = await Promise.all([
        queryCard(MB2, CARD_Q95, [
            { type: 'date/single', target: ['variable', ['template-tag', 'fecha_desde']], value: desde },
            { type: 'date/single', target: ['variable', ['template-tag', 'fecha_hasta']], value: hoy },
        ]),
        queryCard(MB1, CARD_OPS, []),
    ]);

    // 4553 trae todo sin filtro de fecha → filtrar por YEAR_OP
    const ops4553 = ops4553All.filter(r => Number(r.YEAR_OP) === YEAR);
    console.log(`✅ Q95: ${q95All.length} rows (filtrado por fecha en Metabase)`);
    console.log(`✅ 4553: ${ops4553All.length} rows al bajar → ${ops4553.length} rows del año ${YEAR}\n`);

    // Clasificar cada fuente
    const q95Conc   = q95All.filter(r => esConcretadaQ95(r.Estado_Trop || r.estado_tropas));
    const q95NoConc = q95All.filter(r => !esConcretadaQ95(r.Estado_Trop || r.estado_tropas));
    const opsConc   = ops4553.filter(r => esConcretada4553(r));
    const opsNoConc = ops4553.filter(r => !esConcretada4553(r));

    const totalCabQ95 = q95Conc.reduce((s, r) => s + (Number(r.Cabezas) || 0), 0);
    const totalCabOps = opsConc.reduce((s, r) => s + (Number(r.Cabezas) || 0), 0);

    // Mapas
    const q95ConcMap  = buildMap(q95Conc,   'id_lote');
    const opsConcMap  = buildMap(opsConc,   'id_lote');
    const q95NoConcMap = buildMap(q95NoConc, 'id_lote');
    const opsNoConcMap = buildMap(opsNoConc, 'id_lote');

    // ── RESUMEN ──────────────────────────────────────────────────────────────
    console.log('┌────────────────────────────────────────────────────┐');
    console.log('│ RESUMEN                                            │');
    console.log(`│ Q95  concretadas: ${String(q95ConcMap.size).padEnd(5)} IDs | ${fNum(totalCabQ95)} cab`.padEnd(51) + '│');
    console.log(`│ 4553 concretadas: ${String(opsConcMap.size).padEnd(5)} IDs | ${fNum(totalCabOps)} cab`.padEnd(51) + '│');
    console.log(`│ Diferencia IDs  : ${String(q95ConcMap.size - opsConcMap.size).padEnd(40)}│`);
    console.log(`│ Diferencia cab  : ${String(totalCabQ95 - totalCabOps).padEnd(40)}│`);
    console.log('└────────────────────────────────────────────────────┘');

    // ── A: En Q95 concretadas pero NO en 4553 concretadas ────────────────────
    const soloQ95 = [...q95ConcMap.keys()].filter(id => !opsConcMap.has(id));
    console.log(`\n━━━ A) Solo en Q95 concretadas: ${soloQ95.length} IDs ━━━`);
    if (soloQ95.length === 0) {
        console.log('   ✅ Ninguno');
    } else {
        console.log('  id_lote    | cab | estado Q95              | en 4553 como');
        console.log('  ──────────────────────────────────────────────────────────');
        soloQ95.forEach(id => {
            const eq = q95ConcMap.get(id);
            const r0 = eq.rows[0];
            const estQ95 = (r0.Estado_Trop || r0.estado_tropas || '?').padEnd(23);
            let en4553 = 'Ausente en 4553';
            if (opsNoConcMap.has(id)) {
                const ro = opsNoConcMap.get(id).rows[0];
                en4553 = `estado_general=${ro.estado_general || 'null'} | estado_tropas=${ro.estado_tropas || 'null'}`;
            }
            console.log(`  ${id.padEnd(10)} | ${String(eq.cab).padEnd(3)} | ${estQ95} | ${en4553}`);
        });
    }

    // ── B: En 4553 concretadas pero NO en Q95 concretadas ────────────────────
    const soloOps = [...opsConcMap.keys()].filter(id => !q95ConcMap.has(id));
    console.log(`\n━━━ B) Solo en 4553 concretadas: ${soloOps.length} IDs ━━━`);
    if (soloOps.length === 0) {
        console.log('   ✅ Ninguno');
    } else {
        console.log('  id_lote    | cab | AC_Vend              | en Q95 como');
        console.log('  ──────────────────────────────────────────────────────');
        soloOps.forEach(id => {
            const eo = opsConcMap.get(id);
            const r0 = eo.rows[0];
            const acV = (r0.AC_Vend || '—').padEnd(20);
            let enQ95 = 'Ausente en Q95';
            if (q95NoConcMap.has(id)) {
                enQ95 = `Q95: ${q95NoConcMap.get(id).rows[0].Estado_Trop || 'null'}`;
            }
            console.log(`  ${id.padEnd(10)} | ${String(eo.cab).padEnd(3)} | ${acV} | ${enQ95}`);
        });
    }

    // ── C: Mismos IDs, cabezas distintas ─────────────────────────────────────
    const ambos = [...q95ConcMap.keys()].filter(id => opsConcMap.has(id));
    const cabDiff = ambos
        .map(id => ({ id, cabQ95: q95ConcMap.get(id).cab, cabOps: opsConcMap.get(id).cab }))
        .filter(x => x.cabQ95 !== x.cabOps)
        .sort((a, b) => Math.abs(b.cabQ95 - b.cabOps) - Math.abs(a.cabQ95 - a.cabOps));

    console.log(`\n━━━ C) Mismos IDs, cabezas distintas: ${cabDiff.length} ━━━`);
    if (cabDiff.length === 0) {
        console.log('   ✅ Sin diferencias de cabezas en IDs compartidos');
    } else {
        console.log('  id_lote    | Q95 | 4553 | diff | estado Q95          | AC_Vend');
        console.log('  ────────────────────────────────────────────────────────────────');
        cabDiff.forEach(({ id, cabQ95, cabOps }) => {
            const diff = cabQ95 - cabOps;
            const r0q  = q95ConcMap.get(id).rows[0];
            const r04  = opsConcMap.get(id).rows[0];
            const est  = (r0q.Estado_Trop || r0q.estado_tropas || '?').padEnd(19);
            const acV  = (r04.AC_Vend || '—');
            console.log(`  ${id.padEnd(10)} | ${String(cabQ95).padEnd(3)} | ${String(cabOps).padEnd(4)} | ${(diff>0?'+':'')+diff}  | ${est} | ${acV}`);
        });
    }

    // ── Totales de diferencia de cabezas ─────────────────────────────────────
    const cabSoloQ95  = soloQ95.reduce((s, id) => s + q95ConcMap.get(id).cab, 0);
    const cabSoloOps  = soloOps.reduce((s, id) => s + opsConcMap.get(id).cab, 0);
    const cabDiffTotal = cabDiff.reduce((s, x) => s + (x.cabQ95 - x.cabOps), 0);

    console.log(`\n━━━ Desglose de la diferencia total de cabezas (${fNum(totalCabQ95 - totalCabOps)}) ━━━`);
    console.log(`  Solo en Q95    : +${fNum(cabSoloQ95)} cab`);
    console.log(`  Solo en 4553   : -${fNum(cabSoloOps)} cab`);
    console.log(`  Dif en comunes : ${cabDiffTotal >= 0 ? '+' : ''}${fNum(cabDiffTotal)} cab`);
    console.log(`  NETO           : ${fNum(cabSoloQ95 - cabSoloOps + cabDiffTotal)} cab`);

    console.log('\n✅ Auditoría completada\n');
}

main().catch(e => { console.error(e); process.exit(1); });
