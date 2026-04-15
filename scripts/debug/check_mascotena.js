const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').filter(Boolean).forEach(line => {
    let [key, ...vals] = line.split('=');
    if (key && vals.length > 0) {
        let v = vals.join('=').trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.substring(1, v.length - 1);
        if (v.startsWith("'") && v.endsWith("'")) v = v.substring(1, v.length - 1);
        process.env[key.trim()] = v;
    }
});

const MASCOTENA_ID = 117393;
const ACUNA_ID     = 20128;
const YEAR         = new Date().getFullYear();

async function getSession(url, user, pass) {
    const r = await fetch(`${url}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
    });
    const d = await r.json();
    return d.id;
}

async function queryQ95(url, token, idUsuario) {
    const params = [
        { type: 'category', target: ['variable', ['template-tag', 'fecha_desde']], value: `${YEAR}-01-01` },
        { type: 'category', target: ['variable', ['template-tag', 'fecha_hasta']], value: `${YEAR}-12-31` },
    ];
    if (idUsuario) {
        params.push({ type: 'category', target: ['variable', ['template-tag', 'id_usuario']], value: String(idUsuario) });
    }

    const r = await fetch(`${url}/api/card/95/query/json?format_rows=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
        body: JSON.stringify({ parameters: params }),
    });
    const data = await r.json();
    return Array.isArray(data) ? data : [];
}

async function main() {
    const url  = (process.env.METABASE2_URL || '').trim();
    const user = (process.env.METABASE2_USERNAME || '').trim();
    const pass = (process.env.METABASE2_PASSWORD || '').trim();

    console.log(`Conectando a ${url}...`);
    const token = await getSession(url, user, pass);
    console.log('Sesión OK\n');

    // 1) Sin filtro: buscar todas las tropas donde aparece "Mascotena" o "Acuna"
    console.log('--- Fetching SIN filtro (primeras 5000 filas) ---');
    const allRows = await queryQ95(url, token, null);
    console.log(`Total sin filtro: ${allRows.length} tropas`);

    const rowsMascotena = allRows.filter(r =>
        (r.AC_Vend || '').toLowerCase().includes('mascotena') ||
        (r.AC_Comp || '').toLowerCase().includes('mascotena')
    );
    const rowsAcuna = allRows.filter(r =>
        (r.AC_Vend || '').toLowerCase().includes('acuna') ||
        (r.AC_Comp || '').toLowerCase().includes('acuna')
    );

    console.log(`\nTropas con "Mascotena" (sin filtro): ${rowsMascotena.length}`);
    rowsMascotena.slice(0, 5).forEach(r => {
        console.log(`  lote ${r.id_lote} | AC_Vend="${r.AC_Vend}" | AC_Comp="${r.AC_Comp}" | estado="${r.Estado_Trop || r.estado_general}"`);
    });

    console.log(`\nTropas con "Acuna" (sin filtro): ${rowsAcuna.length}`);
    rowsAcuna.slice(0, 3).forEach(r => {
        console.log(`  lote ${r.id_lote} | AC_Vend="${r.AC_Vend}" | AC_Comp="${r.AC_Comp}"`);
    });

    // 2) Con filtro id_usuario = MASCOTENA_ID
    console.log(`\n--- Fetching CON id_usuario=${MASCOTENA_ID} (Mascotena) ---`);
    const rowsByIdMascotena = await queryQ95(url, token, MASCOTENA_ID);
    console.log(`Total con id_usuario=${MASCOTENA_ID}: ${rowsByIdMascotena.length} tropas`);

    // Verificar si hay tropas donde Mascotena no aparece en AC_Vend ni AC_Comp
    const sinMascotena = rowsByIdMascotena.filter(r =>
        !(r.AC_Vend || '').toLowerCase().includes('mascotena') &&
        !(r.AC_Comp || '').toLowerCase().includes('mascotena')
    );
    console.log(`  → Tropas donde Mascotena NO aparece en AC_Vend/AC_Comp: ${sinMascotena.length}`);
    if (sinMascotena.length > 0) {
        console.log('  ⚠️  PROBLEMA: id_usuario filtra por otro campo (no AC_Vend/AC_Comp):');
        sinMascotena.slice(0, 5).forEach(r => {
            console.log(`    lote ${r.id_lote} | AC_Vend="${r.AC_Vend}" | AC_Comp="${r.AC_Comp}" | repre_vend="${r.repre_vendedor}" | repre_comp="${r.repre_comprador}"`);
        });
    }

    // Verificar cuántas tropas correctas hay con Mascotena como vend/comp
    const comoVend = rowsByIdMascotena.filter(r => (r.AC_Vend || '').toLowerCase().includes('mascotena'));
    const comoComp = rowsByIdMascotena.filter(r => (r.AC_Comp || '').toLowerCase().includes('mascotena'));
    console.log(`  → Como vendedor: ${comoVend.length} | Como comprador: ${comoComp.length}`);

    // 3) Con filtro id_usuario = ACUNA_ID para comparar
    console.log(`\n--- Fetching CON id_usuario=${ACUNA_ID} (Acuna) ---`);
    const rowsByIdAcuna = await queryQ95(url, token, ACUNA_ID);
    console.log(`Total con id_usuario=${ACUNA_ID}: ${rowsByIdAcuna.length} tropas`);
    const acunaComoVend = rowsByIdAcuna.filter(r => (r.AC_Vend || '').toLowerCase().includes('acuna'));
    const acunaComoComp = rowsByIdAcuna.filter(r => (r.AC_Comp || '').toLowerCase().includes('acuna'));
    console.log(`  → Acuna como vendedor: ${acunaComoVend.length} | como comprador: ${acunaComoComp.length}`);

    // 4) Tropas que aparecen en AMBOS filtros (debería ser 0 si el filtro es correcto)
    const idsM = new Set(rowsByIdMascotena.map(r => String(r.id_lote)));
    const idsA = new Set(rowsByIdAcuna.map(r => String(r.id_lote)));
    const overlap = [...idsM].filter(id => idsA.has(id));
    console.log(`\n--- Solapamiento entre Mascotena=${MASCOTENA_ID} y Acuna=${ACUNA_ID}: ${overlap.length} tropas ---`);
    if (overlap.length > 0) {
        console.log('Lotes en común:', overlap.slice(0, 10).join(', '));
        // Mostrar detalles de los solapados
        overlap.slice(0, 3).forEach(id => {
            const r = rowsByIdMascotena.find(x => String(x.id_lote) === id);
            if (r) console.log(`  lote ${id}: AC_Vend="${r.AC_Vend}" | AC_Comp="${r.AC_Comp}"`);
        });
    }

    // Resumen
    console.log('\n=== DIAGNOSTICO FINAL ===');
    if (sinMascotena.length > 0) {
        console.log('❌ Q95 id_usuario NO filtra por AC_Vend/AC_Comp — filtra por otro campo (operario/cargador)');
        console.log('   El filtro por id_usuario puede traer tropas de otros ACs');
    } else {
        console.log('✅ Q95 id_usuario filtra correctamente por AC_Vend/AC_Comp');
    }
    if (overlap.length > 0) {
        console.log(`⚠️  Hay ${overlap.length} tropas que aparecen en AMBOS usuarios (operaciones en común Mascotena↔Acuna)`);
    }
}

main().catch(console.error);
