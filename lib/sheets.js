// lib/sheets.js — Google Sheets con Service Account (ES modules)
// Variables de entorno: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY

import { google } from 'googleapis';

const GESTION_SHEET_ID =
  process.env.GOOGLE_SHEET_ID ||
  '1KfqTwP2hdeqF_FZSmEEniP1tLvqve8t3p3ZgrUWnk4k';

let _authClientRO = null;
let _authClientRW = null;

async function getAuthClient(write = false) {
  if (!write && _authClientRO) return _authClientRO;
  if ( write && _authClientRW) return _authClientRW;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const key   = (process.env.GOOGLE_PRIVATE_KEY || '')
    .trim().replace(/\\n/g, '\n').replace(/^"|"$/g, '');

  if (!email || !key) throw new Error('Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY');

  const scopes = write
    ? ['https://www.googleapis.com/auth/spreadsheets']
    : ['https://www.googleapis.com/auth/spreadsheets.readonly'];

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes,
  });
  const client = await auth.getClient();
  if (write) _authClientRW = client;
  else       _authClientRO = client;
  return client;
}

/**
 * Lee una hoja del Spreadsheet de Gestión de Sociedades.
 * @param {string} sheetName
 * @returns {Promise<any[][]>}
 */
export async function getSheetData(sheetName) {
  const auth   = await getAuthClient(false);
  const sheets = google.sheets({ version: 'v4', auth });
  const quoted = sheetName.includes(' ') ? `'${sheetName}'` : sheetName;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: GESTION_SHEET_ID,
      range: quoted,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    return res.data.values || [];
  } catch (e) {
    console.error(`[sheets] Error leyendo "${sheetName}":`, e.message);
    return [];
  }
}

/**
 * Escribe filas en una pestaña del Spreadsheet de Gestión.
 * Crea la pestaña si no existe; la limpia y sobreescribe si ya existe.
 * @param {string}     sheetName  Nombre de la pestaña destino
 * @param {any[][]}    rows2D     Array de arrays: primera fila = header
 * @returns {Promise<{url: string, sheetId: number}>}
 */
export async function writeSheetData(sheetName, rows2D) {
  const auth   = await getAuthClient(true);
  const sheets = google.sheets({ version: 'v4', auth });

  // Buscar pestaña existente
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: GESTION_SHEET_ID,
    fields: 'sheets.properties',
  });
  const existing = meta.data.sheets.find(s => s.properties.title === sheetName);

  let sheetId;
  if (existing) {
    sheetId = existing.properties.sheetId;
    // Limpiar datos anteriores
    await sheets.spreadsheets.values.clear({
      spreadsheetId: GESTION_SHEET_ID,
      range: sheetName,
    });
  } else {
    // Crear nueva pestaña
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: GESTION_SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
    sheetId = addRes.data.replies[0].addSheet.properties.sheetId;
  }

  // Escribir datos
  await sheets.spreadsheets.values.update({
    spreadsheetId: GESTION_SHEET_ID,
    range: `'${sheetName}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows2D },
  });

  return {
    url: `https://docs.google.com/spreadsheets/d/${GESTION_SHEET_ID}/edit#gid=${sheetId}`,
    sheetId,
  };
}
