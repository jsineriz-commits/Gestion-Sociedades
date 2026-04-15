// api/getCuentaInfo.js
// Trae contexto completo de una cuenta desde Metabase Q188 + Q189
const { fetchMetabaseQuery } = require('./_lib/metabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const cuit = String(req.query.cuit || '').trim();
  if (!cuit) return res.status(400).json({ error: 'Falta parámetro: cuit' });

  try {
    // Ambas queries ya están cacheadas en memoria (warmup al iniciar)
    const [q188, q189] = await Promise.all([
      fetchMetabaseQuery(188),
      fetchMetabaseQuery(189),
    ]);

    // ── Q188: base clave (establecimientos) ─────────────────────────────────
    const bc = q188.find(r => String(r.cuit || '').trim() === cuit);

    // ── Q189: actividad operacional ──────────────────────────────────────────
    const op = q189.find(r => String(r['st.cuit'] || r.cuit || '').trim() === cuit);

    if (!bc && !op) {
      return res.status(200).json({ found: false, cuit });
    }

    // ── Construir respuesta enriquecida ──────────────────────────────────────
    const info = {
      found: true,
      cuit,

      // Identidad
      razonSocial: bc?.razon_social || op?.['st.razon_social'] || '',
      razonSocialSenasa: bc?.razon_social_senasa || '',

      // Establecimiento principal (Base Clave - Q188)
      estPrincipal: formatLugar(bc?.partido_registro_dcac, bc?.prov_registro_dcac) ||
                    formatLugar(bc?.partido_establecimiento_senasa, bc?.prov_establecimiento_senasa),
      localidad: op?.localidad_est || '',
      todasProvincias: op?.todas_las_provincias_bc || '',
      todosPartidos: op?.todos_los_partidos_bc || '',

      // Stock (Kt / Kv)
      kt: num(bc?.total_bovinos ?? op?.total_bovinos),
      kv: num(bc?.total_vacas),

      // Contacto
      contacto: formatContacto(bc),

      // Fechas clave
      ultimoIngreso: bc?.ultimo_ingreso_sociedad || op?.ult_ingreso || '',
      FUC:  op?.FUC  || '',
      FUV:  op?.FUV_fae || op?.FUV_inv || '',
      FUVcria: op?.FUV_cria || '',
      ultOp: op?.Ult_op || '',
      ultAct: op?.Ult_act || '',
      ultNoConc: op?.ult_no_conc || '',
      ultOferta: op?.ult_oferta || '',

      // Operaciones
      qOpTotal: num(op?.q_op_total),
      qComprasFae: num(op?.q_compras_fae),
      qVentasFae: num(op?.q_ventas_fae),
      qComprasInv: num(op?.q_compras_inv),
      qVentasInv: num(op?.q_ventas_inv),
      qComprasCria: num(op?.q_compras_cria),
      qVentasCria: num(op?.q_ventas_cria),
      qOfrecInv: num(op?.q_ofrec_inv),
      qOfrecFae: num(op?.q_ofrec_fae),

      // Concreción
      concGral: pct(op?.conc_gral),
      concGralInv: pct(op?.conc_gral_inv),
      concGralFae: pct(op?.conc_gral_fae),
      porcConc5: pct(op?.porc_conc_5_Tot),

      // Cabezas operadas
      cabezasOperadas: num(bc?.cabezas_operadas_dcac),
      sugeridoFae: num(op?.sugerido_ci_faena),
      sugeridoInv: num(op?.sugerido_ci_invernada),

      // Comercial
      ac: op?.asociado_comercial || '',
      representante: op?.representante || '',
      operador: op?.operador || '',
      enDcac: bc?.existe_en_dcac === 'SI',
      qUsuarios: num(op?.q_usuarios ?? bc?.total_usuarios_asociados),
      fechaCreacion: bc?.fecha_creacion_sociedad || op?.fecha_creacion || '',
    };

    return res.status(200).json(info);
  } catch (e) {
    console.error('[api/getCuentaInfo]', e.message);
    res.status(500).json({ error: e.message });
  }
};

function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function pct(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  // Si ya viene como porcentaje (0-100) lo devolvemos; si es decimal (0-1) multiplicamos
  return n > 1 ? Math.round(n * 10) / 10 : Math.round(n * 1000) / 10;
}

function formatLugar(partido, prov) {
  const p = String(partido || '').trim();
  const pr = String(prov || '').trim();
  if (!p && !pr) return '';
  if (!pr) return p;
  if (!p) return pr;
  return `${p}, ${pr}`;
}

function formatContacto(bc) {
  if (!bc) return null;
  const nombre = `${bc.nombre_contacto_principal || ''} ${bc.apellido_contacto_principal || ''}`.trim();
  if (!nombre && !bc.telefono_contacto_principal && !bc.mail_contacto_principal) return null;
  return {
    nombre,
    telefono: bc.telefono_contacto_principal || '',
    mail: bc.mail_contacto_principal || '',
  };
}
