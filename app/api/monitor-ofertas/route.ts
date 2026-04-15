import { NextResponse } from 'next/server';
import { formatMetabaseData } from '@/lib/api/metabase-server';

/**
 * GET /api/monitor-ofertas?id_usuario=123
 *
 * Llama a Q185 "Monitor Ofertas SD" en Metabase.
 * - Con id_usuario → filtra por ese AC/representante
 * - Sin id_usuario  → trae todos los registros (acceso admin)
 */

const SESSION_TTL_MS = 110 * 60 * 1000;
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getSession(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
    const sessionRes = await fetch(`${(process.env.METABASE2_URL || '').trim()}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: (process.env.METABASE2_USERNAME || '').trim(),
            password: (process.env.METABASE2_PASSWORD || '').trim(),
        }),
        cache: 'no-store',
    });
    if (!sessionRes.ok) throw new Error('Fallo autenticación Metabase (monitor-ofertas)');
    const { id: token } = await sessionRes.json();
    cachedToken = token;
    tokenExpiry = Date.now() + SESSION_TTL_MS;
    return token;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id_usuario = searchParams.get('id_usuario'); // opcional: vacío = todo

        const token = await getSession();
        const MB2 = (process.env.METABASE2_URL || '').trim();

        // Q185: Monitor Ofertas SD
        // Con id_usuario → filtra; sin él → trae todo (para admin)
        const body: any = {};
        if (id_usuario) {
            body.parameters = [
                {
                    type: 'category',
                    target: ['variable', ['template-tag', 'id_usuario']],
                    value: parseInt(id_usuario, 10),
                },
            ];
        }

        const res = await fetch(`${MB2}/api/card/185/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Metabase-Session': token,
            },
            body: JSON.stringify(body),
            cache: 'no-store',
        });

        if (!res.ok) throw new Error(`Q185 HTTP ${res.status}`);

        const raw = await res.json();
        if (raw.error) throw new Error(raw.error);

        let data: any[] = [];
        if (raw.data) {
            data = formatMetabaseData(raw.data) || [];
        } else if (raw.rows) {
            data = formatMetabaseData(raw) || [];
        }

        return NextResponse.json({ success: true, data, total: data.length });
    } catch (err: any) {
        console.error('[monitor-ofertas] Error:', err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
