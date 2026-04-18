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

// Normaliza el nombre de departamento para matching
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
    .replace(/\s+/g, ' ')           // colapsar espacios múltiples
    .trim();
}

function getCircleColor(soc, max) {
  if (!soc || max === 0) return '#94a3b8';
  const t = Math.sqrt(soc / max);
  if (t > 0.8) return '#145210';
  if (t > 0.6) return '#234412';
  if (t > 0.4) return '#3c731f';
  if (t > 0.2) return '#54a22b';
  return '#8cc171';
}

function buildDeptoData(data188, data189) {
  const acByCuit = {};
  (data189 || []).forEach(r => {
    const cuit = String(r['st.cuit'] || r.cuit || '').trim();
    if (cuit) acByCuit[cuit] = String(r.asociado_comercial || '').trim();
  });

  const allByDepto = {};
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

// Leaflet map con círculos proporcionales por departamento
function LeafletMapInner({ geojson, allByDepto, acByDepto, acName, selectedKeys, onLayerClick }) {
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const leafletRef = useRef(null);
  const containerRef = useRef(null);

  const maxSoc = Math.max(...Object.values(allByDepto).map(d => d.soc), 1);

  useEffect(() => {
    async function init() {
      if (!containerRef.current || mapRef.current) return;
      try {
        const L = (await import('leaflet')).default;
        leafletRef.current = L;
        await import('leaflet/dist/leaflet.css');
        const map = L.map(containerRef.current, {
          center: [-38, -65],
          zoom: 4,
          zoomControl: true,
          preferCanvas: true // mejor rendimiento para círculos
        });
        mapRef.current = map;
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OSM &copy; CARTO'
        }).addTo(map);
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

    // Agrupar propiedades del GeoJSON (puede ser aplanado o anidado)
    const layer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        const props = feature.properties || {};
        // Soporta tanto formato aplanado (provincia_nombre) como anidado (provincia.nombre)
        const geoName = props.nombre || '';
        const key = normDepto(geoName);
        const d = allByDepto[key];
        const isSelected = selectedKeys.has(key);
        const soc = d?.soc || 0;

        // Círculo proporcional al número de sociedades
        const radius = soc > 0
          ? Math.max(6, Math.min(40, 6 + Math.sqrt(soc / maxSoc) * 40))
          : 4;

        const color = isSelected
          ? T.selected
          : (acName
            ? (acByDepto[key]?.[acName] ? T.brand : '#e2e8f0')
            : getCircleColor(soc, maxSoc));

        return L.circleMarker(latlng, {
          radius,
          fillColor: color,
          color: isSelected ? '#0a3d5e' : 'rgba(0,0,0,0.15)',
          weight: isSelected ? 2 : 0.5,
          fillOpacity: soc > 0 ? 0.85 : 0.3,
          opacity: 1,
        });
      },
      onEachFeature: (feature, lyr) => {
        const props = feature.properties || {};
        const geoName = props.nombre || '';
        const geoProv = props.provincia_nombre || props.provincia?.nombre || '';
        const key = normDepto(geoName);
        const d = allByDepto[key];

        lyr.on({
          click: () => onLayerClick({
            key,
            name: d?.name || geoName,
            prov: d?.prov || geoProv,
            d: d || { soc: 0, kt: 0, kv: 0 },
            acCounts: acByDepto[key] || {}
          }),
          mouseover: (e) => {
            const el = e.target;
            el.setStyle({ weight: 2, color: T.brand, fillOpacity: 1 });
            el.bringToFront();
          },
          mouseout: (e) => {
            const props2 = feature.properties || {};
            const geoName2 = props2.nombre || '';
            const key2 = normDepto(geoName2);
            const isSelected2 = selectedKeys.has(key2);
            const d2 = allByDepto[key2];
            const soc2 = d2?.soc || 0;
            e.target.setStyle({
              weight: isSelected2 ? 2 : 0.5,
              color: isSelected2 ? '#0a3d5e' : 'rgba(0,0,0,0.15)',
              fillOpacity: soc2 > 0 ? 0.85 : 0.3,
            });
          },
        });

        // Tooltip
        const provLabel = props.provincia_nombre || props.provincia?.nombre || '';
        const soc = d?.soc || 0;
        const kt = d?.kt || 0;
        lyr.bindTooltip(
          `<strong>${geoName}</strong><br/>${provLabel}<br/>` +
          (soc > 0 ? `${soc} soc · ${kt >= 1000 ? (kt/1000).toFixed(1)+'K' : kt} cab` : 'Sin datos'),
          { sticky: true, direction: 'top' }
        );
      },
    }).addTo(map);
    layerRef.current = layer;
  }, [geojson, allByDepto, acByDepto, acName, selectedKeys, maxSoc, onLayerClick]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}

