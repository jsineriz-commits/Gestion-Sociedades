import { NextRequest, NextResponse } from 'next/server';
import { formatMetabaseData } from '@/lib/api/metabase-server';

// Reutilizar el caché de Q188+Q189 del endpoint /api/mapa si está disponible
// En este caso hacemos fetch independiente para no acoplar los módulos
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${process.env.METABASE_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: process.env.METABASE_USERNAME, password: process.env.METABASE_PASSWORD }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Auth Metabase failed');
  const { id } = await res.json();
  cachedToken = id; tokenExpiry = Date.now() + 110 * 60 * 1000;
  return id;
}

async function fetchQ(id: number, token: string): Promise<any[]> {
  const res = await fetch(
    `${process.env.METABASE_URL}/api/card/${id}/query/json?format_rows=false`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
      body: JSON.stringify({ constraints: { 'max-results': 1_000_000 } }), cache: 'no-store' }
  );
  if (!res.ok) {
    const r2 = await fetch(`${process.env.METABASE_URL}/api/card/${id}/query`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
        body: JSON.stringify({ constraints: { 'max-results': 1_000_000 } }), cache: 'no-store' });
    if (!r2.ok) throw new Error(`Q${id} HTTP ${r2.status}`);
    const raw = await r2.json();
    return formatMetabaseData(raw.data) || [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (formatMetabaseData((data as any).data || data) || []);
}

export async function GET(req: NextRequest) {
  const cuit = req.nextUrl.searchParams.get('cuit')?.trim();
  if (!cuit) return NextResponse.json({ error: 'Falta parámetro cuit' }, { status: 400 });

  try {
    const token = await getToken();
    const [q188, q189] = await Promise.all([fetchQ(188, token), fetchQ(189, token)]);

    const bc  = (q188 as any[]).find(r => String(r.cuit || '').trim() === cuit);
    const op  = (q189 as any[]).find(r => String(r['st.cuit'] || r.cuit || '').trim() === cuit);

    if (!bc && !op) return NextResponse.json({ found: false, cuit });

    const info = {
      found: true, cuit,
      razonSocial: bc?.razon_social || op?.['st.razon_social'] || '',
      estPrincipal: [bc?.partido_registro_dcac || bc?.partido_establecimiento_senasa, bc?.prov_registro_dcac || bc?.prov_establecimiento_senasa].filter(Boolean).join(', '),
      localidad: op?.localidad_est || '',
      kt: numOrNull(bc?.total_bovinos ?? op?.total_bovinos),
      kv: numOrNull(bc?.total_vacas),
      contacto: bc ? { nombre: `${bc.nombre_contacto_principal || ''} ${bc.apellido_contacto_principal || ''}`.trim(), telefono: bc.telefono_contacto_principal || '', mail: bc.mail_contacto_principal || '' } : null,
      ultimoIngreso: bc?.ultimo_ingreso_sociedad || op?.ult_ingreso || '',
      FUC: op?.FUC || '', FUV: op?.FUV_fae || op?.FUV_inv || '',
      ultOp: op?.Ult_op || '', ultAct: op?.Ult_act || '',
      ultNoConc: op?.ult_no_conc || '', ultOferta: op?.ult_oferta || '',
      qOpTotal: numOrNull(op?.q_op_total),
      qComprasFae: numOrNull(op?.q_compras_fae), qVentasFae: numOrNull(op?.q_ventas_fae),
      qComprasInv: numOrNull(op?.q_compras_inv), qVentasInv: numOrNull(op?.q_ventas_inv),
      concGral: pctOrNull(op?.conc_gral),
      cabezasOperadas: numOrNull(bc?.cabezas_operadas_dcac),
      sugeridoFae: numOrNull(op?.sugerido_ci_faena), sugeridoInv: numOrNull(op?.sugerido_ci_invernada),
      ac: op?.asociado_comercial || '', representante: op?.representante || '',
      enDcac: bc?.existe_en_dcac === 'SI',
      qUsuarios: numOrNull(op?.q_usuarios ?? bc?.total_usuarios_asociados),
      fechaCreacion: bc?.fecha_creacion_sociedad || '',
    };
    return NextResponse.json(info);
  } catch (e: any) {
    console.error('[api/cuentas/info]', e.message);
    cachedToken = null;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function numOrNull(v: any): number | null {
  const n = parseFloat(v); return isNaN(n) ? null : n;
}
function pctOrNull(v: any): number | null {
  const n = parseFloat(v); if (isNaN(n)) return null;
  return n > 1 ? Math.round(n * 10) / 10 : Math.round(n * 1000) / 10;
}
