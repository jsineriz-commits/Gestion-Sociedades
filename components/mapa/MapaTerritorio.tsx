'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';

// Leaflet no soporta SSR — importar dinámicamente
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import('react-leaflet').then(m => m.TileLayer),    { ssr: false });
const GeoJSON      = dynamic(() => import('react-leaflet').then(m => m.GeoJSON),      { ssr: false });
const Tooltip      = dynamic(() => import('react-leaflet').then(m => m.Tooltip),      { ssr: false });

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface DeptoStats {
  soc: number; qtotal: number; qvaca: number; qoperada: number;
  admTotal: number; admAct: number;
}
interface MapData {
  allByDepto:   Record<string, DeptoStats>;
  acByDepto:    Record<string, Record<string, number>>;
  acSocieties:  any[];
  acList:       string[];
  _generatedAt: string;
}
interface DeptoInfo {
  key: string; nombre: string; provincia: string;
  stats: DeptoStats; acCounts: Record<string, number>;
}

// ─── Helpers de color ────────────────────────────────────────────────────────
function getColor(soc: number, max: number): string {
  if (!soc || max === 0) return '#1e293b';
  const t = Math.sqrt(soc / max);
  if (t > 0.8) return '#15803d';
  if (t > 0.6) return '#16a34a';
  if (t > 0.4) return '#22c55e';
  if (t > 0.2) return '#4ade80';
  if (t > 0.05) return '#86efac';
  return '#bbf7d0';
}

