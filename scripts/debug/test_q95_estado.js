const fs = require('fs');
const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/['"]/g, '');
});

const mbUrl = env.METABASE2_URL;
const login = env.METABASE2_USERNAME;
const pass = env.METABASE2_PASSWORD;

async function run() {
    const sRes = await fetch(`${mbUrl}/api/session`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: login, password: pass})
    });
    const {id: token} = await sRes.json();
    
    const params = [
        { type: 'category', target: ['variable', ['template-tag', 'fecha_desde']], value: '2026-01-01' },
        { type: 'category', target: ['variable', ['template-tag', 'fecha_hasta']], value: '2026-12-31' }
    ];

    const cRes = await fetch(`${mbUrl}/api/card/95/query/json?format_rows=false`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Metabase-Session': token},
        body: JSON.stringify({parameters: params})
    });
    
    if (cRes.ok) {
        const data = await cRes.json();
        const estados = new Set(data.map(d => d.ESTADO));
        console.log("Estados:", Array.from(estados));
    }
}
run();
