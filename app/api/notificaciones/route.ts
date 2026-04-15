import { NextResponse } from 'next/server';
import { formatMetabaseData } from '@/lib/api/metabase-server';

const SESSION_TTL_MS = 110 * 60 * 1000;
let cachedToken: string | null = null;
let tokenExpiry = 0;

const OLD_MB_URL = 'https://bi.decampoacampo.com';
const OLD_MB_USER = 'spalacios@decampoacampo.com';
const OLD_MB_PASS = 'palacampero13';

async function getSession(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
    const sessionRes = await fetch(`${OLD_MB_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            username: OLD_MB_USER, 
            password: OLD_MB_PASS 
        }),
        cache: 'no-store',
    });
    if (!sessionRes.ok) throw new Error('Fallo autenticación Metabase Notificaciones Viejo');
    const { id: token } = await sessionRes.json();
    cachedToken = token;
    tokenExpiry = Date.now() + SESSION_TTL_MS;
    return token;
}

async function fetchCard(cardId: number, sessionToken: string): Promise<any[]> {
    const body: any = { constraints: { 'max-results': 500 } };
    const res = await fetch(`${OLD_MB_URL}/api/card/${cardId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': sessionToken },
        body: JSON.stringify(body),
        cache: 'no-store',
    });
    const raw = await res.json();
    console.log(`[Card ${cardId}] Raw keys:`, Object.keys(raw));
    if (raw.error) {
        console.log(`[Card ${cardId}] Error:`, raw.error);
        throw new Error(raw.error);
    }
    let data: any[] | null = null;
    if (raw.data) {
        console.log(`[Card ${cardId}] raw.data keys:`, Object.keys(raw.data));
        data = formatMetabaseData(raw.data);
    } else if (raw.rows) {
        data = formatMetabaseData(raw);
    }
    console.log(`[Card ${cardId}] Parsed length:`, data?.length);
    return data || [];
}

export async function GET() {
    try {
        const token = await getSession();

        // 3865 -> Asignación de Sociedad
        // 3867 -> Nuevo Ofrecimiento
        // 3869 -> Nueva CD / Respuesta CD
        // 3870 -> Nueva Oferta
        // 3873 -> CI Comprada
        const [sociedades, ofrecimientos, cds, ofertas, cis] = await Promise.all([
            fetchCard(3865, token),
            fetchCard(3867, token),
            fetchCard(3869, token),
            fetchCard(3870, token),
            fetchCard(3873, token)
        ]);

        let events: any[] = [];

        ofrecimientos.forEach((o: any) => {
            const relUsers = [o.AC, o.vendedor, o.usuario, o.representante].filter(Boolean).join(' | ');
            events.push({
                id: `of-${o.id_tropa || o.id || Math.random()}`,
                type: 'ofrecimiento',
                title: 'Nuevo Ofrecimiento',
                desc: `${o.categoria || o.Categoria || 'Tropa'} - ${o.cabezas || o.cant || 0} cabezas`,
                ac: relUsers || '',
                date: o.fecha_oferta || o.fecha_publicacion || o.created_at || new Date().toISOString(),
                raw: o
            });
        });

        ofertas.forEach((o: any) => {
            const relUsers = [o.AC, o.usuario, o.vendedor, o.ofertante].filter(Boolean).join(' | ');
            events.push({
                id: `of-${o.id_oferta || o.id || Math.random()}`,
                type: 'oferta',
                title: 'Nueva Oferta 👀',
                desc: `${o.soc_compradora || o.ofertante || 'Ofertante'} ofreció ${o.moneda==='USD'?'U$D':'$'} ${o.precio || o.monto || ''}`,
                ac: relUsers || '',
                date: o.fecha_oferta || o.created_at || new Date().toISOString(),
                raw: o
            });
        });

        cds.forEach((c: any) => {
            const relUsers = [c.AC, c.comercial, c.usuario, c.vendedor].filter(Boolean).join(' | ');
            events.push({
                id: `cd-${c.id || Math.random()}`,
                type: 'cd',
                title: c.estado?.toLowerCase().includes('resp') ? 'Respuesta CD 💬' : 'Nueva CD 📄',
                desc: `Ref CD: ${c.ref || c.id || 'N/A'}, Soc: ${c.sociedad || c.rs || ''}`,
                ac: relUsers || '',
                date: c.fecha || c.created_at || new Date().toISOString(),
                raw: c
            });
        });

        cis.forEach((c: any) => {
            const relUsers = [c.AC, c.comercial, c.usuario, c.vendedor].filter(Boolean).join(' | ');
            events.push({
                id: `ci-${c.id || Math.random()}`,
                type: 'ci',
                title: 'CI Comprada 🛒',
                desc: `${c.sociedad || c.comprador || ''} - ${c.cabezas || 0} cabezas`,
                ac: relUsers || '',
                date: c.fecha || c.created_at || new Date().toISOString(),
                raw: c
            });
        });

        sociedades.forEach((s: any) => {
             const relUsers = [s.AC, s.representante, s.usuario, s.comercial].filter(Boolean).join(' | ');
             events.push({
                id: `soc-${s.id || s.cuit || Math.random()}`,
                type: 'asignacion',
                title: 'Asignación de Sociedad 🤝',
                desc: `${s.sociedad || s.RS || s.razon_social || ''} agregada.`,
                ac: relUsers || '',
                date: s.fecha || s.created_at || new Date().toISOString(),
                raw: s
            });
        });

        // Parse valid dates and sort (most recent first)
        events = events.map(e => ({
            ...e,
            parsedDate: new Date(e.date).getTime() || 0
        })).sort((a, b) => b.parsedDate - a.parsedDate);

        return NextResponse.json({ success: true, total: events.length, events });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
