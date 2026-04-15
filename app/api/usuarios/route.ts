import { NextResponse } from 'next/server';
import { UsuarioSist } from '@/lib/data/usuarios';

// Google Sheets — Planilla maestra de usuarios
const SHEET_ID = '1FpgyFCw2hibi3w_jArtohKUxPhvfUpnF9SDDI3YI-aI';
const SHEET_GID = '1192272172'; // Hoja "Usuarios"

// Caché en memoria — TTL 5 minutos
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { data: UsuarioSist[]; expiry: number } | null = null;

async function fetchUsuariosFromSheet(): Promise<UsuarioSist[]> {
    const now = Date.now();
    if (cache && now < cache.expiry) {
        console.log('[Usuarios] Cache HIT');
        return cache.data;
    }

    const googleKey  = (process.env.Google_key  || '').trim();
    const googleMail = (process.env.Google_mail || '').trim();
    if (!googleKey || !googleMail) {
        console.warn('[Usuarios] Google_key o Google_mail no configurados');
        return [];
    }

    const { google } = await import('googleapis');
    const privateKey = googleKey.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
        email: googleMail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Resolver GID → nombre real del tab
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const sheetsList = meta.data.sheets || [];
    const tab = sheetsList.find((s: any) => String(s.properties?.sheetId) === SHEET_GID);
    if (!tab) throw new Error(`[Usuarios] Tab GID ${SHEET_GID} no encontrado en la planilla`);
    const tabName = tab.properties!.title!;

    // Leer columnas A:F
    // A=Nombre Apellido, B=Oficina, C=Mail, D=Canal, E=(vacía), F=ID Usuario
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${tabName}!A:F`,
    });
    const rows = res.data.values || [];

    const result: UsuarioSist[] = [];
    // Fila 0 = encabezados, iteramos desde 1
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const nombre  = String(row[0] || '').trim();
        const oficina = String(row[1] || '').trim() || undefined; // Vacío → sin oficina
        const email   = String(row[2] || '').trim().toLowerCase();
        const canal   = String(row[3] || '').trim();
        // col E (idx 4) se omite
        const idRaw   = String(row[5] || '').trim(); // col F (idx 5)
        const id      = parseInt(idRaw, 10);

        // Saltar filas incompletas
        if (!email || !nombre || !canal || isNaN(id)) continue;

        result.push({ id, email, nombre, canal, oficina });
    }

    cache = { data: result, expiry: now + CACHE_TTL_MS };
    console.log(`[Usuarios] Leídos ${result.length} usuarios desde Google Sheets`);
    return result;
}

export async function GET() {
    try {
        const usuarios = await fetchUsuariosFromSheet();
        return NextResponse.json({ usuarios });
    } catch (err: any) {
        console.error('[Usuarios API]', err.message);
        // Response 200 con array vacío para que el cliente pueda hacer fallback
        return NextResponse.json({ usuarios: [], error: err.message });
    }
}
