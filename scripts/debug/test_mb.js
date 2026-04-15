const mbUrl = process.env.METABASE2_URL || 'https://metabase.dcac.ar';
const username = process.env.METABASE2_USERNAME || 'sdewey@decampoacampo.com';
const password = process.env.METABASE2_PASSWORD || 'Gallardo@25';

async function test() {
    console.log("Auth...");
    const sRes = await fetch(`${mbUrl}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const sJson = await sRes.json();
    console.log(sJson.id ? "Auth OK" : sJson);

    console.log("Querying...");
    const qRes = await fetch(`${mbUrl}/api/card/147/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Metabase-Session': sJson.id,
        },
        body: JSON.stringify({ parameters: [{
            type: 'category',
            target: ['variable', ['template-tag', 'id_tropa']],
            value: "29848",
        }, {
            type: 'category',
            target: ['variable', ['template-tag', 'id_usuario']],
            value: "2",
        }]}),
    });
    const qJson = await qRes.json();
    if (qJson.error) {
        console.error("METABASE ERROR:", qJson.error);
    } else {
        console.log("METABASE OK:", Object.keys(qJson));
        if (qJson.data) console.log("Cols:", qJson.data.cols.length, "Rows:", qJson.data.rows.length);
        else console.log("Missing data. Maybe JSON array?", qJson.length);
    }
}
test().catch(console.error);
