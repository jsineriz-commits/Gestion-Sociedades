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
    
    const cRes = await fetch(`${mbUrl}/api/card/155/query/json?format_rows=false`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Metabase-Session': token},
        body: JSON.stringify({parameters: []})
    });
    
    if (cRes.ok) {
        const data = await cRes.json();
        if (data.length > 0) {
            fs.writeFileSync('keys_155.json', JSON.stringify(Object.keys(data[0])));
        }
    }
}
run();
