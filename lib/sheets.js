// lib/sheets.js — Google Sheets con Service Account (ES modules)
// Variables de entorno: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY

import { google } from 'googleapis';

// Usar la variable de entorno GOOGLE_SHEET_ID que ya está cargada en Vercel
// ID confirmado: 1KfqTwP2hdeqF_FZSmEEniP1tLvqve8t3p3ZgrUWnk4k
const GESTION_SHEET_ID =
  process.env.GOOGLE_SHEET_ID ||
  '1KfqTwP2hdeqF_FZSmEEniP1tLvqve8t3p3ZgrUWnk4k';

let _authClient = null;

async function getAuthClient() {
  if (_authClient) return _authClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const key   = (process.env.GOOGLE_PRIVATE_KEY || '')
    .trim().replace(/\\n/g, '\n').replace(/^"|"$/g, '');

  if (!email || !key) throw new Error('Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY');

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  _authClient = await auth.getClient();
  return _authClient;
}

/**
 * Lee una hoja del Spreadsheet de Gestión de Sociedades.
 * @param {string} sheetName
 * @returns {Promise<any[][]>}
 */
export async function getSheetData(sheetName) {
  const auth   = await getAuthClient();
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
