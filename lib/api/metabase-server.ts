/**
 * Helpers de servidor para la integración con Metabase.
 * Solo importar desde rutas de API (server-side).
 */

/**
 * Convierte el formato crudo de Metabase ({ cols, rows }) en un array de objetos.
 * Soporta tanto `sourceObj.data` como `sourceObj` directamente.
 */
export function formatMetabaseData(sourceObj: any): any[] | null {
    const rows = sourceObj?.rows;
    const cols = sourceObj?.cols || sourceObj?.columns;
    if (rows && Array.isArray(rows) && cols && Array.isArray(cols)) {
        const colNames = cols.map((c: any) => c.name || c);
        return rows.map((row: any[]) => {
            const obj: any = {};
            row.forEach((v, i) => { obj[colNames[i]] = v; });
            return obj;
        });
    }
    return null;
}
