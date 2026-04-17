'use client';
import { useState, useEffect, useCallback } from 'react';

const T = {
  brand: '#3179a7',
  brandHover: '#2d6e98',
  brandSubtle: '#eaf2f6',
  brandBorder: '#bfd5e4',
  surfaceL1: '#f8f8f8',
  surfaceL2: '#ffffff',
  surfacePage: '#ededed',
  contentPrimary: '#555555',
  contentSecondary: '#666666',
  contentTertiary: '#888888',
  contentDisabled: '#c0c0c0',
  borderSecondary: '#c0c0c0',
  borderTertiary: '#ededed',
  positive: '#54a22b',
  positiveSubtle: '#eef6ea',
  positiveBorder: '#cae2bd',
  negative: '#e76162',
  negativeSubtle: '#fdefef',
  notice: '#e45a00',
  noticeSubtle: '#fcefe6',
};

const STORAGE_KEY = 'dcac_cuentas_comments';

function loadComments() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveComments(comments) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(comments)); } catch {}
}

function buildCuentas(comments) {
  const map = {};
  for (const c of comments) {
    if (!c.cuit) continue;
    if (!map[c.cuit]) map[c.cuit] = { cuit: c.cuit, comments: [] };
    map[c.cuit].comments.push(c);
  }
  for (const k in map) map[k].comments.reverse();
  return Object.values(map).sort((a, b) => b.comments.length - a.comments.length);
}

