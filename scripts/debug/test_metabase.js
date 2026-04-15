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
    
    // Con id_usuario vacío, como espera si no hay
    const params1 = [
        { type: 'date/single', target: ['variable', ['template-tag', 'fecha_desde']], value: '2025-01-01' },
        { type: 'date/single', target: ['variable', ['template-tag', 'fecha_hasta']], value: '2025-12-31' }
    ];

    const cRes = await fetch(`${mbUrl}/api/card/95/query/json?format_rows=false`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Metabase-Session': token},
        body: JSON.stringify({parameters: params1})
    });
    
    const txt = await cRes.text();
    fs.writeFileSync('error_mb.json', txt);
    console.log("Wrote error to error_mb.json");
}
run();
