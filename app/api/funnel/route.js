import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { provincia } = await request.json();

    const METABASE_URL = process.env.METABASE_URL;
    const METABASE_API_KEY = process.env.METABASE_API_KEY;
    const CARD_ID = 189; // Q189: Soc_Nuevo_AC_DC

    let parameters = [];

    if (provincia && provincia.length > 0) {
      // Fetch dynamic template tag ID for provincia
      const cardRes = await fetch(`${METABASE_URL}/api/card/${CARD_ID}`, {
        headers: { 'X-API-Key': METABASE_API_KEY }
      });
      const cardData = await cardRes.json();
      
      const tags = cardData.dataset_query?.native?.['template-tags'] || cardData.dataset_query?.stages?.[0]?.['template-tags'] || {};
      const tagKey = Object.keys(tags).find(k => k.toLowerCase().includes('provincia') || tags[k].name?.toLowerCase().includes('provincia'));
      
      if (tagKey) {
         parameters.push({
            type: 'category',
            target: ['variable', ['template-tag', tags[tagKey].name]],
            value: provincia,
         });
      }
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
      return NextResponse.json({ error: 'Failed to fetch data from Metabase', details: errText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ data: { rows: data } });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
