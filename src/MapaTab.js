'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Paleta ───────────────────────────────────────────────────────────────────
const COLOR = {
  bg:            '#0f1923',
  surface:       '#1a2433',
  surfaceHover:  '#1f2d41',
  border:        '#2a3a4d',
  borderLight:   '#344a61',
  brand:         '#3179a7',
  brandLight:    '#4a9dcf',
  brandSubtle:   'rgba(49,121,167,0.18)',
  text:          '#e2eaf2',
  textMuted:     '#8fa8c0',
  textFaint:     '#4d6a82',
  positive:      '#34c68e',
  positiveSubtle:'rgba(52,198,142,0.15)',
  warn:          '#f0a742',
  warnSubtle:    'rgba(240,167,66,0.15)',
  danger:        '#e06060',
  selected:      '#60c4f0',
  selectedBg:    'rgba(96,196,240,0.22)',
  // Heat scale – azul de marca
  heat: ['#c6dff0','#8bbfde','#5598c8','#3179a7','#1e5a84','#0e3d5e'],
};

// ─── Normalización de nombres ─────────────────────────────────────────────────
function normDepto(name) {
  let s = String(name || '').replace(/([a-z])([A-Z])/g, '$1 $2');
  return s
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, ' ')
    .replace(/\bGRAL\b/g, 'GENERAL').replace(/\bCNEL\b/g, 'CORONEL')
    .replace(/\bSTA\b/g, 'SANTA').replace(/\bSTO\b/g, 'SANTO')
    .replace(/\bTTE\b/g, 'TENIENTE').replace(/\bPTE\b/g, 'PRESIDENTE')
    .replace(/\s+/g, ' ').trim();
}

// ─── Color de calor ───────────────────────────────────────────────────────────
function heatColor(soc, max) {
  if (!soc || max === 0) return null;
  const t = Math.pow(soc / max, 0.45);
  const idx = Math.min(COLOR.heat.length - 1, Math.floor(t * COLOR.heat.length));
  return COLOR.heat[idx];
}

// ─── Agregación de datos ──────────────────────────────────────────────────────
function buildDeptoData(data188, data189) {
  const acByCuit = {};
  (data189 || []).forEach(r => {
    const cuit = String(r['st.cuit'] || r.cuit || '').trim();
    if (cuit) acByCuit[cuit] = String(r.asociado_comercial || '').trim();
  });

  const byDepto = {};
  const acByDepto = {};
  const acSet = new Set();

  (data188 || []).forEach(r => {
    const cuit    = String(r.cuit || '').trim();
    const rawName = String(r.partido_establecimiento_senasa || r.partido_fiscal_senasa || '').trim();
    const rawProv = String(r.prov_establecimiento_senasa   || r.prov_fiscal_senasa   || '').trim();
    if (!rawName) return;

    const key = normDepto(rawName);
    const ac  = acByCuit[cuit] || 'SIN AC';
    const kt  = parseFloat(r.total_bovinos) || 0;
    const kv  = parseFloat(r.total_vacas)   || 0;

    if (!byDepto[key]) byDepto[key] = { soc: 0, kt: 0, kv: 0, name: rawName, prov: rawProv };
    byDepto[key].soc++;
    byDepto[key].kt += kt;
    byDepto[key].kv += kv;

    if (!acByDepto[key]) acByDepto[key] = {};
    acByDepto[key][ac] = (acByDepto[key][ac] || 0) + 1;
    if (ac !== 'SIN AC') acSet.add(ac);
  });

  return { byDepto, acByDepto, acList: Array.from(acSet).sort() };
}

// ─── Número formateado ─────────────────────────────────────────────────────────
const fmt = n => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : String(Math.round(n));

