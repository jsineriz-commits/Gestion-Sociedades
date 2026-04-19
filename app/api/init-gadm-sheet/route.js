/**
 * GET /api/init-gadm-sheet
 * Crea/actualiza la hoja "GADM - Match Deptos" con los 502 departamentos del GeoJSON.
 * Usar UNA SOLA VEZ para inicializar el sheet de matching.
 * Requiere: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY (con permisos write)
 */
import { NextResponse } from 'next/server';
import { google }       from 'googleapis';
import { readFileSync }  from 'fs';
import { join }         from 'path';

export const dynamic    = 'force-dynamic';
export const maxDuration = 60;

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1KfqTwP2hdeqF_FZSmEEniP1tLvqve8t3p3ZgrUWnk4k';
const TAB_NAME = 'GADM - Match Deptos';

async function getWriteAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const key   = (process.env.GOOGLE_PRIVATE_KEY || '')
    .trim().replace(/\\n/g, '\n').replace(/^"|"$/g, '');
  if (!email || !key) throw new Error('Faltan credenciales Google');
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
}

function norm(name) {
  let s = String(name||'').replace(/([a-z])([A-Z])/g, '$1 $2');
  return s.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, ' ')
    .replace(/\bGRAL\b/g,'GENERAL').replace(/\bCNEL\b/g,'CORONEL')
    .replace(/\bSTA\b/g,'SANTA').replace(/\bSTO\b/g,'SANTO')
    .replace(/\bTTE\b/g,'TENIENTE').replace(/\bPTE\b/g,'PRESIDENTE')
    .replace(/(\w+?)DEL\b/g,'$1 DEL')
    .replace(/(\w+?)DE\b/g, '$1 DE')
    .replace(/\s+/g,' ').trim();
}

export async function GET() {
  try {
    // Leer GeoJSON del filesystem
    const geojsonPath = join(process.cwd(), 'public', 'deptos.geojson');
    const geojson = JSON.parse(readFileSync(geojsonPath, 'utf8'));

    const deptos = [];
    geojson.features.forEach(f => {
      const p    = f.properties;
      const prov = p.NAME_1 || p.provincia_nombre || '';
      const dept = p.NAME_2 || p.nombre || '';
      const gid  = p.GID_2  || '';
      deptos.push({ prov, dept, gid });
    });
    deptos.sort((a, b) => a.prov.localeCompare(b.prov) || a.dept.localeCompare(b.dept));

    // Auth con permisos de escritura
    const auth    = await getWriteAuth();
    const sheets  = google.sheets({ version: 'v4', auth });

    // Ver si la hoja ya existe
    const meta     = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const existing = meta.data.sheets.find(s => s.properties.title === TAB_NAME);

    if (existing) {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SHEET_ID,
        range: `'${TAB_NAME}'`,
      });
    } else {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: TAB_NAME } } }] },
      });
    }

    // Headers + Data
    const header = [
      'Provincia (GADM)',
      'Departamento (GADM)',
      'Provincia Normalizada (código usa esto)',
      'Depto Normalizado (código usa esto)',
      'GID_2 (ID único GADM)',
      '→ Q188 partido_establecimiento_senasa (completar)',
      '→ DEPTO_ID del Merge (completar si sabe)',
      'Notas / Diferencias',
    ];

    const rows = deptos.map(({ prov, dept, gid }) => [
      prov,
      dept,
      norm(prov),
      norm(dept),
      gid,
      '',
      '',
      '',
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${TAB_NAME}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [header, ...rows] },
    });

    // Formato: header bold + freeze
    const sheetMeta2 = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const sheetId = sheetMeta2.data.sheets.find(s => s.properties.title === TAB_NAME)?.properties.sheetId;

    if (sheetId !== undefined) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true, foregroundColor:{red:1,green:1,blue:1} },
                    backgroundColor: { red:0.149,green:0.267,blue:0.525 },
                  },
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor)',
              },
            },
            {
              updateSheetProperties: {
                properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
                fields: 'gridProperties.frozenRowCount',
              },
            },
            {
              autoResizeDimensions: {
                dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 8 },
              },
            },
          ],
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: `✅ Hoja "${TAB_NAME}" creada con ${rows.length} departamentos`,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
    });

  } catch (err) {
    console.error('[init-gadm-sheet]', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
