import { NextResponse } from 'next/server';
import { runMetabaseQuery } from '../../../lib/metabase.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Q190: Roster Usuarios NextJS
const CARD_ID = 190;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { busqueda } = body;

    let parameters = [];
    if (busqueda && busqueda.trim()) {
      parameters.push({
        type: 'category',
        target: ['variable', ['template-tag', 'busqueda']],
        value: busqueda.trim(),
      });
    }

    const rows = await runMetabaseQuery(CARD_ID, parameters);
    return NextResponse.json({ data: { rows } });
  } catch (error) {
    console.error('[/api/usuarios] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Error consultando Metabase' },
      { status: 500 }
    );
  }
}
