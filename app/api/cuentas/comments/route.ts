import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const SHEET_ID = process.env.CUENTAS_SHEET_ID || '';
const SHEET_NAME = 'Gestion de cuentas';

function getSheets() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// GET — devuelve todos los comentarios de la hoja
export async function GET() {
  try {
    if (!SHEET_ID) return NextResponse.json([]);
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:C`,
    });
    const rows = res.data.values || [];
    const comments = rows
      .filter(r => r[0] && r[1]) // cuit + fecha requeridos
      .map(r => ({ cuit: r[0], fecha: r[1], comentario: r[2] || '' }));
    return NextResponse.json(comments);
  } catch (e: any) {
    console.error('[api/cuentas/comments GET]', e.message);
    return NextResponse.json([]);
  }
}

// POST — agrega un comentario nuevo
export async function POST(req: NextRequest) {
  try {
    const { cuit, comentario } = await req.json();
    if (!cuit || !comentario) {
      return NextResponse.json({ error: 'cuit y comentario requeridos' }, { status: 400 });
    }
    const now = new Date();
    const fecha = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    if (!SHEET_ID) {
      // Sin Sheets: devolver OK con fecha para modo local
      return NextResponse.json({ ok: true, cuit, fecha, comentario, localOnly: true });
    }

    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:C`,
      valueInputOption: 'RAW',
      requestBody: { values: [[String(cuit).trim(), fecha, String(comentario).trim()]] },
    });
    return NextResponse.json({ ok: true, cuit, fecha, comentario });
  } catch (e: any) {
    console.error('[api/cuentas/comments POST]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
