'use client';
import { useState, useEffect, useCallback } from 'react';

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Comentario { cuit: string; fecha: string; comentario: string; }
interface CuentaData { cuit: string; nombre: string; comments: Comentario[]; }
interface CuentaInfo {
  found: boolean; cuit: string; razonSocial?: string; estPrincipal?: string;
  kt?: number | null; kv?: number | null; cabezasOperadas?: number | null;
  sugeridoFae?: number | null; sugeridoInv?: number | null; qOpTotal?: number | null;
  FUC?: string; FUV?: string; ultOp?: string; ultAct?: string; ultimoIngreso?: string; ultNoConc?: string;
  qComprasFae?: number | null; qVentasFae?: number | null;
  qComprasInv?: number | null; qVentasInv?: number | null; concGral?: number | null;
  ac?: string; representante?: string; enDcac?: boolean;
  contacto?: { nombre: string; telefono: string; mail: string; } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(v: number | null | undefined, suffix = '') {
  if (v == null) return '—';
  return v.toLocaleString('es-AR') + suffix;
}
function pill(text: string, color: string) {
  return (
    <span key={text} style={{ background: color + '22', color, padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, display: 'inline-block' }}>
      {text}
    </span>
  );
}

// ─── Panel de info Metabase ───────────────────────────────────────────────────
function InfoPanel({ cuit }: { cuit: string }) {
  const [info, setInfo] = useState<CuentaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cuentas/info?cuit=${encodeURIComponent(cuit)}`)
      .then(r => r.json()).then(setInfo).catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [cuit]);

  if (loading) return <p className="text-xs text-slate-500 py-2">Cargando datos de la cuenta...</p>;
  if (!info?.found) return <p className="text-xs text-slate-500 py-2 border-b border-slate-800 mb-3">Sin datos en Base Clave para este CUIT</p>;

  return (
    <div className="border-b border-slate-700 pb-4 mb-3 space-y-3">
      {/* Badges */}
      <div className="flex flex-wrap gap-2 items-center">
        {pill(info.enDcac ? 'EN dCaC' : 'SIN dCaC', info.enDcac ? '#22c55e' : '#6b7280')}
        {info.ac && pill(info.ac, '#3b82f6')}
        {info.estPrincipal && (
          <span className="text-xs text-slate-400">📍 {info.estPrincipal}</span>
        )}
      </div>
      {info.razonSocial && <p className="text-xs text-slate-400">🏢 {info.razonSocial}</p>}
      {info.contacto?.nombre && (
        <p className="text-xs text-slate-400">
          👤 {info.contacto.nombre}
          {info.contacto.telefono && ` · 📞 ${info.contacto.telefono}`}
          {info.contacto.mail && ` · ✉ ${info.contacto.mail}`}
        </p>
      )}

      {/* KPIs grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Kt Total',      val: fmt(info.kt),             color: '#f59e0b' },
          { label: 'Kv Total',      val: fmt(info.kv),             color: '#22c55e' },
          { label: 'Kop dCaC',      val: fmt(info.cabezasOperadas),color: '#3b82f6' },
          { label: 'Sug. Faena',    val: fmt(info.sugeridoFae),    color: '#f97316' },
          { label: 'Sug. Inv.',     val: fmt(info.sugeridoInv),    color: '#8b5cf6' },
          { label: 'Op. Totales',   val: fmt(info.qOpTotal),       color: '#ec4899' },
        ].map(k => (
          <div key={k.label} className="bg-slate-800 rounded-lg p-2">
            <div className="text-sm font-bold" style={{ color: k.color }}>{k.val}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
        {[['FUC', info.FUC], ['FUV', info.FUV], ['Últ. Op.', info.ultOp], ['Últ. Act.', info.ultAct], ['Ingreso', info.ultimoIngreso], ['No Conc.', info.ultNoConc]].map(([l, v]) => v ? (
          <div key={l as string}>{l}: <span className="text-slate-300">{v}</span></div>
        ) : null)}
      </div>

      {/* Ops detalle */}
      {(info.qComprasFae || info.qVentasFae) && (
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          {info.qComprasFae  != null && <span>C.Fae: <b className="text-slate-300">{fmt(info.qComprasFae)}</b></span>}
          {info.qVentasFae   != null && <span>V.Fae: <b className="text-slate-300">{fmt(info.qVentasFae)}</b></span>}
          {info.qComprasInv  != null && <span>C.Inv: <b className="text-slate-300">{fmt(info.qComprasInv)}</b></span>}
          {info.qVentasInv   != null && <span>V.Inv: <b className="text-slate-300">{fmt(info.qVentasInv)}</b></span>}
          {info.concGral     != null && <span>Conc: <b className="text-green-400">{fmt(info.concGral)}%</b></span>}
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
  const [newCuit,       setNewCuit]       = useState('');
  const [newComment,    setNewComment]    = useState('');
  const [showNewForm,   setShowNewForm]   = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [savingNew,     setSavingNew]     = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string,string>>({});

  // Build cuentasData from comments
  const buildCuentas = useCallback((comments: Comentario[]) => {
    const map: Record<string, CuentaData> = {};
    for (const c of comments) {
      if (!c.cuit) continue;
      if (!map[c.cuit]) map[c.cuit] = { cuit: c.cuit, nombre: '', comments: [] };
      map[c.cuit].comments.push(c);
    }
    for (const k in map) map[k].comments.reverse();
    return Object.values(map).sort((a, b) => b.comments.length - a.comments.length);
  }, []);

  // Load comments
  useEffect(() => {
    setLoading(true);
    fetch('/api/cuentas/comments')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((data: Comentario[]) => {
        setAllComments(data);
        const cd = buildCuentas(data);
        setCuentasData(cd);
        setFiltered(cd);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [buildCuentas]);

  // Filter
  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    setFiltered(!q ? cuentasData : cuentasData.filter(c =>
      c.cuit.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q)
    ));
  }, [searchQuery, cuentasData]);

  const toggleExpand = (cuit: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(cuit)) next.delete(cuit); else next.add(cuit);
      return next;
    });
  };

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
      const newC: Comentario = { cuit, fecha: data.fecha, comentario: texto };
      const updated = [newC, ...allComments];
      setAllComments(updated);
      const cd = buildCuentas(updated);
      setCuentasData(cd);
      setCommentInputs(p => ({ ...p, [cuit]: '' }));
    } catch (e: any) { alert(e.message); }
    finally { setSaving(null); }
  };

  const saveNewCuenta = async () => {
    const cuit = newCuit.trim(); const comentario = newComment.trim();
    if (!cuit || !comentario) return;
    setSavingNew(true);
    try {
      const res = await fetch('/api/cuentas/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuit, comentario }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newC: Comentario = { cuit, fecha: data.fecha, comentario };
      const updated = [newC, ...allComments];
      setAllComments(updated);
      const cd = buildCuentas(updated);
      setCuentasData(cd); setFiltered(cd);
      setNewCuit(''); setNewComment(''); setShowNewForm(false);
      setExpanded(p => new Set([...p, cuit]));
    } catch (e: any) { alert(e.message); }
    finally { setSavingNew(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Gestión de Cuentas</h1>
            <p className="text-xs text-slate-400 mt-0.5">Historial de comentarios por CUIT</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Buscar CUIT o razón social..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg pl-3 pr-8 py-2 w-72 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-2 text-slate-500 hover:text-white">✕</button>
              )}
            </div>
            <button
              onClick={() => setShowNewForm(p => !p)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + Nueva Cuenta
            </button>
          </div>
        </div>

        {/* Formulario nueva cuenta */}
        {showNewForm && (
          <div className="mt-4 bg-slate-800 border border-emerald-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-emerald-400">Agregar Comentario a una Cuenta</h3>
              <button onClick={() => setShowNewForm(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <input
              type="text" placeholder="CUIT (ej: 20-12345678-9)" value={newCuit}
              onChange={e => setNewCuit(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <textarea
              placeholder="Escribí el comentario sobre esta cuenta..."
              value={newComment} onChange={e => setNewComment(e.target.value)}
              rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex justify-end">
              <button
                onClick={saveNewCuenta} disabled={savingNew}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {savingNew ? 'Guardando...' : '📤 Guardar Comentario'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && <p className="text-red-400 text-center py-10">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <p className="text-4xl mb-3">🔍</p>
            <p>{searchQuery ? 'Sin resultados para esta búsqueda' : 'Todavía no hay cuentas cargadas'}</p>
          </div>
        )}

        {filtered.map(cuenta => {
          const isOpen = expanded.has(cuenta.cuit);
          return (
            <div key={cuenta.cuit} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {/* Header de la card */}
              <button
                onClick={() => toggleExpand(cuenta.cuit)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition-colors text-left"
              >
                <div>
                  <div className="font-semibold text-white text-sm">{cuenta.nombre || `CUIT ${cuenta.cuit}`}</div>
                  {cuenta.nombre && <div className="text-xs text-slate-500 font-mono mt-0.5">{cuenta.cuit}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                    {cuenta.comments.length} comentario{cuenta.comments.length !== 1 ? 's' : ''}
                  </span>
                  <span className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </button>

              {/* Cuerpo expandible */}
              {isOpen && (
                <div className="border-t border-slate-800 px-5 py-4 space-y-4">
                  {/* Info Metabase */}
                  <InfoPanel cuit={cuenta.cuit} />

                  {/* Timeline de comentarios */}
                  <div className="space-y-3">
                    {cuenta.comments.map((c, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center pt-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          {i < cuenta.comments.length - 1 && <div className="w-0.5 bg-slate-700 flex-1 mt-1" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <p className="text-sm text-slate-200 leading-relaxed">{c.comentario}</p>
                          <p className="text-xs text-slate-500 mt-1">{c.fecha}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Form agregar comentario */}
                  <div className="flex gap-2 pt-2">
                    <textarea
                      placeholder="Agregar comentario..."
                      value={commentInputs[cuenta.cuit] || ''}
                      onChange={e => setCommentInputs(p => ({ ...p, [cuenta.cuit]: e.target.value }))}
                      rows={2}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-100"
                    />
                    <button
                      onClick={() => saveComment(cuenta.cuit)}
                      disabled={saving === cuenta.cuit}
                      className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm px-3 py-2 rounded-lg transition-colors self-end"
                    >
                      {saving === cuenta.cuit ? '...' : '📤'}
                    </button>
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
