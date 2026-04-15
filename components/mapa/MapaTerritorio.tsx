'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Leaflet no soporta SSR
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import('react-leaflet').then(m => m.TileLayer),    { ssr: false });
const GeoJSON      = dynamic(() => import('react-leaflet').then(m => m.GeoJSON),      { ssr: false });

// ─── Design tokens (disenio/tokens.json — DeCampoacampo light) ───────────────
const T = {
  surfacePage:    '#ededed',
  surfaceL1:      '#f8f8f8',
  surfaceL2:      '#ffffff',
  brand:          '#3179a7',
  brandHover:     '#2d6e98',
  brandSubtle:    '#eaf2f6',
  brandBorder:    '#bfd5e4',
  contentPrimary: '#555555',
  contentSecondary:'#666666',
  contentTertiary: '#888888',
  borderSecondary: '#c0c0c0',
  borderTertiary:  '#ededed',
  positive:        '#54a22b',
  positiveSubtle:  '#eef6ea',
  negative:        '#e76162',
  negativeSubtle:  '#fdefef',
  notice:          '#e45a00',
  noticeSubtle:    '#fcefe6',
  yellow:          '#b29b0e',
  yellowSubtle:    '#f7f5e7',
  disabled:        '#c0c0c0',
} as const;

// ─── Escala de verde para el mapa (palette positiva de la marca) ──────────────
function getColor(soc: number, max: number): string {
  if (!soc || max === 0) return T.surfacePage;
  const t = Math.sqrt(soc / max);
  if (t > 0.8) return '#234412';
  if (t > 0.6) return '#3c731f';
  if (t > 0.4) return '#54a22b';
  if (t > 0.2) return '#8cc171';
  return '#cae2bd';
}

