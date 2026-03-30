// api/_lib/sheets.js
// Autenticación con Google Sheets API via Service Account
// Configurar variable de entorno en Vercel: GOOGLE_SERVICE_ACCOUNT_KEY (JSON completo)

const { google } = require('googleapis');

const DB_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1FpgyFCw2hibi3w_jArtohKUXPhvfUpnF9SDDi3Yi-oA';

let _authClient = null;

function formatPrivateKey(key) {
  if (!key) return '';
  // Remover comillas al inicio y final si se pegaron por error
  key = key.trim().replace(/^"|"$/g, '');
  // Reemplazar literales \n por saltos de línea
  key = key.replace(/\\n/g, '\n');
  
  // Arreglar casos donde la llave se pegó como una sola línea con espacios
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

/**
 * Trae todos los valores de una hoja como array 2D (equivalente a getDataRange().getValues()).
 * Usa UNFORMATTED_VALUE: fechas vienen como serial number, textos como string, números como number.
 */
async function getSheetData(sheetName) {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  
  // Removed try-catch to propagate the error up to the Vercel handler for debugging
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: DB_SHEET_ID,
    range: sheetName,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  });
  return res.data.values || [];
}

/**
 * Convierte un serial de Google Sheets a Date de JS.
 * Epoch de Sheets: 30 de diciembre de 1899.
 * Retorna null si el valor no es un número válido.
 */
function serialToDate(serial) {
  if (typeof serial !== 'number' || serial < 1 || serial > 2958466) return null;
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Acceso seguro a una celda de fila (las filas del API pueden ser más cortas de lo esperado).
 */
function g(row, idx) {
  return row && row.length > idx && row[idx] !== null && row[idx] !== undefined
    ? row[idx]
    : '';
}

module.exports = { getAuthClient, getSheetData, serialToDate, g, DB_SHEET_ID };