// ─── Mapa Leaflet ─────────────────────────────────────────────────────────────
function LeafletMapInner({ geojson, byDepto, acByDepto, acName, selectedKeys, onLayerClick }) {
  const mapRef       = useRef(null);
  const layerRef     = useRef(null);
  const leafletRef   = useRef(null);
  const containerRef = useRef(null);

  const maxSoc = Math.max(...Object.values(byDepto).map(d => d.soc), 1);

  const getStyle = useCallback((feature) => {
    const nombre = feature.properties?.NAME_2 || feature.properties?.nombre || '';
    const key    = normDepto(nombre);
    const d      = byDepto[key];
    const sel    = selectedKeys.has(key);
    const soc    = d?.soc || 0;

    if (sel) return {
      fillColor: COLOR.selected, weight: 2.5,
      color: '#fff', fillOpacity: 0.9, dashArray: null,
    };
    if (acName) {
      const hasSoc = (acByDepto[key]?.[acName] ?? 0) > 0;
      return {
        fillColor: hasSoc ? COLOR.brand : COLOR.border,
        weight: 0.3, color: '#0a1520', fillOpacity: hasSoc ? 0.88 : 0.35,
      };
    }
    if (!soc) return { fillColor: '#14222f', weight: 0.3, color: '#0a1520', fillOpacity: 0.8 };
    return {
      fillColor: heatColor(soc, maxSoc),
      weight: 0.3, color: '#0a1520', fillOpacity: 0.88,
    };
  }, [byDepto, acByDepto, acName, selectedKeys, maxSoc]);

  // Init
  useEffect(() => {
    async function init() {
      if (!containerRef.current || mapRef.current) return;
      try {
        const L = (await import('leaflet')).default;
        leafletRef.current = L;
        await import('leaflet/dist/leaflet.css');
        const map = L.map(containerRef.current, {
          center: [-37.5, -64.5], zoom: 4, zoomControl: false,
          preferCanvas: false,
        });
        mapRef.current = map;
        // Basemap oscuro sin labels
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://carto.com">CARTO</a>',
          subdomains: 'abcd', maxZoom: 19,
        }).addTo(map);
        // Zoom controls top-right
        L.control.zoom({ position: 'topright' }).addTo(map);
      } catch(e) { console.error(e); }
    }
    init();
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // GeoJSON layer
  useEffect(() => {
    const map = mapRef.current;
    const L   = leafletRef.current;
    if (!map || !L || !geojson) return;
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }

    const layer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        const key = normDepto(feature.properties?.NAME_2 || feature.properties?.nombre || '');
        const d   = byDepto[key];
        const soc = d?.soc || 0;
        const sel = selectedKeys.has(key);
        const r   = soc > 0 ? Math.max(5, Math.min(32, 4 + Math.sqrt(soc/maxSoc)*32)) : 3;
        return L.circleMarker(latlng, {
          radius: r,
          fillColor: sel ? COLOR.selected : (heatColor(soc, maxSoc) || '#1a2d3e'),
          color: sel ? '#fff' : 'rgba(0,0,0,0.3)',
          weight: sel ? 1.5 : 0.4,
          fillOpacity: soc > 0 ? 0.88 : 0.25,
        });
      },
      style: getStyle,
      onEachFeature: (feature, lyr) => {
        const nombre = feature.properties?.NAME_2 || feature.properties?.nombre || '';
        const prov   = feature.properties?.NAME_1 || feature.properties?.provincia_nombre || feature.properties?.provincia?.nombre || '';
        const key    = normDepto(nombre);
        const d      = byDepto[key];
        const soc    = d?.soc || 0;
        const kt     = d?.kt  || 0;

        lyr.on({
          click: () => onLayerClick({
            key, name: d?.name || nombre, prov: d?.prov || prov,
            d: d || { soc: 0, kt: 0, kv: 0 }, acCounts: acByDepto[key] || {},
          }),
          mouseover: e => {
            if (!selectedKeys.has(key)) {
              e.target.setStyle({ weight: 1.2, color: COLOR.selected, fillOpacity: 1 });
              e.target.bringToFront();
            }
          },
          mouseout: e => { layer.resetStyle(e.target); },
        });

        lyr.bindTooltip(
          `<div style="font-family:system-ui;padding:2px 4px">
            <div style="font-weight:700;font-size:13px;color:#e2eaf2">${d?.name || nombre}</div>
            <div style="font-size:11px;color:#8fa8c0;margin-bottom:4px">${prov}</div>
            ${soc > 0
              ? `<div style="font-size:12px;color:#60c4f0"><strong>${soc}</strong> soc&nbsp;·&nbsp;<strong>${fmt(kt)}</strong> cab</div>`
              : `<div style="font-size:11px;color:#4d6a82;font-style:italic">Sin datos</div>`}
           </div>`,
          { sticky: true, direction: 'top', className: 'depto-tooltip', offset: [0, -8] }
        );
      },
    }).addTo(map);
    layerRef.current = layer;
  }, [geojson, getStyle, byDepto, acByDepto, onLayerClick, selectedKeys, maxSoc]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}