// Panel de info desde datos ya cargados (data188 + data189)
function InfoPanel({ cuit, data188, data189 }) {
  const bc = (data188 || []).find(r => String(r.cuit || '').trim() === cuit);
  const op = (data189 || []).find(r => String(r['st.cuit'] || r.cuit || '').trim() === cuit);

  if (!bc && !op) {
    return (
      <p style={{ color: T.contentTertiary, fontSize: 13, borderBottom: `1px solid ${T.borderTertiary}`, paddingBottom: 12, marginBottom: 12 }}>
        CUIT no encontrado en los datos cargados.
        {(!data188 || data188.length === 0) && ' (Cargá datos primero desde el panel lateral.)'}
      </p>
    );
  }

  const kt = parseFloat((bc || op)?.total_bovinos) || null;
  const kv = parseFloat(bc?.total_vacas) || null;
  const ac = String(op?.asociado_comercial || '').trim();
  const enDcac = bc?.existe_en_dcac === 'SI' || !!op;
  const razon = bc?.razon_social_senasa || bc?.razon_social || op?.['st.razon_social'] || '';
  const prov = bc?.prov_establecimiento_senasa || bc?.prov_fiscal_senasa || op?.prov_est_bc || '';
  const partido = bc?.partido_establecimiento_senasa || op?.part_est_bc || '';
  const fuact = op?.Ult_act ? new Date(op.Ult_act).toLocaleDateString('es-AR') : null;
  const fuop = op?.Ult_op ? new Date(op.Ult_op).toLocaleDateString('es-AR') : null;
  const concGral = op?.conc_gral ? (parseFloat(op.conc_gral) * 100).toFixed(0) + '%' : null;

  return (
    <div style={{ borderBottom: `1px solid ${T.borderTertiary}`, paddingBottom: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <span style={{ background: enDcac ? T.positiveSubtle : T.surfaceL1, color: enDcac ? T.positive : T.contentTertiary, border: `1px solid ${enDcac ? T.positiveBorder : T.borderSecondary}`, borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
          {enDcac ? 'En dCaC' : 'Sin dCaC'}
        </span>
        {ac && <span style={{ background: T.brandSubtle, color: T.brand, border: `1px solid ${T.brandBorder}`, borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{ac}</span>}
      </div>
      {razon && <p style={{ fontSize: 13, color: T.contentSecondary, marginBottom: 4 }}>🏢 {razon}</p>}
      {(prov || partido) && <p style={{ fontSize: 13, color: T.contentSecondary, marginBottom: 8 }}>📍 {[partido, prov].filter(Boolean).join(', ')}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 8 }}>
        {[{ l: 'Kt', v: kt != null ? kt.toLocaleString('es-AR') : '—', c: T.notice, bg: T.noticeSubtle },
          { l: 'Kv', v: kv != null ? kv.toLocaleString('es-AR') : '—', c: T.positive, bg: T.positiveSubtle },
          { l: 'Conc.', v: concGral || '—', c: T.brand, bg: T.brandSubtle }
        ].map(k => (
          <div key={k.l} style={{ background: k.bg, borderRadius: 8, padding: '6px 8px', border: `1px solid ${T.borderTertiary}` }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: k.c }}>{k.v}</div>
            <div style={{ fontSize: 10, color: T.contentTertiary }}>{k.l}</div>
          </div>
        ))}
      </div>
      {(fuact || fuop) && (
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: T.contentTertiary }}>
          {fuop && <span>Últ. Op: <strong style={{ color: T.contentPrimary }}>{fuop}</strong></span>}
          {fuact && <span>Últ. Act: <strong style={{ color: T.contentPrimary }}>{fuact}</strong></span>}
        </div>
      )}
    </div>
  );
}

export default function CuentasTab({ data188, data189 }) {
  const [allComments, setAllComments] = useState([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [newCuit, setNewCuit] = useState('');
  const [newComment, setNewComment] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setAllComments(loadComments());
  }, []);

  const cuentas = buildCuentas(allComments);
  const filtered = search
    ? cuentas.filter(c => c.cuit.includes(search.toLowerCase()))
    : cuentas;

  const addComment = (cuit, texto) => {
    if (!texto.trim()) return;
    const now = new Date();
    const fecha = now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const updated = [{ cuit, fecha, comentario: texto.trim() }, ...allComments];
    setAllComments(updated);
    saveComments(updated);
  };

  const toggleExpand = (cuit) => {
    setExpanded(prev => { const n = new Set(prev); n.has(cuit) ? n.delete(cuit) : n.add(cuit); return n; });
  };

  const inputStyle = {
    width: '100%', padding: '8px 12px', border: `1px solid ${T.borderSecondary}`,
    borderRadius: 6, fontSize: 14, color: T.contentPrimary, background: T.surfaceL2,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  if (!isClient) return null;

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: T.surfacePage }}>
      {/* Header */}
      <div style={{ background: T.surfaceL2, borderBottom: `1px solid ${T.borderTertiary}`, padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.contentPrimary }}>Gestión de Cuentas</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: T.contentTertiary }}>Comentarios guardados localmente</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text" placeholder="Buscar CUIT…" value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...inputStyle, width: 240, paddingLeft: 32 }}
              />
              <span style={{ position: 'absolute', left: 10, top: 10, color: T.contentTertiary, fontSize: 14 }}>🔍</span>
            </div>
            <button onClick={() => setShowForm(p => !p)} style={{ background: T.brand, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              + Nueva cuenta
            </button>
          </div>
        </div>

        {showForm && (
          <div style={{ marginTop: 16, background: T.brandSubtle, border: `1px solid ${T.brandBorder}`, borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontWeight: 600, color: T.brand, fontSize: 14, margin: 0 }}>Agregar comentario a cuenta</p>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: T.contentTertiary, cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <input type="text" placeholder="CUIT (ej: 20123456789)" value={newCuit}
              onChange={e => setNewCuit(e.target.value)} style={{ ...inputStyle, marginBottom: 8, fontFamily: 'monospace' }} />
            <textarea placeholder="Comentario sobre esta cuenta…" value={newComment}
              onChange={e => setNewComment(e.target.value)} rows={3}
              style={{ ...inputStyle, resize: 'none', marginBottom: 8 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => {
                if (!newCuit.trim() || !newComment.trim()) return;
                addComment(newCuit.trim(), newComment.trim());
                setNewCuit(''); setNewComment(''); setShowForm(false);
                setExpanded(p => new Set([...p, newCuit.trim()]));
              }} style={{ background: T.brand, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Guardar comentario
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de cuentas */}
      <div style={{ maxWidth: 760, margin: '24px auto', padding: '0 16px' }}>
        {allComments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0', color: T.contentTertiary }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
            <p style={{ fontSize: 16 }}>Todavía no hay cuentas cargadas</p>
            <p style={{ fontSize: 13 }}>Usá el botón "Nueva cuenta" para agregar el primer comentario.</p>
          </div>
        )}

        {filtered.map(cuenta => {
          const isOpen = expanded.has(cuenta.cuit);
          return (
            <div key={cuenta.cuit} style={{ background: T.surfaceL2, border: `1px solid ${T.borderTertiary}`, borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
              <button
                onClick={() => toggleExpand(cuenta.cuit)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = T.surfaceL1}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <div>
                  <div style={{ fontWeight: 600, color: T.contentPrimary, fontSize: 14, fontFamily: 'monospace' }}>{cuenta.cuit}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: T.contentTertiary, background: T.surfaceL1, border: `1px solid ${T.borderTertiary}`, borderRadius: 99, padding: '2px 10px' }}>
                    {cuenta.comments.length} comentario{cuenta.comments.length !== 1 ? 's' : ''}
                  </span>
                  <span style={{ color: T.contentTertiary, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', fontSize: 18 }}>▾</span>
                </div>
              </button>

              {isOpen && (
                <div style={{ borderTop: `1px solid ${T.borderTertiary}`, padding: '16px 20px' }}>
                  <InfoPanel cuit={cuenta.cuit} data188={data188} data189={data189} />

                  {/* Timeline */}
                  <div style={{ marginBottom: 16 }}>
                    {cuenta.comments.map((c, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.brand, flexShrink: 0 }} />
                          {i < cuenta.comments.length - 1 && <div style={{ width: 1, flex: 1, background: T.borderTertiary, marginTop: 4 }} />}
                        </div>
                        <div style={{ flex: 1, paddingBottom: 8 }}>
                          <p style={{ fontSize: 14, color: T.contentPrimary, lineHeight: 1.5, margin: 0 }}>{c.comentario}</p>
                          <p style={{ fontSize: 12, color: T.contentTertiary, marginTop: 4 }}>{c.fecha}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Form agregar */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <textarea
                      placeholder="Agregar comentario…"
                      value={commentInputs[cuenta.cuit] || ''}
                      onChange={e => setCommentInputs(p => ({ ...p, [cuenta.cuit]: e.target.value }))}
                      rows={2}
                      style={{ ...inputStyle, flex: 1, resize: 'none', background: T.surfaceL1 }}
                    />
                    <button
                      onClick={() => {
                        addComment(cuenta.cuit, commentInputs[cuenta.cuit] || '');
                        setCommentInputs(p => ({ ...p, [cuenta.cuit]: '' }));
                      }}
                      style={{ background: T.brand, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', alignSelf: 'flex-end' }}
                    >📤</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
