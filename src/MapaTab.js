'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

// Design tokens DeCampoacampo
const T = {
  brand: '#3179a7',
  brandHover: '#2d6e98',
  brandSubtle: '#eaf2f6',
  brandBorder: '#bfd5e4',
  surfacePage: '#ededed',
  surfaceL1: '#f8f8f8',
  surfaceL2: '#ffffff',
  contentPrimary: '#555555',
  contentSecondary: '#666666',
  contentTertiary: '#888888',
  borderSecondary: '#c0c0c0',
  borderTertiary: '#ededed',
  positive: '#54a22b',
  positiveSubtle: '#eef6ea',
  notice: '#e45a00',
  noticeSubtle: '#fcefe6',
  selected: '#1d6fa4',
  selectedBg: '#d0e8f5',
};

// Normaliza solo el nombre del departamento (sin provincia)
// Maneja abreviaturas comunes del sistema argentino (SENASA/IGN)
function normDepto(name) {
  return String(name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/\./g, ' ')             // puntos → espacio
    .replace(/\bGRAL\b/g, 'GENERAL')
    .replace(/\bCNEL\b/g, 'CORONEL')
    .replace(/\bSTA\b/g, 'SANTA')
    .replace(/\bSTO\b/g, 'SANTO')
    .replace(/\bSAN\b/g, 'SAN')     // igual, pero limpia dobles
    .replace(/\s+/g, ' ')           // colapsar espacios múltiples
    .trim();
}

function getColor(soc, max, isSelected, acName, hasAc) {
  if (isSelected) return '#1d6fa4';
  if (acName && !hasAc) return '#dde8ee';
  if (acName && hasAc) return T.brand;
  if (!soc || max === 0) return '#e2e8f0';
  const t = Math.sqrt(soc / max);
  if (t > 0.8) return '#234412';
  if (t > 0.6) return '#3c731f';
  if (t > 0.4) return '#54a22b';
  if (t > 0.2) return '#8cc171';
  return '#cae2bd';
}

function buildDeptoData(data188, data189) {
  const acByCuit = {};
  (data189 || []).forEach(r => {
    const cuit = String(r['st.cuit'] || r.cuit || '').trim();
    if (cuit) acByCuit[cuit] = String(r.asociado_comercial || '').trim();
  });

  const allByDepto = {};  // key (normDepto) → { soc, kt, kv, name, prov }
  const acByDepto = {};
  const acSet = new Set();

  (data188 || []).forEach(r => {
    const cuit = String(r.cuit || '').trim();
    const rawName = String(r.partido_establecimiento_senasa || r.partido_fiscal_senasa || '').trim();
    const rawProv = String(r.prov_establecimiento_senasa || r.prov_fiscal_senasa || '').trim();
    if (!rawName) return;

    const key = normDepto(rawName);
    const ac = acByCuit[cuit] || 'SIN ASIGNAR';
    const kt = parseFloat(r.total_bovinos) || 0;
    const kv = parseFloat(r.total_vacas) || 0;

    if (!allByDepto[key]) allByDepto[key] = { soc: 0, kt: 0, kv: 0, name: rawName, prov: rawProv };
    allByDepto[key].soc++;
    allByDepto[key].kt += kt;
    allByDepto[key].kv += kv;

    if (!acByDepto[key]) acByDepto[key] = {};
    acByDepto[key][ac] = (acByDepto[key][ac] || 0) + 1;
    if (ac !== 'SIN ASIGNAR') acSet.add(ac);
  });

  return { allByDepto, acByDepto, acList: Array.from(acSet).sort() };
}

