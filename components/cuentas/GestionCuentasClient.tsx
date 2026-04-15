'use client';
import { useState, useEffect, useCallback } from 'react';

// ─── Design tokens (disenio/tokens.json — DeCampoacampo light) ───────────────
const T = {
  surfacePage:     '#ededed',
  surfaceL1:       '#f8f8f8',
  surfaceL2:       '#ffffff',
  brand:           '#3179a7',
  brandHover:      '#2d6e98',
  brandSubtle:     '#eaf2f6',
  brandBorder:     '#bfd5e4',
  contentPrimary:  '#555555',
  contentSecondary:'#666666',
  contentTertiary: '#888888',
  contentDisabled: '#c0c0c0',
  borderPrimary:   '#a4a4a4',
  borderSecondary: '#c0c0c0',
  borderTertiary:  '#ededed',
  positive:        '#54a22b',
  positiveSubtle:  '#eef6ea',
  positiveBorder:  '#cae2bd',
  negative:        '#e76162',
  negativeSubtle:  '#fdefef',
  notice:          '#e45a00',
  noticeSubtle:    '#fcefe6',
  noticeBorder:    '#f7ccb0',
  yellow:          '#b29b0e',
  yellowSubtle:    '#f7f5e7',
} as const;

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Comentario { cuit: string; fecha: string; comentario: string; }
interface CuentaData { cuit: string; nombre: string; comments: Comentario[]; }
interface CuentaInfo {
  found: boolean; cuit: string; razonSocial?: string; estPrincipal?: string;
  kt?: number | null; kv?: number | null; cabezasOperadas?: number | null;
  sugeridoFae?: number | null; sugeridoInv?: number | null; qOpTotal?: number | null;
  FUC?: string; FUV?: string; ultOp?: string; ultAct?: string; ultimoIngreso?: string;
  qComprasFae?: number | null; qVentasFae?: number | null;
  qComprasInv?: number | null; qVentasInv?: number | null; concGral?: number | null;
  ac?: string; enDcac?: boolean;
  contacto?: { nombre: string; telefono: string; mail: string; } | null;
}

function fmt(v: number | null | undefined, suffix = '') {
  if (v == null) return '—';
  return v.toLocaleString('es-AR') + suffix;
}

