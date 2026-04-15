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

async function check() {
    try {
        const url = process.env.METABASE2_URL || 'https://metabase2.decampoacampo.com';
        const sessionRes = await fetch(`${url}/api/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: process.env.METABASE2_USERNAME || 'nicolas@decampoacampo.com',
                password: process.env.METABASE2_PASSWORD || 'Oeste1234.'
            })
        });
        const sessionData = await sessionRes.json();
        const sessionId = sessionData.id;

        const res = await fetch(`${url}/api/card/95/query/json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Metabase-Session': sessionId
            }
        });
        const text = await res.text();
        const data = JSON.parse(text);
        
        let foundPub = 0;
        let foundOfrec = 0;
        
        const estados = {};
        for (const o of data) {
            const eg = String(o.estado_general || '').trim();
            const et = String(o.Estado_Trop || '').trim();
            
            if (eg.toLowerCase().includes('publi') || et.toLowerCase().includes('publi')) foundPub++;
            if (eg.toLowerCase().includes('ofrec') || et.toLowerCase().includes('ofrec')) foundOfrec++;

            const k = `G:[${eg}] T:[${et}]`;
            estados[k] = (estados[k] || 0) + 1;
        }

        const pub = data.find(o => 
            (o.estado_general || '').toLowerCase().includes('publi') || 
            (o.Estado_Trop || '').toLowerCase().includes('publi') ||
            (o.estado_general || '').toLowerCase().includes('ofrec') || 
            (o.Estado_Trop || '').toLowerCase().includes('ofrec')
        );

        fs.writeFileSync('q95_summary.json', JSON.stringify({
            total: data.length,
            foundPub,
            foundOfrec,
            estados,
            ejemplo: pub
        }, null, 2));

    } catch (e) {}
}
check();
