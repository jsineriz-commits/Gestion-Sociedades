// lib/sheets.js — Google Sheets con Service Account (ES modules)
// Variables de entorno: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY

import { google } from 'googleapis';

const GESTION_SHEET_ID =
  process.env.GOOGLE_SHEET_ID ||
  '1KfqTwP2hdeqF_FZSmEEniP1tLvqve8t3p3ZgrUWnk4k';

let _authClientRO  = null;
let _authClientRW  = null;
let _authClientDRV = null;

async function getAuthClient(mode = 'read') {
  // mode: 'read' | 'write' | 'drive'
  if (mode === 'read'  && _authClientRO)  return _authClientRO;
  if (mode === 'write' && _authClientRW)  return _authClientRW;
  if (mode === 'drive' && _authClientDRV) return _authClientDRV;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const key   = (process.env.GOOGLE_PRIVATE_KEY || '')
    .trim().replace(/\\n/g, '\n').replace(/^"|"$/g, '');

  if (!email || !key) throw new Error('Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY');

  const scopeMap = {
    read:  ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    write: ['https://www.googleapis.com/auth/spreadsheets'],
    drive: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  };

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: scopeMap[mode],
  });
  const client = await auth.getClient();
  if (mode === 'read')  _authClientRO  = client;
  if (mode === 'write') _authClientRW  = client;
  if (mode === 'drive') _authClientDRV = client;
  return client;
}

/**
 * Lee una hoja del Spreadsheet de Gestión de Sociedades.
 * @param {string} sheetName
 * @returns {Promise<any[][]>}
 */
export async function getSheetData(sheetName) {
  const auth   = await getAuthClient('read');
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
 * Escribe filas en una pestaña del Spreadsheet indicado (o el de Gestión por defecto).
 * Crea la pestaña si no existe; la limpia y sobreescribe si ya existe.
 * @param {string}  sheetName      Nombre de la pestaña destino
 * @param {any[][]} rows2D         Primera fila = header, resto = datos
 * @param {string}  [spreadsheetId] ID del spreadsheet destino (default: GESTION_SHEET_ID)
 * @returns {Promise<{url: string, sheetId: number}>}
 */
export async function writeSheetData(sheetName, rows2D, spreadsheetId = GESTION_SHEET_ID) {
  const auth   = await getAuthClient('write');
  const sheets = google.sheets({ version: 'v4', auth });

  // Buscar pestaña existente
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const existing = meta.data.sheets.find(s => s.properties.title === sheetName);

  let sheetId;
  if (existing) {
    sheetId = existing.properties.sheetId;
    // Limpiar datos anteriores
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: sheetName,
    });
  } else {
    // Crear nueva pestaña
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
    sheetId = addRes.data.replies[0].addSheet.properties.sheetId;
  }

  // Escribir datos
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows2D },
  });

  return {
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`,
    sheetId,
  };
}

/**
 * Crea un NUEVO archivo Google Sheets, escribe los datos y lo comparte
 * con cualquier persona que tenga el link (viewer).
 * @param {string}  title   Título del nuevo spreadsheet
 * @param {any[][]} rows2D  Primera fila = header, resto = datos
 * @returns {Promise<{url: string, spreadsheetId: string}>}
 */
export async function createSpreadsheet(title, rows2D) {
  const auth   = await getAuthClient('drive');
  const sheets = google.sheets({ version: 'v4', auth });
  const drive  = google.drive({ version: 'v3', auth });

  // 1. Crear el spreadsheet
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [{ properties: { title: 'Exportación', gridProperties: { frozenRowCount: 2 } } }],
    },
  });
  const spreadsheetId = createRes.data.spreadsheetId;

  // 2. Escribir los datos
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Exportación!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows2D },
  });

  // 3. Compartir: cualquiera con el link puede editar
  await drive.permissions.create({
    fileId: spreadsheetId,
    requestBody: { role: 'writer', type: 'anyone' },
  });

  return {
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    spreadsheetId,
  };
}