function normalizeKey(name: string, prov: string): string {
  return (name + '|' + prov)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ─── Mapa Leaflet (solo en cliente) ──────────────────────────────────────────
function LeafletMap({
  geojson, mapData, acName,
  onDeptoClick,
}: {
  geojson: any; mapData: MapData; acName: string | null;
  onDeptoClick: (info: DeptoInfo) => void;
}) {
  const allByDepto = mapData.allByDepto;
  const acByDepto  = mapData.acByDepto;
  const maxSoc = Math.max(...Object.values(allByDepto).map(d => d.soc), 1);

  const styleFeature = useCallback((feature: any) => {
    const name = feature.properties?.nombre || feature.properties?.name || '';
    const prov = feature.properties?.provincia?.id || feature.properties?.provincia?.nombre || '';
    const key  = normalizeKey(name, prov);
    const stats = allByDepto[key];
    const hasAc = acName ? (acByDepto[key]?.[acName] ?? 0) > 0 : false;

    if (!stats || stats.soc === 0) {
      return { fillColor: '#0f172a', weight: 0.4, color: '#334155', fillOpacity: 0.6 };
    }
    if (acName && !hasAc) {
      return { fillColor: '#1e293b', weight: 0.4, color: '#334155', fillOpacity: 0.5 };
    }
    if (acName && hasAc) {
      return { fillColor: '#eab308', weight: 1, color: '#ca8a04', fillOpacity: 0.85 };
    }
    return {
      fillColor: getColor(stats.soc, maxSoc),
      weight: 0.4, color: '#334155', fillOpacity: 0.8,
    };
  }, [allByDepto, acByDepto, acName, maxSoc]);

  const onEachFeature = useCallback((feature: any, layer: any) => {
    const name = feature.properties?.nombre || '';
    const prov = feature.properties?.provincia?.nombre || '';
    const key  = normalizeKey(name, prov);
    const stats = allByDepto[key];

    layer.on({
      click: () => {
        onDeptoClick({
          key, nombre: name, provincia: prov,
          stats: stats || { soc: 0, qtotal: 0, qvaca: 0, qoperada: 0, admTotal: 0, admAct: 0 },
          acCounts: acByDepto[key] || {},
        });
      },
      mouseover: (e: any) => {
        e.target.setStyle({ weight: 2, color: '#94a3b8', fillOpacity: 0.95 });
      },
      mouseout: (e: any) => {
        e.target.setStyle(styleFeature(feature));
      },
    });
  }, [allByDepto, acByDepto, onDeptoClick, styleFeature]);

  return (
    <MapContainer
      center={[-38, -65]}
      zoom={4}
      style={{ height: '100%', width: '100%', background: '#0f172a' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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
    // Importar CSS de Leaflet en cliente
    import('leaflet/dist/leaflet.css' as any);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [mdRes, gjRes] = await Promise.all([
          fetch('/api/mapa'),
          fetch('/deptos.geojson').catch(() => null),
        ]);
        if (!mdRes.ok) throw new Error(`API mapa: ${mdRes.status}`);
        const md: MapData = await mdRes.json();
        setMapData(md);

        if (gjRes && gjRes.ok) {
          setGeojson(await gjRes.json());
        } else {
          // Fallback: datos.gob.ar
          const r = await fetch('https://apis.datos.gob.ar/georef/api/departamentos?formato=geojson&max=600');
          if (r.ok) setGeojson(await r.json());
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const fmt = (n: number | null | undefined) =>
    n == null ? '—' : n.toLocaleString('es-AR');

  if (!isClient) return null;

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white">Mapa de Territorio</h1>
          <p className="text-xs text-slate-400 mt-0.5">Distribución de sociedades por departamento · Base Clave</p>
        </div>

        {/* Selector de AC */}
        <div className="flex items-center gap-3">
          {mapData && (
            <select
              value={acName ?? ''}
              onChange={e => { setAcName(e.target.value || null); setSelected(null); }}
              className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos los ACs</option>
              {mapData.acList.map(ac => (
                <option key={ac} value={ac}>{ac}</option>
              ))}
            </select>
          )}
          {acName && (
            <button
              onClick={() => { setAcName(null); setSelected(null); }}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-700"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Mapa */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-400 text-sm">Cargando datos del territorio...</p>
              <p className="text-slate-600 text-xs mt-1">Procesando Base Clave (~30s primera vez)</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950">
              <div className="text-center">
                <p className="text-red-400 font-medium mb-2">Error al cargar el mapa</p>
                <p className="text-slate-500 text-sm">{error}</p>
              </div>
            </div>
          )}
          {!loading && !error && mapData && (
            <LeafletMap
              geojson={geojson}
              mapData={mapData}
              acName={acName}
              onDeptoClick={setSelected}
            />
          )}

          {/* Leyenda */}
          {!loading && !error && (
            <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-3 text-xs space-y-1.5">
              <p className="font-semibold text-slate-300 mb-2">Sociedades / Depto</p>
              {[
                { color: '#15803d', label: 'Muy alta' },
                { color: '#22c55e', label: 'Alta' },
                { color: '#4ade80', label: 'Media' },
                { color: '#86efac', label: 'Baja' },
                { color: '#bbf7d0', label: 'Muy baja' },
                { color: '#eab308', label: acName ? `${acName} (amarillo)` : '' },
              ].filter(l => l.label || !acName).map(l => l.label && (
                <div key={l.label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                  <span className="text-slate-400">{l.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel lateral de detalle */}
        {selected && (
          <div className="w-80 bg-slate-900 border-l border-slate-800 overflow-y-auto p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-white text-base leading-tight">{selected.nombre}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{selected.provincia}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-500 hover:text-white text-lg leading-none ml-2"
              >×</button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Sociedades', value: fmt(selected.stats.soc), color: '#22c55e' },
                { label: 'Kt Total', value: fmt(Math.round(selected.stats.qtotal / 1000)) + 'K', color: '#f59e0b' },
                { label: 'Kv Total', value: fmt(Math.round(selected.stats.qvaca / 1000)) + 'K', color: '#3b82f6' },
                { label: 'Kop dCaC', value: fmt(Math.round(selected.stats.qoperada / 1000)) + 'K', color: '#8b5cf6' },
                { label: 'En dCaC', value: fmt(selected.stats.admTotal), color: '#10b981' },
                { label: 'dCaC Activos', value: fmt(selected.stats.admAct), color: '#06b6d4' },
              ].map(k => (
                <div key={k.label} className="bg-slate-800 rounded-lg p-3">
                  <div className="text-lg font-bold" style={{ color: k.color }}>{k.value}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{k.label}</div>
                </div>
              ))}
            </div>

            {/* ACs en este depto */}
            {Object.keys(selected.acCounts).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">ACs con sociedades</p>
                <div className="space-y-1.5">
                  {Object.entries(selected.acCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([ac, count]) => (
                      <div key={ac} className="flex items-center justify-between text-sm">
                        <span
                          className="text-slate-300 cursor-pointer hover:text-white"
                          onClick={() => setAcName(ac)}
                        >{ac}</span>
                        <span className="text-slate-500 text-xs">{count} soc.</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
