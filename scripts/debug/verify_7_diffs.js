const fs = require('fs');

async function scan() {
    const env = fs.readFileSync('.env.local', 'utf8');
    const token2Def = env.match(/METABASE2_PASSWORD=([^\n\r]+)/);
    const userDef = env.match(/METABASE2_USERNAME=([^\n\r]+)/);
    const urlDef = env.match(/METABASE2_URL=([^\n\r]+)/);

    if (!token2Def || !userDef || !urlDef) throw new Error('Missing env vars');
    const token2 = token2Def[1].trim();
    const user = userDef[1].trim();
    const url = urlDef[1].trim();

    // 1. Get token
    const resAuth = await fetch(url+'/api/session', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, password: token2})
    });
    const { id: token } = await resAuth.json();

    // 2. Query Dashboard Client style (2025 to 2026)
    const p1 = [{ type: 'date/single', target: ['variable', ['template-tag', 'fecha_desde']], value: '2025-01-01' },
                { type: 'date/single', target: ['variable', ['template-tag', 'fecha_hasta']], value: '2026-12-31' }];
    const res1 = await fetch(url+'/api/card/95/query/json?format_rows=false', {
        method: 'POST', headers: {'Content-Type': 'application/json', 'X-Metabase-Session': token},
        body: JSON.stringify({parameters: p1})
    });
    const data1Raw = await res1.json();
    const data1 = data1Raw.map(r => {
        let out = {...r};
        out.estado_general = r.ESTADO || r.estado_general || null;
        return out;
    });

    // 3. Query EstadoTropas style (2026 to 2026)
    const p2 = [{ type: 'date/single', target: ['variable', ['template-tag', 'fecha_desde']], value: '2026-01-01' },
                { type: 'date/single', target: ['variable', ['template-tag', 'fecha_hasta']], value: '2026-03-26' }];
    const res2 = await fetch(url+'/api/card/95/query/json?format_rows=false', {
        method: 'POST', headers: {'Content-Type': 'application/json', 'X-Metabase-Session': token},
        body: JSON.stringify({parameters: p2})
    });
    const data2Raw = await res2.json();
    const data2 = data2Raw.map(r => {
        let out = {...r};
        out.estado_general = r.ESTADO || r.estado_general || null;
        return out;
    });

    // Apply dashboard filter to data1
    const opsFiltered = data1.filter(o => {
        const ds = o.fecha_operacion || o.Fecha_Operacion || o.Fecha;
        if (!ds) return false;
        const d = new Date(ds);
        if (isNaN(d.getTime())) return false;
        if (d.getFullYear() !== 2026) return false;
        const cutoff = new Date(2026, 2, 26, 23, 59, 59); // March 26
        return d >= new Date(2026, 0, 1) && d <= cutoff;
    });

    const conc1 = opsFiltered.filter(o => (o.estado_general || '').toUpperCase() === 'CONCRETADA');
    const conc2 = data2.filter(o => (o.estado_general || '').toUpperCase() === 'CONCRETADA');

    console.log('Concretadas DashboardClient (front filter):', conc1.length);
    console.log('Concretadas EstadoTropas (backend filter):', conc2.length);

    // Find the missing ones!
    const ids1 = new Set(conc1.map(o => String(o.id_lote)));
    const missing = conc2.filter(o => !ids1.has(String(o.id_lote)));
    console.log('\n--- MISSING TROPAS IN DASHBOARD FROM ESTADO TROPAS ---');
    console.log('Total:', missing.length);
    missing.forEach(m => {
        console.log(`Lote: ${m.id_lote} | fecha_operacion: ${m.fecha_operacion || 'NULL'} | Fecha_Operacion: ${m.Fecha_Operacion || 'NULL'} | FECHA: ${m.Fecha} | Cabezas: ${m.Cabezas}`);
    });

    const ids2 = new Set(conc2.map(o => String(o.id_lote)));
    const missingInTropa = conc1.filter(o => !ids2.has(String(o.id_lote)));
    console.log('\n--- MISSING IN ESTADO TROPAS FROM DASHBOARD ---');
    console.log('Total:', missingInTropa.length);
    missingInTropa.forEach(m => {
        console.log(`Lote: ${m.id_lote} | fecha_operacion: ${m.fecha_operacion}`);
    });

}
scan().catch(console.error);
