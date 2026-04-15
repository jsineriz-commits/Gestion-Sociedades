// Script para descargar datos históricos de Metabase card 4550
// Uso: node scripts/fetch-hist.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Leer .env.local manualmente (compatible CRLF Windows)
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
    const m = line.trim().match(/^([^#=]+)=(.+)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const METABASE_URL = env.METABASE_URL;
const USERNAME = env.METABASE_USERNAME;
const PASSWORD = env.METABASE_PASSWORD;
const CARD_ID = 4550;

async function run() {
    console.log('🔐 Autenticando en Metabase...');
    const sessionRes = await fetch(`${METABASE_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    if (!sessionRes.ok) throw new Error('Fallo autenticación: ' + sessionRes.status);
    const { id: token } = await sessionRes.json();
    console.log('✅ Token obtenido');

    console.log(`📥 Descargando card ${CARD_ID} (histórica)... puede tardar 10-30s`);
    const cardRes = await fetch(`${METABASE_URL}/api/card/${CARD_ID}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
    });
    if (!cardRes.ok) throw new Error('Fallo query card: ' + cardRes.status);
    const raw = await cardRes.json();
    if (raw.error) throw new Error('Error Metabase: ' + raw.error);

    // Parsear columna → objeto
    const data = raw.data || raw;
    const cols = (data.cols || data.columns || []).map(c => c.name || c);
    const rows = data.rows || [];
    const objects = rows.map(row => {
        const obj = {};
        row.forEach((v, i) => { obj[cols[i]] = v; });
        return obj;
    });

    const outPath = path.join(__dirname, '..', 'data_hist.json');
    fs.writeFileSync(outPath, JSON.stringify(objects));
    const sizeKB = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`✅ Guardado data_hist.json — ${objects.length} registros (${sizeKB}KB)`);

    if (objects.length > 0) {
        console.log('📋 Columnas:', Object.keys(objects[0]).join(', '));
        // Rango de fechas
        const fechas = objects.map(o => o.fecha_operacion || o.FECHA_OP || '').filter(Boolean).sort();
        if (fechas.length) console.log('📅 Rango:', fechas[0], '→', fechas[fechas.length - 1]);
    }
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