export default function MapaTab({ data188, data189, selectedDeptos = [], onDeptoFilter }) {
  const [geojson, setGeojson] = useState(null);
  const [loadingGeo, setLoadingGeo] = useState(true);
  const [geoError, setGeoError] = useState(null);
  const [acName, setAcName] = useState('');
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    // Intentar primero el archivo local (con polígonos o centroides)
    // Si falla, usar la API de georef online
    const loadGeo = async () => {
      try {
        const r = await fetch('/deptos.geojson');
        if (!r.ok) throw new Error('No local file');
        const d = await r.json();
        if (d?.features?.length > 0) { setGeojson(d); setLoadingGeo(false); return; }
        throw new Error('Empty GeoJSON');
      } catch {
        // Fallback: API georef con aplanar=true para propiedades planas
        try {
          const r2 = await fetch('https://apis.datos.gob.ar/georef/api/departamentos?max=700&formato=geojson&aplanar=true');
          if (!r2.ok) throw new Error('Georef API failed');
          const d2 = await r2.json();
          setGeojson(d2);
        } catch (e2) {
          setGeoError('No se pudo cargar el mapa de departamentos.');
        }
      } finally {
        setLoadingGeo(false);
      }
    };
    loadGeo();
  }, []);

  const noData = !data188 || data188.length === 0;
  const { allByDepto, acByDepto, acList } = noData
    ? { allByDepto: {}, acByDepto: {}, acList: [] }
    : buildDeptoData(data188, data189);

  const selectedKeys = new Set((selectedDeptos || []).map(d => d.key));

  const handleLayerClick = useCallback(({ key, name, prov, d, acCounts }) => {
    if (!onDeptoFilter) return;
    const isSelected = selectedKeys.has(key);
    const next = isSelected
      ? (selectedDeptos || []).filter(x => x.key !== key)
      : [...(selectedDeptos || []), { key, name, prov, d, acCounts }];
    onDeptoFilter(next);
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
            <p style={{ color: T.contentTertiary, fontSize: 13 }}>Usá el botón "Actualizar Datos" del panel lateral y volvé a esta solapa.</p>
          </div>
        )}

        {!noData && loadingGeo && (
          <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: T.surfaceL2, border: `1px solid ${T.brandBorder}`, borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, border: `2px solid ${T.brand}`, borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 13, color: T.contentSecondary }}>Cargando GeoJSON…</span>
          </div>
        )}

        {geoError && (
          <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#dc2626' }}>
            {geoError}
          </div>
        )}

        {/* Banner filtro activo */}
        {selectedDeptos && selectedDeptos.length > 0 && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: T.selected, color: '#fff', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px #0003', whiteSpace: 'nowrap' }}>
            <span>📍 {selectedDeptos.length} depto{selectedDeptos.length !== 1 ? 's' : ''} — filtrando tablas</span>
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

        {/* Hint */}
        {!noData && (!selectedDeptos || selectedDeptos.length === 0) && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'rgba(255,255,255,0.9)', border: `1px solid ${T.borderTertiary}`, borderRadius: 8, padding: '5px 14px', fontSize: 12, color: T.contentTertiary, whiteSpace: 'nowrap' }}>
            Hacé click en un círculo para filtrar por ese departamento
          </div>
        )}

        {/* Leyenda */}
        <div style={{ position: 'absolute', bottom: 50, left: 12, zIndex: 1000, background: T.surfaceL2, border: `1px solid ${T.borderTertiary}`, borderRadius: 8, padding: '10px 14px', boxShadow: '0 1px 4px #0002', minWidth: 140 }}>
          <p style={{ fontWeight: 600, color: T.contentSecondary, fontSize: 12, marginBottom: 8 }}>Soc. Base Clave / Depto</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              ['#145210', 'Muy alta (>100)'],
              ['#234412', 'Alta (50-100)'],
              ['#3c731f', 'Media (20-50)'],
              ['#54a22b', 'Baja (5-20)'],
              ['#8cc171', 'Muy baja (<5)'],
            ].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: c, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: T.contentTertiary }}>{l}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingTop: 6, borderTop: `1px solid ${T.borderTertiary}` }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: T.selected, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: T.selected, fontWeight: 600 }}>Seleccionado (filtro)</span>
            </div>
          </div>
          <p style={{ fontSize: 10, color: T.contentTertiary, marginTop: 8, lineHeight: 1.4 }}>Tamaño del círculo = cantidad de soc.</p>
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

        {/* Filtro por deptos */}
        <div style={{ padding: 16, borderBottom: `1px solid ${T.borderTertiary}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: T.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              Filtro mapa ({(selectedDeptos || []).length})
            </p>
            {selectedDeptos && selectedDeptos.length > 0 && (
              <button onClick={() => onDeptoFilter && onDeptoFilter([])} style={{ fontSize: 11, color: T.notice, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Limpiar</button>
            )}
          </div>
          {(!selectedDeptos || selectedDeptos.length === 0) ? (
            <p style={{ fontSize: 12, color: T.contentTertiary, fontStyle: 'italic' }}>Hacé click en el mapa para filtrar por departamento</p>
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

        {/* KPIs */}
        {!noData && (
          <div style={{ padding: 16, borderBottom: `1px solid ${T.borderTertiary}` }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: T.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              {selectedDeptos && selectedDeptos.length > 0 ? 'Deptos seleccionados' : 'Totales cargados'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Sociedades', value: (selectedDeptos?.length > 0 ? selectedDeptos.reduce((a, d) => a + (d.d?.soc || 0), 0) : data188.length).toLocaleString('es-AR'), color: T.brand },
                { label: 'Deptos.', value: selectedDeptos?.length > 0 ? selectedDeptos.length : Object.keys(allByDepto).length, color: T.positive },
              ].map(k => (
                <div key={k.label} style={{ background: T.surfaceL1, borderRadius: 8, padding: '8px 10px', border: `1px solid ${T.borderTertiary}` }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: T.contentTertiary }}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info depto clickeado */}
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
                { label: 'Kt cab', value: fmt(hoveredInfo.d.kt), color: T.notice, bg: T.noticeSubtle },
                { label: 'Kv vac', value: fmt(hoveredInfo.d.kv), color: T.positive, bg: T.positiveSubtle },
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
                {Object.entries(hoveredInfo.acCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([ac, cnt]) => (
                  <div key={ac} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${T.borderTertiary}` }}>
                    <button onClick={() => setAcName(ac)} style={{ fontSize: 13, color: T.brand, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{ac}</button>
                    <span style={{ fontSize: 11, color: T.contentTertiary }}>{cnt} soc.</span>
                  </div>
                ))}
              </>
            )}
            <button
              onClick={() => handleLayerClick(hoveredInfo)}
              style={{ width: '100%', marginTop: 12, padding: '8px', background: selectedKeys.has(hoveredInfo.key) ? T.noticeSubtle : T.brandSubtle, color: selectedKeys.has(hoveredInfo.key) ? T.notice : T.brand, border: `1px solid ${selectedKeys.has(hoveredInfo.key) ? '#f5c9b3' : T.brandBorder}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {selectedKeys.has(hoveredInfo.key) ? '× Quitar del filtro' : '+ Agregar al filtro'}
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
