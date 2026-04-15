import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const fetchRes = await fetch(`${process.env.METABASE_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: process.env.METABASE_USERNAME, password: process.env.METABASE_PASSWORD })
    });
    const { id: token } = await fetchRes.json();

    const res4557 = await fetch(`${process.env.METABASE_URL}/api/card/4557/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
        body: JSON.stringify({}) // Querying as admin (no parameter)
    });
    const raw = await res4557.json();

    const res148 = await fetch(`${process.env.METABASE2_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: process.env.METABASE2_USERNAME, password: process.env.METABASE2_PASSWORD })
    });
    const { id: token2 } = await res148.json();

    const resMb2 = await fetch(`${process.env.METABASE2_URL}/api/card/148/query/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token2 },
        body: JSON.stringify({ parameters: [] })
    });
    
    let rawMB2;
    try { rawMB2 = await resMb2.json(); } catch(e) { rawMB2 = { error: "Cant parse 148 json" } }

    return NextResponse.json({
        topSocsCount: Array.isArray(raw.data?.rows) ? raw.data.rows.length : (raw.error || raw),
        mb2Count: Array.isArray(rawMB2) ? rawMB2.length : (rawMB2.error || rawMB2)
    });
}
