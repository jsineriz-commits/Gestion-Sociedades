import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get('cardId');

  if (!cardId) return NextResponse.json({ error: 'Falta cardId' }, { status: 400 });

  // 🪄 MAGIA DE CACHÉ PARA OPTIMIZAR VELOCIDAD
  let revalidateTime = 3600; // 1 hora por defecto
  if (cardId === '4550') revalidateTime = 604800; // El historial viejo guarda 7 días
  if (cardId === '4553' || cardId === '4555') revalidateTime = 300; // Las nuevas consultan cada 5 min

  try {
    // 1. Auth con Metabase
    const sessionRes = await fetch(`${process.env.METABASE_URL}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.METABASE_USERNAME,
        password: process.env.METABASE_PASSWORD,
      }),
      cache: 'no-store'
    });

    if (!sessionRes.ok) {
      return NextResponse.json({ error: 'Fallo autenticación con Metabase' }, { status: 401 });
    }

    const { id: sessionToken } = await sessionRes.json();

    // 2. Fetch de la Card a Metabase
    const cardRes = await fetch(`${process.env.METABASE_URL}/api/card/${cardId}/query`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Metabase-Session': sessionToken 
      },
      next: { revalidate: revalidateTime }
    });

    const rawData = await cardRes.json();

    if (rawData.error) {
      return NextResponse.json(rawData, { status: 400 });
    }

    // 🛡️ EL TRADUCTOR: Convierte las filas crudas en objetos entendibles para React
    let finalData = rawData;

    const formatMetabaseData = (sourceObj: any) => {
      const rows = sourceObj.rows;
      const cols = sourceObj.cols || sourceObj.columns;
      
      if (rows && Array.isArray(rows) && cols && Array.isArray(cols)) {
        const colNames = cols.map((c: any) => c.name || c);
        return rows.map((row: any[]) => {
          const rowObj: any = {};
          row.forEach((value, index) => {
            rowObj[colNames[index]] = value;
          });
          return rowObj;
        });
      }
      return null;
    };

    // Probamos extraer según cómo venga empaquetado el JSON
    if (rawData.data) {
      const parsed = formatMetabaseData(rawData.data);
      if (parsed) finalData = parsed;
    } else if (rawData.rows) {
      const parsed = formatMetabaseData(rawData);
      if (parsed) finalData = parsed;
    }

    // Devolvemos la data limpia y formateada al Frontend
    return NextResponse.json(finalData);

  } catch (error: any) {
    console.error('[Metabase] Exception:', error.message);
    return NextResponse.json({ error: `Exception: ${error.message}` }, { status: 500 });
  }
}