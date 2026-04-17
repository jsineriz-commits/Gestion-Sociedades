import { NextResponse } from 'next/server';
import { runMetabaseQuery } from '../../../lib/metabase.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Q188: Base Clave Senasa (prospectos)
const CARD_ID = 188;

export async function POST(request) {
  try {
    const { provincia } = await request.json();

    let parameters = [];
    if (provincia && provincia.length > 0) {
      parameters.push({
        type: 'category',
        target: ['variable', ['template-tag', 'provincia']],
        value: provincia,
      });
    }

    const rows = await runMetabaseQuery(CARD_ID, parameters);
    return NextResponse.json({ data: { rows } });
  } catch (error) {
    console.error('[/api/prospectos] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Error consultando Metabase' },
      { status: 500 }
    );
  }
}
