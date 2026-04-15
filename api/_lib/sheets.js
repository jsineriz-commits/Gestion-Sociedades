// api/_lib/sheets.js con soporte de ESCRITURA para Gestion de Cuentas
const { google } = require('googleapis');

const DB_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1FpgyFCw2hibi3w_jArtohKUXPhvfUpnF9SDDi3Yi-oA';
// Sheet separado para Gestión de Cuentas (misma hoja que compartiste)
const CUENTAS_SHEET_ID = process.env.CUENTAS_SHEET_ID || '1KfqTwP2hdeqF_FZSmEEniP1tLvqve8t3p3ZgrUWnk4k';
const CUENTAS_SHEET_NAME = 'Gestion de cuentas';

let _authClient = null;
let _authClientWrite = null;

function formatPrivateKey(key) {
  if (!key) return '';
  key = key.trim().replace(/^\"|\"$/g, '');
  key = key.replace(/\\n/g, '\n');
  if (!key.includes('\n')) {
    let text = key.replace('-----BEGIN PRIVATE KEY-----', '');
    text = text.replace('-----END PRIVATE KEY-----', '');
    const cleanBase64 = text.replace(/\s+/g, '');
    const lines = cleanBase64.match(/.{1,64}/g);
    if (lines) {
      key = '-----BEGIN PRIVATE KEY-----\n' + lines.join('\n') + '\n-----END PRIVATE KEY-----\n';
    }
  }
  return key;
}

async function getAuthClient() {
  if (_authClient) return _authClient;
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  _authClient = await auth.getClient();
  return _authClient;
}

async function getAuthClientWrite() {
  if (_authClientWrite) return _authClientWrite;
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  _authClientWrite = await auth.getClient();
  return _authClientWrite;
}

async function getSheetData(sheetName) {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: DB_SHEET_ID,
    range: sheetName,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  });
  return res.data.values || [];
}

/**
 * Lee los comentarios de Gestión de Cuentas desde el sheet externo.
 * Devuelve array de { cuit, fecha, comentario }
 */
async function getCuentasComments() {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CUENTAS_SHEET_ID,
    range: `${CUENTAS_SHEET_NAME}!A:C`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const rows = res.data.values || [];
  const result = [];
  for (let i = 1; i < rows.length; i++) { // skip header
    const row = rows[i];
    if (!row || !row[0]) continue;
    result.push({
      cuit: String(row[0] || '').trim(),
      fecha: String(row[1] || '').trim(),
      comentario: String(row[2] || '').trim(),
    });
  }
  return result;
}

/**
 * Agrega un nuevo comentario al sheet de Gestión de Cuentas.
 */
async function addCuentaComment(cuit, comentario, autor) {
  const auth = await getAuthClientWrite();
  const sheets = google.sheets({ version: 'v4', auth });
  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  await sheets.spreadsheets.values.append({
    spreadsheetId: CUENTAS_SHEET_ID,
    range: `${CUENTAS_SHEET_NAME}!A:C`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[String(cuit).trim(), fechaStr, String(comentario).trim()]],
    },
  });
  return { cuit, fecha: fechaStr, comentario };
}

function serialToDate(serial) {
  if (typeof serial !== 'number' || serial < 1 || serial > 2958466) return null;
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

function g(row, idx) {
  return row && row.length > idx && row[idx] !== null && row[idx] !== undefined
    ? row[idx]
    : '';
}

module.exports = { getAuthClient, getSheetData, serialToDate, g, DB_SHEET_ID, getCuentasComments, addCuentaComment };
