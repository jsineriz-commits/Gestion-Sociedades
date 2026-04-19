/**
 * Script: Exportar departamentos del GeoJSON al Google Sheets
 * Crea una nueva hoja "GADM - Match Deptos" con todos los departamentos del mapa
 * para que el usuario pueda hacer el match con Q188 / Base Clave
 */
const fs   = require('fs');
const path = require('path');
const { google } = require('googleapis');

// ── Config ────────────────────────────────────────────────────────────
const SHEET_ID = '1KfqTwP2hdeqF_FZSmEEniP1tLvqve8t3p3ZgrUWnk4k';
const TAB_NAME = 'GADM - Match Deptos';

const ROOT = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env.local') });

// ── Auth Google ───────────────────────────────────────────────────────
async function getAuth() {
  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key:  (process.env.GOOGLE_PRIVATE_KEY||'').replace(/\\n/g, '\n'),
  };
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
}

// ── Leer GeoJSON ──────────────────────────────────────────────────────
function loadDeptos() {
  const geojson = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public', 'deptos.geojson'), 'utf8')
  );
  const rows = [];
  geojson.features.forEach(f => {
    const p    = f.properties;
    const prov = p.NAME_1 || p.provincia_nombre || '';
    const dept = p.NAME_2 || p.nombre || '';
    const gid  = p.GID_2  || '';
    rows.push({ prov, dept, gid });
  });
  // Ordenar por provincia, luego por departamento
  rows.sort((a, b) => a.prov.localeCompare(b.prov) || a.dept.localeCompare(b.dept));
  return rows;
}

// ── Normalizar nombre (igual que en el frontend) ──────────────────────
function norm(name) {
  let s = String(name||'').replace(/([a-z])([A-Z])/g,'$1 $2');
  return s.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\./g,' ')
    .replace(/\bGRAL\b/g,'GENERAL').replace(/\bCNEL\b/g,'CORONEL')
    .replace(/\bSTA\b/g,'SANTA').replace(/\bSTO\b/g,'SANTO')
    .replace(/\bTTE\b/g,'TENIENTE').replace(/\bPTE\b/g,'PRESIDENTE')
    .replace(/(\w+?)DEL\b/g,'$1 DEL')
    .replace(/(\w+?)DE\b/g,'$1 DE')
    .replace(/\s+/g,' ').trim();
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log('Leyendo GeoJSON...');
  const deptos = loadDeptos();
  console.log(`  → ${deptos.length} departamentos encontrados`);

  console.log('Autenticando con Google...');
  const auth    = await getAuth();
  const sheets  = google.sheets({ version: 'v4', auth });

  // Verificar si la hoja ya existe
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existing = meta.data.sheets.find(s => s.properties.title === TAB_NAME);

  if (existing) {
    // Limpiar hoja existente
    console.log(`Hoja "${TAB_NAME}" ya existe, limpiando...`);
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `'${TAB_NAME}'`,
    });
  } else {
    // Crear hoja nueva
    console.log(`Creando hoja "${TAB_NAME}"...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: TAB_NAME } } }],
      },
    });
  }

  // Preparar datos
  const header = [
    'Provincia (GADM)',
    'Departamento (GADM)',
    'Depto Normalizado',
    'Prov Normalizada',
    'GID_2',
    '← Q188 partido_establecimiento_senasa (completar)',
    'DEPTO_ID (completar o dejar vacío)',
    'Notas',
  ];

  const dataRows = deptos.map(({ prov, dept, gid }) => [
    prov,
    dept,
    norm(dept),
    norm(prov),
    gid,
    '',  // usuario completa: cómo aparece en Q188
    '',  // usuario puede poner el DEPTO_ID si lo sabe
    '',
  ]);

  const values = [header, ...dataRows];

  // Escribir en el sheet
  console.log(`Escribiendo ${dataRows.length} filas...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${TAB_NAME}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  // Formatear encabezado (negrita, fondo)
  const sheetId = (await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID }))
    .data.sheets.find(s => s.properties.title === TAB_NAME)
    ?.properties.sheetId;

  if (sheetId !== undefined) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          // Negrita en header
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red:0.2,green:0.4,blue:0.7 } } },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          // Auto-resize columnas
          {
            autoResizeDimensions: {
              dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 8 },
            },
          },
          // Freeze primer fila
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      },
    });
  }

  console.log(`\n✅ Listo! ${dataRows.length} departamentos exportados a la hoja "${TAB_NAME}"`);
  console.log(`   Link: https://docs.google.com/spreadsheets/d/${SHEET_ID}`);
  console.log('\n📋 Columnas:');
  console.log('   A: Provincia GADM (CamelCase, tal como aparece en el mapa)');
  console.log('   B: Departamento GADM (CamelCase)');
  console.log('   C: Departamento normalizado (como lo procesa el código)');
  console.log('   D: Provincia normalizada');
  console.log('   E: GID_2 (identificador único GADM)');
  console.log('   F: ← Completar con el nombre Q188 partido_establecimiento_senasa');
  console.log('   G: ← Completar con DEPTO_ID (opcional, del Merge sheet)');
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
