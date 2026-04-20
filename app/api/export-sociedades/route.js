import { NextResponse } from 'next/server';
import { writeSheetData } from '../../../lib/sheets.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Spreadsheet dedicado para exportaciones (distinto al de datos principales)
// El service account ya tiene acceso de editor: https://docs.google.com/spreadsheets/d/1JjreMQylVwDK-Pvvi1oSjBxNn0y5UesBdoN1iMAFuF0
const EXPORT_SHEET_ID = process.env.EXPORT_SHEET_ID || '1JjreMQylVwDK-Pvvi1oSjBxNn0y5UesBdoN1iMAFuF0';

// Columnas que se exportan al Sheet
const COLS = [
  { key: 'razon_social',          label: 'Razón Social'              },
  { key: 'cuit',                  label: 'CUIT'                      },
  { key: 'total_bovinos',         label: 'Cabezas Total'             },
  { key: 'total_vacas',           label: 'Vacas'                     },
  { key: 'partido',              label: 'Partido Establecimiento'    },
  { key: 'provincia',            label: 'Provincia Establecimiento'  },
  { key: 'en_dcac',              label: 'En dCaC'                   },
  { key: 'ac',                   label: 'Asociado Comercial'        },
  { key: 'representante',        label: 'Representante'             },
  { key: 'operador',             label: 'Operador'                  },
  { key: 'q_op_total',           label: 'Ops dCaC'                  },
  { key: 'ult_op',               label: 'Últ. Operación'            },
  { key: 'ult_act',              label: 'Últ. Actividad'            },
  { key: 'ccc',                  label: 'CCC %'                     },
  { key: 'ci_faena',             label: 'CI Faena'                  },
  { key: 'ci_invernada',         label: 'CI Invernada'              },
  { key: 'q_ventas_fae',         label: 'Ventas Faena'              },
  { key: 'q_ventas_inv',         label: 'Ventas Invernada'          },
  { key: 'q_ventas_cria',        label: 'Ventas Cría'               },
];



export async function POST(req) {
  try {
    const body = await req.json();
    const { filas = [], filtro = 'todas', zona = '' } = body;

    // Nombre único de pestaña: incluye fecha + hora para no pisar exportaciones previas
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const ts  = `${pad(now.getDate())}/${pad(now.getMonth()+1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const filtroLabel = { todas:'Todas', bc:'Solo BC', dcac:'En dCaC', libres:'Cuentas Libres', mermas:'Mermas' }[filtro] || filtro;
    const sheetName = `Exp ${filtroLabel} ${ts}`;

    // Fila de metainfo
    const metaRow = [
      `Exportado: ${now.toLocaleString('es-AR')}`,
      `Filtro: ${filtroLabel}`,
      zona ? `Zona: ${zona}` : '',
      `Total: ${filas.length} sociedades`,
    ];

    // Header + datos
    const header   = COLS.map(c => c.label);
    const dataRows = filas.map(r => COLS.map(c => {
      const v = r[c.key];
      return v === null || v === undefined ? '' : v;
    }));

    const rows2D = [metaRow, header, ...dataRows];

    const { url } = await writeSheetData(sheetName, rows2D, EXPORT_SHEET_ID);
    return NextResponse.json({ url, filas: filas.length, sheetName });
  } catch (err) {
    console.error('[export-sociedades]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