// ─── Panel card ──────────────────────────────────────────────────────────────
function Stat({ label, value, color }) {
  return (
    <div style={{ background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: COLOR.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MapaTab({ data188, data189, selectedDeptos = [], onDeptoFilter }) {
  const [geojson,    setGeojson]    = useState(null);
  const [loadingGeo, setLoadingGeo] = useState(true);
  const [acName,     setAcName]     = useState('');
  const [activeInfo, setActiveInfo] = useState(null);
  const [isClient,   setIsClient]   = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/deptos.geojson');
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (d?.features?.length > 0) { setGeojson(d); return; }
        throw new Error();
      } catch {
        try {
          const r2 = await fetch('https://apis.datos.gob.ar/georef/api/departamentos?max=700&formato=geojson&aplanar=true');
          if (r2.ok) setGeojson(await r2.json());
        } catch {}
      } finally { setLoadingGeo(false); }
    };
    load();
  }, []);

  const noData = !data188 || data188.length === 0;
  const { byDepto, acByDepto, acList } = noData
    ? { byDepto: {}, acByDepto: {}, acList: [] }
    : buildDeptoData(data188, data189);

  const selectedKeys = new Set((selectedDeptos || []).map(d => d.key));

  const handleLayerClick = useCallback(({ key, name, prov, d, acCounts }) => {
    const sel  = selectedKeys.has(key);
    const next = sel
      ? (selectedDeptos || []).filter(x => x.key !== key)
      : [...(selectedDeptos || []), { key, name, prov, d, acCounts }];
    onDeptoFilter?.(next);
    setActiveInfo({ key, name, prov, d, acCounts });
  }, [selectedKeys, selectedDeptos, onDeptoFilter]);

  const totalSoc  = selectedDeptos.length > 0
    ? selectedDeptos.reduce((a, d) => a + (d.d?.soc || 0), 0)
    : data188?.length || 0;
  const totalDep  = selectedDeptos.length > 0 ? selectedDeptos.length : Object.keys(byDepto).length;

  if (!isClient) return null;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', background: COLOR.bg, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Mapa ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Sin datos */}
        {noData && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 10 }}>
            <div style={{ fontSize: 56, lineHeight: 1 }}>🗺️</div>
            <p style={{ color: COLOR.text, fontWeight: 700, fontSize: 18, margin: 0 }}>Sin datos cargados</p>
            <p style={{ color: COLOR.textMuted, fontSize: 14, margin: 0, textAlign: 'center', maxWidth: 320 }}>
              Hacé click en <strong style={{ color: COLOR.brandLight }}>Actualizar Datos</strong> en el panel lateral para cargar el mapa de potencial ganadero.
            </p>
          </div>
        )}

        {/* Loader GeoJSON */}
        {!noData && loadingGeo && (
          <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 20, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            <div style={{ width: 14, height: 14, border: `2px solid ${COLOR.brand}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            <span style={{ fontSize: 13, color: COLOR.textMuted }}>Cargando geografía…</span>
          </div>
        )}

        {/* Banner filtro activo - top center */}
        {selectedDeptos.length > 0 && (
          <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: COLOR.selectedBg, backdropFilter: 'blur(10px)', border: `1px solid ${COLOR.selected}`, borderRadius: 99, padding: '6px 18px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: `0 0 20px rgba(96,196,240,0.2)`, whiteSpace: 'nowrap' }}>
            <span style={{ width: 8, height: 8, background: COLOR.selected, borderRadius: '50%', display: 'inline-block' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: COLOR.selected }}>
              {selectedDeptos.length} depto{selectedDeptos.length !== 1 ? 's' : ''} · filtrando tablas
            </span>
            <button onClick={() => onDeptoFilter?.([])} style={{ background: 'rgba(96,196,240,0.2)', border: `1px solid ${COLOR.selected}40`, borderRadius: 99, color: COLOR.selected, padding: '2px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              × Limpiar
            </button>
          </div>
        )}

        {/* Hint sin selección */}
        {!noData && selectedDeptos.length === 0 && (
          <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'rgba(15,25,35,0.7)', backdropFilter: 'blur(8px)', border: `1px solid ${COLOR.border}`, borderRadius: 99, padding: '5px 16px', fontSize: 12, color: COLOR.textMuted, whiteSpace: 'nowrap' }}>
            Click en un departamento para filtrar las tablas
          </div>
        )}

        {/* Leyenda */}
        {!noData && (
          <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 1000, background: 'rgba(15,25,35,0.85)', backdropFilter: 'blur(12px)', border: `1px solid ${COLOR.border}`, borderRadius: 12, padding: '12px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', minWidth: 160 }}>
            <p style={{ fontWeight: 700, color: COLOR.text, fontSize: 12, margin: '0 0 10px', letterSpacing: '0.04em' }}>SOC. BASE CLAVE</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                [COLOR.heat[5], 'Máxima densidad'],
                [COLOR.heat[4], 'Muy alta'],
                [COLOR.heat[3], 'Alta'],
                [COLOR.heat[2], 'Media'],
                [COLOR.heat[1], 'Baja'],
                [COLOR.heat[0], 'Muy baja'],
              ].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 10, borderRadius: 3, background: c, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: COLOR.textMuted }}>{l}</span>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${COLOR.border}`, marginTop: 4, paddingTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 10, borderRadius: 3, background: COLOR.selected, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: COLOR.selected, fontWeight: 600 }}>Seleccionado</span>
              </div>
            </div>
          </div>
        )}

        {/* Mapa Leaflet */}
        {!noData && <LeafletMapInner
          geojson={geojson}
          byDepto={byDepto}
          acByDepto={acByDepto}
          acName={acName}
          selectedKeys={selectedKeys}
          onLayerClick={handleLayerClick}
        />}
      </div>

      {/* ── Panel derecho ── */}
      <div style={{ width: 300, background: COLOR.surface, borderLeft: `1px solid ${COLOR.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${COLOR.border}` }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLOR.text }}>Panel de Mapa</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: COLOR.textMuted }}>Potencial ganadero por departamento</p>
        </div>

        {/* KPIs */}
        <div style={{ padding: 16, borderBottom: `1px solid ${COLOR.border}` }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: COLOR.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {selectedDeptos.length > 0 ? 'Seleccionados' : 'Cargados'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Stat label="Sociedades" value={totalSoc.toLocaleString('es-AR')} color={COLOR.brandLight} />
            <Stat label="Deptos." value={totalDep} color={COLOR.positive} />
          </div>
        </div>

        {/* Filtro AC */}
        <div style={{ padding: 16, borderBottom: `1px solid ${COLOR.border}` }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: COLOR.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Resaltar AC
          </p>
          <div style={{ position: 'relative' }}>
            <select value={acName} onChange={e => setAcName(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', background: COLOR.bg, border: `1px solid ${acName ? COLOR.brand : COLOR.border}`, borderRadius: 8, fontSize: 13, color: acName ? COLOR.brandLight : COLOR.textMuted, cursor: 'pointer', outline: 'none', appearance: 'none' }}>
              <option value="">Todos los ACs</option>
              {acList.map(ac => <option key={ac} value={ac}>{ac}</option>)}
            </select>
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: COLOR.textFaint, pointerEvents: 'none' }}>▾</div>
          </div>
          {acName && (
            <button onClick={() => setAcName('')} style={{ marginTop: 8, fontSize: 12, color: COLOR.textMuted, background: 'none', border: `1px solid ${COLOR.border}`, borderRadius: 6, padding: '4px 12px', cursor: 'pointer', width: '100%' }}>
              Limpiar filtro AC
            </button>
          )}
        </div>

        {/* Deptos seleccionados */}
        <div style={{ padding: 16, borderBottom: `1px solid ${COLOR.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: COLOR.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Filtro activo ({selectedDeptos.length})
            </p>
            {selectedDeptos.length > 0 && (
              <button onClick={() => onDeptoFilter?.([])} style={{ fontSize: 11, color: COLOR.danger, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Limpiar</button>
            )}
          </div>
          {selectedDeptos.length === 0 ? (
            <p style={{ fontSize: 12, color: COLOR.textFaint, fontStyle: 'italic', margin: 0 }}>Hacé click en el mapa para filtrar por departamento</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selectedDeptos.map(dep => (
                <div key={dep.key} style={{ display: 'flex', alignItems: 'center', gap: 4, background: COLOR.selectedBg, border: `1px solid ${COLOR.selected}50`, borderRadius: 99, padding: '3px 10px' }}>
                  <span style={{ fontSize: 12, color: COLOR.selected, fontWeight: 600 }}>{dep.name}</span>
                  <button onClick={() => onDeptoFilter?.((selectedDeptos || []).filter(x => x.key !== dep.key))}
                    style={{ background: 'none', border: 'none', color: COLOR.selected, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info depto clickeado */}
        {activeInfo && (
          <div style={{ padding: 16, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: COLOR.text, fontSize: 15 }}>{activeInfo.name}</p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: COLOR.textMuted }}>{activeInfo.prov}</p>
              </div>
              <button onClick={() => setActiveInfo(null)} style={{ background: COLOR.bg, border: `1px solid ${COLOR.border}`, borderRadius: 6, color: COLOR.textMuted, cursor: 'pointer', width: 28, height: 28, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { l: 'Soc.',   v: activeInfo.d.soc,        c: COLOR.brandLight, bg: COLOR.brandSubtle },
                { l: 'Kt cab', v: fmt(activeInfo.d.kt),     c: COLOR.warn,       bg: COLOR.warnSubtle },
                { l: 'Kv vac', v: fmt(activeInfo.d.kv),     c: COLOR.positive,   bg: COLOR.positiveSubtle },
              ].map(({ l, v, c, bg }) => (
                <div key={l} style={{ background: bg, border: `1px solid ${c}30`, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: c }}>{v}</div>
                  <div style={{ fontSize: 10, color: COLOR.textMuted, marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>

            {Object.keys(activeInfo.acCounts).length > 0 && (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: COLOR.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Asociados Comerciales</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.entries(activeInfo.acCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([ac, cnt]) => (
                    <div key={ac} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: COLOR.bg, borderRadius: 7, border: `1px solid ${COLOR.border}` }}>
                      <button onClick={() => setAcName(ac)} style={{ fontSize: 13, color: COLOR.brandLight, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>{ac}</button>
                      <span style={{ fontSize: 11, color: COLOR.textMuted, background: COLOR.surface, borderRadius: 99, padding: '1px 8px' }}>{cnt}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button onClick={() => handleLayerClick(activeInfo)}
              style={{ width: '100%', marginTop: 14, padding: '10px', background: selectedKeys.has(activeInfo.key) ? 'rgba(224,96,96,0.15)' : COLOR.brandSubtle, color: selectedKeys.has(activeInfo.key) ? COLOR.danger : COLOR.brandLight, border: `1px solid ${selectedKeys.has(activeInfo.key) ? COLOR.danger+'50' : COLOR.brand+'50'}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all .2s' }}>
              {selectedKeys.has(activeInfo.key) ? '× Quitar del filtro' : '+ Agregar al filtro'}
            </button>
          </div>
        )}

        {/* Placeholder cuando no hay info seleccionada */}
        {!activeInfo && !noData && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}>
            <div style={{ fontSize: 36, opacity: 0.3 }}>🗺️</div>
            <p style={{ fontSize: 13, color: COLOR.textFaint, textAlign: 'center', margin: 0 }}>Hacé click en un departamento para ver su detalle</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .depto-tooltip { background: #0f1923 !important; border: 1px solid #2a3a4d !important; border-radius: 8px !important; box-shadow: 0 4px 20px rgba(0,0,0,.6) !important; padding: 8px 12px !important; }
        .depto-tooltip::before { display: none !important; }
        .leaflet-tooltip-top.depto-tooltip::before { display: none !important; }
        .leaflet-control-zoom a { background: #1a2433 !important; color: #e2eaf2 !important; border-color: #2a3a4d !important; }
        .leaflet-control-zoom a:hover { background: #3179a7 !important; }
        .leaflet-control-attribution { background: rgba(15,25,35,0.7) !important; color: #4d6a82 !important; font-size: 10px !important; }
        .leaflet-control-attribution a { color: #3179a7 !important; }
      `}</style>
    </div>
  );
}