function normalizeDeptoKey(name: string, prov: string): string {
  return (name + '|' + prov)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

interface DeptoStats {
  soc: number; qtotal: number; qvaca: number; qoperada: number;
  admTotal: number; admAct: number;
}
interface MapData {
  allByDepto:  Record<string, DeptoStats>;
  acByDepto:   Record<string, Record<string, number>>;
  acSocieties: any[];
  acList:      string[];
}
interface DeptoInfo {
  key: string; nombre: string; provincia: string;
  stats: DeptoStats; acCounts: Record<string, number>;
}

// ─── Mapa Leaflet (client-only) ───────────────────────────────────────────────
function LeafletMap({
  geojson, mapData, acName, onDeptoClick,
}: {
  geojson: any; mapData: MapData; acName: string | null;
  onDeptoClick: (info: DeptoInfo) => void;
}) {
  const { allByDepto, acByDepto } = mapData;
  const maxSoc = Math.max(...Object.values(allByDepto).map(d => d.soc), 1);

  const styleFeature = useCallback((feature: any) => {
    const name  = feature.properties?.nombre || '';
    const prov  = feature.properties?.provincia?.id || feature.properties?.provincia?.nombre || '';
    const key   = normalizeDeptoKey(name, prov);
    const stats = allByDepto[key];
    const inAc  = acName ? (acByDepto[key]?.[acName] ?? 0) > 0 : false;

    if (!stats?.soc) {
      return { fillColor: T.borderTertiary, weight: 0.5, color: T.borderSecondary, fillOpacity: 0.8 };
    }
    if (acName && !inAc) {
      return { fillColor: T.surfaceL1, weight: 0.5, color: T.borderSecondary, fillOpacity: 0.7 };
    }
    if (acName && inAc) {
      // Color de marca para el AC seleccionado
      return { fillColor: T.brand, weight: 1.5, color: T.brandHover, fillOpacity: 0.85 };
    }
    return {
      fillColor: getColor(stats.soc, maxSoc),
      weight: 0.5, color: T.borderSecondary, fillOpacity: 0.85,
    };
  }, [allByDepto, acByDepto, acName, maxSoc]);

  const onEachFeature = useCallback((feature: any, layer: any) => {
    const name  = feature.properties?.nombre || '';
    const prov  = feature.properties?.provincia?.nombre || '';
    const key   = normalizeDeptoKey(name, prov);
    const stats = allByDepto[key];
    layer.on({
      click: () => onDeptoClick({
        key, nombre: name, provincia: prov,
        stats: stats || { soc: 0, qtotal: 0, qvaca: 0, qoperada: 0, admTotal: 0, admAct: 0 },
        acCounts: acByDepto[key] || {},
      }),
      mouseover: (e: any) => e.target.setStyle({ weight: 2, color: T.brand, fillOpacity: 1 }),
      mouseout:  (e: any) => e.target.setStyle(styleFeature(feature)),
    });
  }, [allByDepto, acByDepto, onDeptoClick, styleFeature]);

  return (
    <MapContainer
      center={[-38, -65]} zoom={4}
      style={{ height: '100%', width: '100%', background: T.surfacePage }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {geojson && (
        <GeoJSON
          key={acName || 'all'}
          data={geojson}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      )}
    </MapContainer>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function MapaTerritorio() {
  const [mapData,  setMapData]  = useState<MapData | null>(null);
  const [geojson,  setGeojson]  = useState<any>(null);
  const [acName,   setAcName]   = useState<string | null>(null);
  const [selected, setSelected] = useState<DeptoInfo | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    import('leaflet/dist/leaflet.css' as any);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const [mdRes, gjRes] = await Promise.all([
          fetch('/api/mapa'),
          fetch('/deptos.geojson').catch(() => null),
        ]);
        if (!mdRes.ok) throw new Error(`Error al cargar datos del mapa (${mdRes.status})`);
        setMapData(await mdRes.json());
        if (gjRes?.ok) {
          setGeojson(await gjRes.json());
        } else {
          const r = await fetch('https://apis.datos.gob.ar/georef/api/departamentos?formato=geojson&max=600');
          if (r.ok) setGeojson(await r.json());
        }
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const fmt = (n: number | null | undefined, suffix = '') =>
    n == null ? '—' : n.toLocaleString('es-AR') + suffix;

  if (!isClient) return null;

  return (
    <div className="flex flex-col h-full min-h-screen" style={{ background: T.surfacePage, color: T.contentPrimary }}>
      {/* Header */}
      <header style={{ background: T.surfaceL2, borderBottom: `1px solid ${T.borderTertiary}` }}
        className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: T.contentPrimary }}>Mapa de Territorio</h1>
          <p className="text-sm mt-0.5" style={{ color: T.contentTertiary }}>Distribución de sociedades por departamento · Base Clave</p>
        </div>

        <div className="flex items-center gap-2">
          {mapData && (
            <select
              value={acName ?? ''}
              onChange={e => { setAcName(e.target.value || null); setSelected(null); }}
              style={{
                background: T.surfaceL1, border: `1px solid ${T.borderSecondary}`,
                color: T.contentPrimary, borderRadius: 6, padding: '6px 12px', fontSize: 14,
              }}
            >
              <option value="">Todos los ACs</option>
              {mapData.acList.map(ac => <option key={ac} value={ac}>{ac}</option>)}
            </select>
          )}
          {acName && (
            <button
              onClick={() => { setAcName(null); setSelected(null); }}
              style={{
                background: 'none', border: `1px solid ${T.borderSecondary}`,
                color: T.contentSecondary, borderRadius: 6, padding: '5px 10px', fontSize: 13, cursor: 'pointer',
              }}
            >
              Limpiar
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Área del mapa */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center"
              style={{ background: T.surfaceL1 }}>
              <span className="material-symbols-outlined text-4xl mb-3 animate-spin"
                style={{ color: T.brand }}>progress_activity</span>
              <p style={{ color: T.contentSecondary, fontSize: 14 }}>Cargando datos del territorio…</p>
              <p style={{ color: T.contentTertiary, fontSize: 12, marginTop: 4 }}>Primera carga puede tardar ~30s</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center"
              style={{ background: T.surfaceL1 }}>
              <div className="text-center p-6 rounded-xl" style={{ background: T.negativeSubtle, border: `1px solid ${T.negative}20` }}>
                <span className="material-symbols-outlined text-3xl mb-2" style={{ color: T.negative }}>error</span>
                <p style={{ color: T.negative, fontWeight: 600 }}>Error al cargar el mapa</p>
                <p style={{ color: T.contentSecondary, fontSize: 13, marginTop: 4 }}>{error}</p>
              </div>
            </div>
          )}
          {!loading && !error && mapData && (
            <LeafletMap geojson={geojson} mapData={mapData} acName={acName} onDeptoClick={setSelected} />
          )}

          {/* Leyenda */}
          {!loading && !error && (
            <div className="absolute bottom-4 left-4 z-[1000] rounded-lg p-3 text-xs space-y-1.5"
              style={{ background: T.surfaceL2, border: `1px solid ${T.borderTertiary}`, boxShadow: '0 1px 4px #0002' }}>
              <p className="font-semibold mb-2" style={{ color: T.contentSecondary }}>Sociedades / Depto</p>
              {[
                { color: '#234412', label: 'Muy alta' },
                { color: '#3c731f', label: 'Alta' },
                { color: '#54a22b', label: 'Media' },
                { color: '#8cc171', label: 'Baja' },
                { color: '#cae2bd', label: 'Muy baja' },
                ...(acName ? [{ color: T.brand, label: acName }] : []),
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                  <span style={{ color: T.contentTertiary }}>{l.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel de detalle */}
        {selected && (
          <aside className="w-72 overflow-y-auto p-5 space-y-4"
            style={{ background: T.surfaceL2, borderLeft: `1px solid ${T.borderTertiary}` }}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-base" style={{ color: T.contentPrimary }}>{selected.nombre}</h2>
                <p className="text-sm" style={{ color: T.contentTertiary }}>{selected.provincia}</p>
              </div>
              <button onClick={() => setSelected(null)} style={{ color: T.contentTertiary, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Sociedades',  value: fmt(selected.stats.soc),                            semantic: 'info'     },
                { label: 'Kt Total',    value: fmt(Math.round((selected.stats.qtotal||0)/1000))+'K',semantic: 'notice'   },
                { label: 'Kv Total',    value: fmt(Math.round((selected.stats.qvaca||0)/1000))+'K', semantic: 'positive' },
                { label: 'Kop dCaC',   value: fmt(Math.round((selected.stats.qoperada||0)/1000))+'K',semantic: 'info'   },
                { label: 'En dCaC',    value: fmt(selected.stats.admTotal),                         semantic: 'info'    },
                { label: 'Activos',    value: fmt(selected.stats.admAct),                           semantic: 'positive'},
              ].map(k => {
                const colors: Record<string, [string,string]> = {
                  info:     [T.brand,    T.brandSubtle],
                  positive: [T.positive, T.positiveSubtle],
                  notice:   [T.notice,   T.noticeSubtle],
                };
                const [fg, bg] = colors[k.semantic] || [T.brand, T.brandSubtle];
                return (
                  <div key={k.label} className="rounded-lg p-3"
                    style={{ background: bg, border: `1px solid ${fg}20` }}>
                    <div className="text-base font-bold" style={{ color: fg }}>{k.value}</div>
                    <div className="text-xs mt-0.5" style={{ color: T.contentTertiary }}>{k.label}</div>
                  </div>
                );
              })}
            </div>

            {/* ACs del depto */}
            {Object.keys(selected.acCounts).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: T.contentTertiary }}>ACs con sociedades</p>
                <div className="space-y-1.5">
                  {Object.entries(selected.acCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([ac, count]) => (
                      <div key={ac} className="flex items-center justify-between text-sm">
                        <button
                          onClick={() => setAcName(ac)}
                          style={{ color: T.brand, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                        >{ac}</button>
                        <span style={{ color: T.contentTertiary, fontSize: 12 }}>{count} soc.</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
