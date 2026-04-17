// lib para conectar a Metabase con usuario y contraseña
// Variables de entorno: METABASE_URL, METABASE_USERNAME, METABASE_PASSWORD

let cachedSession = null;
let sessionExpiry = 0;

export async function getMetabaseSession() {
  const now = Date.now();
  // Reutilizar sesión si tiene menos de 25 minutos
  if (cachedSession && now < sessionExpiry) return cachedSession;

  const url = process.env.METABASE_URL;
  const username = process.env.METABASE_USERNAME;
  const password = process.env.METABASE_PASSWORD;

  if (!url || !username || !password) {
    throw new Error(
      `Variables de Metabase no configuradas. Asegurate de definir METABASE_URL, METABASE_USERNAME y METABASE_PASSWORD en .env.local\n` +
      `Valores actuales: URL=${url ? '✓' : '✗'} USER=${username ? '✓' : '✗'} PASS=${password ? '✓' : '✗'}`
    );
  }

  const base = url.endsWith('/') ? url : url + '/';
  const res = await fetch(`${base}api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Auth Metabase falló (${res.status}): ${body.substring(0, 300)}`);
  }

  const data = await res.json();
  if (!data.id) throw new Error('Metabase no devolvió token de sesión');

  cachedSession = { token: data.id, base };
  sessionExpiry = now + 25 * 60 * 1000;
  return cachedSession;
}

/**
 * Ejecuta una query de Metabase y devuelve el array de objetos JSON
 * @param {number} cardId - ID de la pregunta en Metabase
 * @param {Array} parameters - Parámetros opcionales para la query
 * @returns {Promise<Array>}
 */
export async function runMetabaseQuery(cardId, parameters = []) {
  const session = await getMetabaseSession();

  const bodyParams = new URLSearchParams({
    parameters: JSON.stringify(parameters),
  });

  const res = await fetch(`${session.base}api/card/${cardId}/query/json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Metabase-Session': session.token,
    },
    body: bodyParams.toString(),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Metabase card ${cardId} falló (${res.status}): ${errText.substring(0, 300)}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(`Metabase card ${cardId} devolvió formato inesperado: ${JSON.stringify(data).substring(0, 200)}`);
  }
  return data;
}
