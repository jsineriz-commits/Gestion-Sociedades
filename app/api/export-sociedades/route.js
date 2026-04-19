import { NextResponse } from 'next/server';
import { writeSheetData } from '../../../lib/sheets.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

const SHEET_NAME = 'GDS-Exportación';

export async function POST(req) {
  try {
    const body = await req.json();
    const { filas = [], filtro = 'todas', zona = '', ts = '' } = body;

    // Cabecera: metainfo de la exportación
    const metaRow = [
      `Exportado: ${new Date().toLocaleString('es-AR')}`,
      `Filtro: ${filtro}`,
      zona ? `Zona/Deptos: ${zona}` : '',
      `Total filas: ${filas.length}`,
    ];

    // Fila de headers
    const header = COLS.map(c => c.label);

    // Filas de datos
    const dataRows = filas.map(r => COLS.map(c => {
      const v = r[c.key];
      return v === null || v === undefined ? '' : v;
    }));

    const rows2D = [metaRow, header, ...dataRows];

    const { url } = await writeSheetData(SHEET_NAME, rows2D);
    return NextResponse.json({ url, filas: filas.length });
  } catch (err) {
    console.error('[export-sociedades]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