// ─── Panel de contexto Metabase ───────────────────────────────────────────────
function InfoPanel({ cuit }: { cuit: string }) {
  const [info, setInfo] = useState<CuentaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cuentas/info?cuit=${encodeURIComponent(cuit)}`)
      .then(r => r.json()).then(setInfo).catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [cuit]);

  if (loading) return (
    <div className="flex items-center gap-2 py-3" style={{ borderBottom: `1px solid ${T.borderTertiary}`, marginBottom: 12 }}>
      <span className="material-symbols-outlined animate-spin text-sm" style={{ color: T.brand }}>progress_activity</span>
      <span style={{ color: T.contentTertiary, fontSize: 13 }}>Cargando datos de la cuenta…</span>
    </div>
  );

  if (!info?.found) return (
    <p style={{ color: T.contentTertiary, fontSize: 13, borderBottom: `1px solid ${T.borderTertiary}`, paddingBottom: 12, marginBottom: 12 }}>
      Sin datos en Base Clave para este CUIT.
    </p>
  );

  return (
    <div style={{ borderBottom: `1px solid ${T.borderTertiary}`, paddingBottom: 16, marginBottom: 16 }}>
      {/* Badges funcionales */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span style={{
          background: info.enDcac ? T.positiveSubtle : T.surfaceL1,
          color: info.enDcac ? T.positive : T.contentTertiary,
          border: `1px solid ${info.enDcac ? T.positiveBorder : T.borderSecondary}`,
          borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600,
        }}>
          {info.enDcac ? 'En dCaC' : 'Sin dCaC'}
        </span>
        {info.ac && (
          <span style={{
            background: T.brandSubtle, color: T.brand,
            border: `1px solid ${T.brandBorder}`, borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600,
          }}>{info.ac}</span>
        )}
      </div>

      {/* Info básica */}
      {info.razonSocial && (
        <p className="flex items-center gap-1.5 mb-1" style={{ fontSize: 13, color: T.contentSecondary }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: T.contentTertiary }}>business</span>
          {info.razonSocial}
        </p>
      )}
      {info.estPrincipal && (
        <p className="flex items-center gap-1.5 mb-1" style={{ fontSize: 13, color: T.contentSecondary }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: T.contentTertiary }}>location_on</span>
          {info.estPrincipal}
        </p>
      )}
      {info.contacto?.nombre && (
        <p className="flex items-center gap-1.5 mb-3" style={{ fontSize: 13, color: T.contentSecondary }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: T.contentTertiary }}>person</span>
          {info.contacto.nombre}
          {info.contacto.telefono && ` · ${info.contacto.telefono}`}
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Kt',         val: fmt(info.kt),              bg: T.noticeSubtle,   fg: T.notice  },
          { label: 'Kv',         val: fmt(info.kv),              bg: T.positiveSubtle, fg: T.positive},
          { label: 'Kop dCaC',   val: fmt(info.cabezasOperadas), bg: T.brandSubtle,    fg: T.brand   },
          { label: 'Sug. Fae',   val: fmt(info.sugeridoFae),     bg: T.surfaceL1,      fg: T.contentSecondary},
          { label: 'Sug. Inv',   val: fmt(info.sugeridoInv),     bg: T.surfaceL1,      fg: T.contentSecondary},
          { label: 'Op. Total',  val: fmt(info.qOpTotal),        bg: T.surfaceL1,      fg: T.contentSecondary},
        ].map(k => (
          <div key={k.label} className="rounded-lg p-2.5"
            style={{ background: k.bg, border: `1px solid ${T.borderTertiary}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: k.fg }}>{k.val}</div>
            <div style={{ fontSize: 11, color: T.contentTertiary, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Fechas clave */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5" style={{ fontSize: 12, color: T.contentTertiary }}>
        {([['FUC', info.FUC], ['FUV', info.FUV], ['Últ. Op.', info.ultOp], ['Últ. Act.', info.ultAct], ['Ingreso', info.ultimoIngreso]] as [string, string | undefined][])
          .filter(([, v]) => v)
          .map(([l, v]) => (
            <div key={l}>{l}: <span style={{ color: T.contentPrimary }}>{v}</span></div>
          ))}
      </div>

      {/* Detalle ops */}
      {(info.concGral != null) && (
        <div className="flex items-center gap-1.5 mt-2" style={{ fontSize: 12, color: T.contentTertiary }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>percent</span>
          Concreción gral: <span style={{ fontWeight: 700, color: T.positive }}>{fmt(info.concGral)}%</span>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function GestionCuentasClient() {
  const [allComments,   setAllComments]   = useState<Comentario[]>([]);
  const [cuentasData,   setCuentasData]   = useState<CuentaData[]>([]);
  const [filtered,      setFiltered]      = useState<CuentaData[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [expanded,      setExpanded]      = useState<Set<string>>(new Set());
  const [saving,        setSaving]        = useState<string | null>(null);
  const [showNewForm,   setShowNewForm]   = useState(false);
  const [newCuit,       setNewCuit]       = useState('');
  const [newComment,    setNewComment]    = useState('');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [savingNew,     setSavingNew]     = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const buildCuentas = useCallback((comments: Comentario[]): CuentaData[] => {
    const map: Record<string, CuentaData> = {};
    for (const c of comments) {
      if (!c.cuit) continue;
      if (!map[c.cuit]) map[c.cuit] = { cuit: c.cuit, nombre: '', comments: [] };
      map[c.cuit].comments.push(c);
    }
    for (const k in map) map[k].comments.reverse();
    return Object.values(map).sort((a, b) => b.comments.length - a.comments.length);
  }, []);

  useEffect(() => {
    fetch('/api/cuentas/comments')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((data: Comentario[]) => {
        setAllComments(data);
        const cd = buildCuentas(data);
        setCuentasData(cd); setFiltered(cd);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [buildCuentas]);

  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    setFiltered(!q ? cuentasData : cuentasData.filter(c =>
      c.cuit.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q)
    ));
  }, [searchQuery, cuentasData]);

  const toggleExpand = (cuit: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(cuit) ? n.delete(cuit) : n.add(cuit); return n; });

  const saveComment = async (cuit: string) => {
    const texto = (commentInputs[cuit] || '').trim();
    if (!texto) return;
    setSaving(cuit);
    try {
      const res = await fetch('/api/cuentas/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuit, comentario: texto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = [{ cuit, fecha: data.fecha, comentario: texto }, ...allComments];
      setAllComments(updated);
      const cd = buildCuentas(updated); setCuentasData(cd);
      setCommentInputs(p => ({ ...p, [cuit]: '' }));
    } catch (e: any) { alert(e.message); }
    finally { setSaving(null); }
  };

  const saveNewCuenta = async () => {
    const cuit = newCuit.trim(); const comentario = newComment.trim();
    if (!cuit || !comentario) return;
    setSavingNew(true);
    try {
      const res  = await fetch('/api/cuentas/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuit, comentario }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = [{ cuit, fecha: data.fecha, comentario }, ...allComments];
      setAllComments(updated);
      const cd = buildCuentas(updated); setCuentasData(cd); setFiltered(cd);
      setNewCuit(''); setNewComment(''); setShowNewForm(false);
      setExpanded(p => new Set([...p, cuit]));
    } catch (e: any) { alert(e.message); }
    finally { setSavingNew(false); }
  };

  // ─── Input style helper ──────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: T.surfaceL2, border: `1px solid ${T.borderSecondary}`,
    borderRadius: 6, padding: '8px 12px', fontSize: 14, color: T.contentPrimary,
    width: '100%', outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div style={{ minHeight: '100vh', background: T.surfacePage, color: T.contentPrimary }}>
      {/* Header */}
      <header style={{ background: T.surfaceL2, borderBottom: `1px solid ${T.borderTertiary}` }}
        className="px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: T.contentPrimary }}>Gestión de Cuentas</h1>
            <p style={{ color: T.contentTertiary, fontSize: 13, marginTop: 2 }}>Comentarios e historial por cuenta</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Buscador */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2" style={{ fontSize: 18, color: T.contentTertiary }}>search</span>
              <input
                type="text"
                placeholder="Buscar CUIT o razón social…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 36, paddingRight: searchQuery ? 32 : 12, width: 280 }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', cursor: 'pointer', color: T.contentTertiary }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              )}
            </div>
            {/* Botón nueva cuenta */}
            <button
              onClick={() => setShowNewForm(p => !p)}
              style={{
                background: T.brand, color: '#fff', border: 'none',
                borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = T.brandHover)}
              onMouseLeave={e => (e.currentTarget.style.background = T.brand)}
            >
              + Nueva cuenta
            </button>
          </div>
        </div>

        {/* Formulario nueva cuenta */}
        {showNewForm && (
          <div style={{
            marginTop: 16, background: T.brandSubtle, border: `1px solid ${T.brandBorder}`,
            borderRadius: 8, padding: 16,
          }}>
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ fontSize: 14, fontWeight: 600, color: T.brand }}>Agregar comentario a una cuenta</h3>
              <button onClick={() => setShowNewForm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.contentTertiary }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="CUIT (ej: 20-12345678-9)" value={newCuit}
                onChange={e => setNewCuit(e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace' }} />
              <textarea placeholder="Escribí el comentario sobre esta cuenta…" value={newComment}
                onChange={e => setNewComment(e.target.value)} rows={3}
                style={{ ...inputStyle, resize: 'none' }} />
              <div className="flex justify-end">
                <button onClick={saveNewCuenta} disabled={savingNew}
                  style={{
                    background: savingNew ? T.contentDisabled : T.brand,
                    color: '#fff', border: 'none', borderRadius: 6,
                    padding: '8px 20px', fontSize: 14, fontWeight: 600,
                    cursor: savingNew ? 'not-allowed' : 'pointer',
                  }}>
                  {savingNew ? 'Guardando…' : 'Guardar comentario'}
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Lista */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-20 gap-2">
            <span className="material-symbols-outlined animate-spin" style={{ color: T.brand }}>progress_activity</span>
            <span style={{ color: T.contentTertiary }}>Cargando cuentas…</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-4 rounded-lg"
            style={{ background: T.negativeSubtle, border: `1px solid ${T.negative}20` }}>
            <span className="material-symbols-outlined" style={{ color: T.negative }}>error</span>
            <span style={{ color: T.negative, fontSize: 14 }}>{error}</span>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl block mb-3" style={{ color: T.contentDisabled }}>
              {searchQuery ? 'search_off' : 'folder_open'}
            </span>
            <p style={{ color: T.contentTertiary }}>
              {searchQuery ? 'Sin resultados para esta búsqueda' : 'Todavía no hay cuentas cargadas'}
            </p>
          </div>
        )}

        {filtered.map(cuenta => {
          const isOpen = expanded.has(cuenta.cuit);
          return (
            <div key={cuenta.cuit} className="rounded-xl overflow-hidden"
              style={{ background: T.surfaceL2, border: `1px solid ${T.borderTertiary}` }}>
              {/* Header de la card */}
              <button
                onClick={() => toggleExpand(cuenta.cuit)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = T.surfaceL1)}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <div>
                  <div style={{ fontWeight: 600, color: T.contentPrimary, fontSize: 14 }}>
                    {cuenta.nombre || `CUIT ${cuenta.cuit}`}
                  </div>
                  {cuenta.nombre && (
                    <div style={{ fontSize: 12, color: T.contentTertiary, fontFamily: 'monospace', marginTop: 2 }}>
                      {cuenta.cuit}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span style={{
                    fontSize: 12, color: T.contentTertiary,
                    background: T.surfaceL1, border: `1px solid ${T.borderTertiary}`,
                    borderRadius: 99, padding: '2px 10px',
                  }}>
                    {cuenta.comments.length} comentario{cuenta.comments.length !== 1 ? 's' : ''}
                  </span>
                  <span className="material-symbols-outlined"
                    style={{ fontSize: 18, color: T.contentTertiary, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    expand_more
                  </span>
                </div>
              </button>

              {/* Cuerpo */}
              {isOpen && (
                <div style={{ borderTop: `1px solid ${T.borderTertiary}`, padding: '16px 20px' }}>
                  <InfoPanel cuit={cuenta.cuit} />

                  {/* Timeline */}
                  <div className="space-y-3 mb-4">
                    {cuenta.comments.map((c, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center pt-1">
                          <div className="w-2 h-2 rounded-full" style={{ background: T.brand, flexShrink: 0 }} />
                          {i < cuenta.comments.length - 1 && (
                            <div className="w-px flex-1 mt-1" style={{ background: T.borderTertiary }} />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <p style={{ fontSize: 14, color: T.contentPrimary, lineHeight: 1.5 }}>{c.comentario}</p>
                          <p style={{ fontSize: 12, color: T.contentTertiary, marginTop: 3 }}>{c.fecha}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Form nuevo comentario */}
                  <div className="flex gap-2">
                    <textarea
                      placeholder="Agregar comentario…"
                      value={commentInputs[cuenta.cuit] || ''}
                      onChange={e => setCommentInputs(p => ({ ...p, [cuenta.cuit]: e.target.value }))}
                      rows={2}
                      style={{ ...inputStyle, resize: 'none', flex: 1, background: T.surfaceL1 }}
                    />
                    <button
                      onClick={() => saveComment(cuenta.cuit)}
                      disabled={saving === cuenta.cuit}
                      style={{
                        background: saving === cuenta.cuit ? T.contentDisabled : T.brand,
                        color: '#fff', border: 'none', borderRadius: 6,
                        padding: '8px 14px', cursor: saving === cuenta.cuit ? 'not-allowed' : 'pointer',
                        alignSelf: 'flex-end',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
