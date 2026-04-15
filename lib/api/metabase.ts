/**
 * Cliente de Metabase para obtener datos desde la Web App
 */

export async function getMetabaseCard(cardId: number | string) {
  try {
    const response = await fetch(`/api/metabase?cardId=${cardId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al obtener la tarjeta ${cardId}: ${response.status}`);
    }

    const result = await response.json();
    
    // La API devuelve un array directamente
    // NO un objeto con propiedad .data
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Error en getMetabaseCard:', error);
    throw error;
  }
}

export async function getMetabaseCards(cardIds: (number | string)[]) {
  try {
    const results = await Promise.all(
      cardIds.map(cardId => getMetabaseCard(cardId))
    );
    return results;
  } catch (error) {
    console.error('Error en getMetabaseCards:', error);
    throw error;
  }
}