// Leaflet map component
function LeafletMapInner({ geojson, allByDepto, acByDepto, acName, selectedKeys, onLayerClick }) {
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const leafletRef = useRef(null);
  const containerRef = useRef(null);

  const maxSoc = Math.max(...Object.values(allByDepto).map(d => d.soc), 1);

  const getStyle = useCallback((feature) => {
    const name = feature.properties?.nombre || '';
    const key = normDepto(name);
    const d = allByDepto[key];
    const isSelected = selectedKeys.has(key);
    const hasAc = acName ? (acByDepto[key]?.[acName] ?? 0) > 0 : false;

    if (isSelected) {
      return { fillColor: T.selected, weight: 2.5, color: '#0a3d5e', fillOpacity: 0.85 };
    }
    if (!d?.soc) return { fillColor: '#e2e8f0', weight: 0.5, color: '#94a3b8', fillOpacity: 0.6 };
    const fill = getColor(d.soc, maxSoc, false, acName, hasAc);
    return { fillColor: fill, weight: 0.5, color: '#94a3b8', fillOpacity: 0.85 };
  }, [allByDepto, acByDepto, acName, selectedKeys, maxSoc]);

  useEffect(() => {
    async function init() {
      if (!containerRef.current || mapRef.current) return;
      try {
        const L = (await import('leaflet')).default;
        leafletRef.current = L;
        await import('leaflet/dist/leaflet.css');
        const map = L.map(containerRef.current, { center: [-38, -65], zoom: 4, zoomControl: true });
        mapRef.current = map;
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OSM &copy; CARTO' }).addTo(map);
      } catch (e) { console.error('Leaflet init error', e); }
    }
    init();
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !geojson) return;
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }

    const layer = L.geoJSON(geojson, {
      style: getStyle,
      onEachFeature: (feature, lyr) => {
        const geoName = feature.properties?.nombre || '';
        const geoProv = feature.properties?.provincia?.nombre || feature.properties?.provincia?.id || '';
        const key = normDepto(geoName);
        const d = allByDepto[key];
        lyr.on({
          click: () => onLayerClick({ key, name: d?.name || geoName, prov: d?.prov || geoProv, d: d || { soc: 0, kt: 0, kv: 0 }, acCounts: acByDepto[key] || {} }),
          mouseover: (e) => { if (!selectedKeys.has(key)) e.target.setStyle({ weight: 2, color: T.brand, fillOpacity: 1 }); },
          mouseout:  (e) => { e.target.setStyle(getStyle(feature)); },
        });
      },
    }).addTo(map);
    layerRef.current = layer;
  }, [geojson, getStyle, allByDepto, acByDepto, onLayerClick, selectedKeys]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}

