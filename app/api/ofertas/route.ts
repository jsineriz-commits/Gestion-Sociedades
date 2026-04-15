import { NextResponse } from 'next/server';
import { formatMetabaseData } from '@/lib/api/metabase-server';

const SESSION_TTL_MS = 110 * 60 * 1000;
let cachedToken2: string | null = null;
let tokenExpiry2 = 0;

async function getSession2(): Promise<string> {
    if (cachedToken2 && Date.now() < tokenExpiry2) return cachedToken2;
    const sessionRes = await fetch(`${(process.env.METABASE2_URL || '').trim()}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: (process.env.METABASE2_USERNAME || '').trim(),
            password: (process.env.METABASE2_PASSWORD || '').trim(),
        }),
        cache: 'no-store',
    });
    if (!sessionRes.ok) {
        throw new Error('Fallo autenticación Metabase2');
    }
    const { id: token } = await sessionRes.json();
    cachedToken2 = token;
    tokenExpiry2 = Date.now() + SESSION_TTL_MS;
    return token;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id_lote = searchParams.get('id_lote');

        if (!id_lote) {
            return NextResponse.json({ error: 'Missing id_lote' }, { status: 400 });
        }

        const token = await getSession2();

        // Query card 149
        const body: any = {
            parameters: [
                {
                    type: 'category',
                    target: ['variable', ['template-tag', 'id_lote']],
                    value: parseInt(id_lote as string, 10)
                }
            ]
        };

        const res = await fetch(`${(process.env.METABASE2_URL || '').trim()}/api/card/149/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
            body: JSON.stringify(body),
            cache: 'no-store',
        });

        const raw = await res.json();
        if (raw.error) {
            throw new Error(raw.error);
        }

        let data: any[] = [];
        if (raw.data) {
            data = formatMetabaseData(raw.data) || [];
        } else if (raw.rows) {
            data = formatMetabaseData(raw) || [];
        }

        return NextResponse.json(data);
    } catch (err: any) {
        console.error('Error fetching ofertas:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
