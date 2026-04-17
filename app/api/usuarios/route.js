import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { busqueda } = body;

    const METABASE_URL = process.env.METABASE_URL;
    const METABASE_API_KEY = process.env.METABASE_API_KEY;
    const CARD_ID = 190; // Q190: Roster Usuarios NextJS

    const parameters = [];
    if (busqueda && busqueda.trim()) {
       parameters.push({
         type: 'category',
         target: ['variable', ['template-tag', 'busqueda']],
         value: busqueda.trim()
       });
    }

    const bodyParams = new URLSearchParams({
      parameters: JSON.stringify(parameters)
    });

    const response = await fetch(`${METABASE_URL}/api/card/${CARD_ID}/query/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-API-Key': METABASE_API_KEY,
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: 'Failed to fetch data', details: errText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ data: { rows: data } });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