export default function MapaTab({ data188, data189, selectedDeptos = [], onDeptoFilter }) {
  const [geojson, setGeojson] = useState(null);
  const [loadingGeo, setLoadingGeo] = useState(true);
  const [acName, setAcName] = useState('');
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    fetch('/deptos.geojson')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setGeojson(d); setLoadingGeo(false); return; } return fetch('https://apis.datos.gob.ar/georef/api/departamentos?formato=geojson&max=600'); })
      .then(r => r && r.ok ? r.json() : null)
      .then(d => { if (d) setGeojson(d); })
      .catch(() => {})
      .finally(() => setLoadingGeo(false));
  }, []);

  const noData = !data188 || data188.length === 0;
  const { allByDepto, acByDepto, acList } = noData
    ? { allByDepto: {}, acByDepto: {}, acList: [] }
    : buildDeptoData(data188, data189);

  // Convertir selectedDeptos a Set de keys
  const selectedKeys = new Set((selectedDeptos || []).map(d => d.key));

  const handleLayerClick = useCallback(({ key, name, prov, d, acCounts }) => {
    if (!onDeptoFilter) return;
    const isSelected = selectedKeys.has(key);
    if (isSelected) {
      onDeptoFilter((selectedDeptos || []).filter(x => x.key !== key));
    } else {
      onDeptoFilter([...(selectedDeptos || []), { key, name, prov, d, acCounts }]);
    }
    setHoveredInfo({ key, name, prov, d, acCounts });
  }, [selectedKeys, selectedDeptos, onDeptoFilter]);

  const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(Math.round(n));

  if (!isClient) return null;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', background: T.surfacePage }}>
      {/* Mapa */}
      <div style={{ flex: 1, position: 'relative' }}>
        {noData && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: T.surfaceL1, zIndex: 5 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
            <p style={{ color: T.contentSecondary, fontWeight: 600, fontSize: 16 }}>Primero cargá los datos</p>
            <p style={{ color: T.contentTertiary, fontSize: 13 }}>Usá el botón "Buscar en Metabase" del panel lateral y volvé a esta solapa.</p>
          </div>
        )}
        {!noData && loadingGeo && (
          <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: T.surfaceL2, border: `1px solid ${T.brandBorder}`, borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, border: `2px solid ${T.brand}`, borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 13, color: T.contentSecondary }}>Cargando GeoJSON…</span>
          </div>
        )}

        {/* Banner filtro activo */}
        {selectedDeptos && selectedDeptos.length > 0 && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: T.selected, color: '#fff', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px #0003' }}>
            <span>📍 {selectedDeptos.length} departamento{selectedDeptos.length !== 1 ? 's' : ''} seleccionado{selectedDeptos.length !== 1 ? 's' : ''} — filtrando tablas</span>
            <button onClick={() => onDeptoFilter && onDeptoFilter([])} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 12, color: '#fff', padding: '2px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>× Limpiar</button>
          </div>
        )}

        {!noData && (
          <LeafletMapInner
            geojson={geojson}
            allByDepto={allByDepto}
            acByDepto={acByDepto}
            acName={acName}
            selectedKeys={selectedKeys}
            onLayerClick={handleLayerClick}
          />
        )}

        {/* Instrucción */}
        {!noData && selectedDeptos && selectedDeptos.length === 0 && (
          <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'rgba(255,255,255,0.9)', border: `1px solid ${T.borderTertiary}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, color: T.contentTertiary, whiteSpace: 'nowrap' }}>
            Click en un departamento para usarlo como filtro
          </div>
        )}

        {/* Leyenda */}
        <div style={{ position: 'absolute', bottom: 24, left: 12, zIndex: 1000, background: T.surfaceL2, border: `1px solid ${T.borderTertiary}`, borderRadius: 8, padding: '10px 14px', boxShadow: '0 1px 4px #0002', minWidth: 130 }}>
          <p style={{ fontWeight: 600, color: T.contentSecondary, fontSize: 12, marginBottom: 8 }}>Soc. / Depto</p>
          {[['#234412','Muy alta'],['#3c731f','Alta'],['#54a22b','Media'],['#8cc171','Baja'],['#cae2bd','Muy baja']].map(([c,l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
              <span style={{ fontSize: 11, color: T.contentTertiary }}>{l}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingTop: 6, borderTop: `1px solid ${T.borderTertiary}` }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: T.selected }} />
            <span style={{ fontSize: 11, color: T.selected, fontWeight: 600 }}>Seleccionado</span>
          </div>
        </div>
      </div>

      {/* Panel derecho */}
      <div style={{ width: 280, background: T.surfaceL2, borderLeft: `1px solid ${T.borderTertiary}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Selector AC */}
        <div style={{ padding: 16, borderBottom: `1px solid ${T.borderTertiary}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: T.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Filtrar por AC</p>
          <select value={acName} onChange={e => setAcName(e.target.value)}
            style={{ width: '100%', padding: '6px 10px', border: `1px solid ${T.borderSecondary}`, borderRadius: 6, fontSize: 13, color: T.contentPrimary, background: T.surfaceL1, cursor: 'pointer' }}>
            <option value="">Todos los ACs</option>
            {acList.map(ac => <option key={ac} value={ac}>{ac}</option>)}
          </select>
          {acName && (
            <button onClick={() => setAcName('')} style={{ marginTop: 8, fontSize: 11, color: T.contentTertiary, background: 'none', border: `1px solid ${T.borderSecondary}`, borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>Limpiar</button>
          )}
        </div>

        {/* Departamentos seleccionados como filtro */}
        <div style={{ padding: 16, borderBottom: `1px solid ${T.borderTertiary}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: T.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              Filtro por Deptos ({(selectedDeptos || []).length})
            </p>
            {selectedDeptos && selectedDeptos.length > 0 && (
              <button onClick={() => onDeptoFilter && onDeptoFilter([])} style={{ fontSize: 11, color: T.notice, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Limpiar todo</button>
            )}
          </div>

          {(!selectedDeptos || selectedDeptos.length === 0) ? (
            <p style={{ fontSize: 12, color: T.contentTertiary, fontStyle: 'italic' }}>Hacé click en el mapa para agregar departamentos al filtro</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selectedDeptos.map(dep => (
                <div key={dep.key} style={{ display: 'flex', alignItems: 'center', gap: 4, background: T.selectedBg, border: `1px solid ${T.brandBorder}`, borderRadius: 99, padding: '3px 10px' }}>
                  <span style={{ fontSize: 12, color: T.selected, fontWeight: 600 }}>{dep.name}</span>
                  <button onClick={() => onDeptoFilter && onDeptoFilter((selectedDeptos || []).filter(x => x.key !== dep.key))}
                    style={{ background: 'none', border: 'none', color: T.brandHover, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KPIs del filtro actual */}
        {!noData && (
          <div style={{ padding: 16, borderBottom: `1px solid ${T.borderTertiary}` }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: T.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              {selectedDeptos && selectedDeptos.length > 0 ? 'Totales (deptos seleccionados)' : 'Totales cargados'}
            </p>
            {(() => {
              const depData = selectedDeptos && selectedDeptos.length > 0
                ? selectedDeptos.reduce((acc, d) => ({ soc: acc.soc + (d.d?.soc || 0), kt: acc.kt + (d.d?.kt || 0), kv: acc.kv + (d.d?.kv || 0) }), { soc: 0, kt: 0, kv: 0 })
                : { soc: data188.length, kt: 0, kv: 0 };
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Sociedades', value: depData.soc.toLocaleString('es-AR'), color: T.brand },
                    { label: 'Deptos.', value: selectedDeptos && selectedDeptos.length > 0 ? selectedDeptos.length : Object.keys(allByDepto).length, color: T.positive },
                  ].map(k => (
                    <div key={k.label} style={{ background: T.surfaceL1, borderRadius: 8, padding: '8px 10px', border: `1px solid ${T.borderTertiary}` }}>
                      <div style={{ fontWeight: 700, fontSize: 18, color: k.color }}>{k.value}</div>
                      <div style={{ fontSize: 11, color: T.contentTertiary }}>{k.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Info del último departamento clickeado */}
        {hoveredInfo && (
          <div style={{ padding: 16, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <p style={{ fontWeight: 700, color: T.contentPrimary, fontSize: 14, margin: 0 }}>{hoveredInfo.name}</p>
                <p style={{ fontSize: 12, color: T.contentTertiary, margin: '2px 0 0' }}>{hoveredInfo.prov}</p>
              </div>
              <button onClick={() => setHoveredInfo(null)} style={{ background: 'none', border: 'none', color: T.contentTertiary, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
              {[
                { label: 'Soc.', value: hoveredInfo.d.soc, color: T.brand, bg: T.brandSubtle },
                { label: 'Kt', value: fmt(hoveredInfo.d.kt), color: T.notice, bg: T.noticeSubtle },
                { label: 'Kv', value: fmt(hoveredInfo.d.kv), color: T.positive, bg: T.positiveSubtle },
              ].map(k => (
                <div key={k.label} style={{ background: k.bg, borderRadius: 8, padding: '6px 8px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: T.contentTertiary }}>{k.label}</div>
                </div>
              ))}
            </div>
            {Object.keys(hoveredInfo.acCounts).length > 0 && (
              <>
                <p style={{ fontSize: 11, fontWeight: 600, color: T.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>ACs</p>
                {Object.entries(hoveredInfo.acCounts).sort((a, b) => b[1] - a[1]).map(([ac, cnt]) => (
                  <div key={ac} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${T.borderTertiary}` }}>
                    <button onClick={() => setAcName(ac)} style={{ fontSize: 13, color: T.brand, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{ac}</button>
                    <span style={{ fontSize: 11, color: T.contentTertiary }}>{cnt} soc.</span>
                  </div>
                ))}
              </>
            )}
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => onDeptoFilter && handleLayerClick(hoveredInfo)}
                style={{ width: '100%', padding: '8px', background: selectedKeys.has(hoveredInfo.key) ? T.noticeSubtle : T.brandSubtle, color: selectedKeys.has(hoveredInfo.key) ? T.notice : T.brand, border: `1px solid ${selectedKeys.has(hoveredInfo.key) ? '#f5c9b3' : T.brandBorder}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                {selectedKeys.has(hoveredInfo.key) ? '× Quitar del filtro' : '+ Agregar al filtro'}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
