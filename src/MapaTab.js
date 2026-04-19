'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// ─── Paleta UI ─────────────────────────────────────────────────────────
const C = {
  bg:       '#0f1923', surface:  '#1a2433', border:   '#2a3a4d',
  brand:    '#3179a7', brandL:   '#4a9dcf', brandSub: 'rgba(49,121,167,0.18)',
  text:     '#e2eaf2', textMuted:'#8fa8c0', textFaint:'#4d6a82',
  positive: '#34c68e', posSub:   'rgba(52,198,142,0.15)',
  warn:     '#f0a742', warnSub:  'rgba(240,167,66,0.15)',
  danger:   '#e06060', sel:      '#60c4f0', selBg:    'rgba(96,196,240,0.22)',
  // Escala de calor azul de marca
  heat: ['#d4e9f7','#9ac8e8','#5fa8d3','#3179a7','#1d5a87','#0d3d62'],
};

// Colores vivos para zonas (hasta 24 zonas distintas)
const ZONA_PAL = [
  '#f94144','#f3722c','#f9c74f','#90be6d','#43aa8b',
  '#4d908e','#277da1','#a8dadc','#e07a5f','#81b29a',
  '#e9c46a','#264653','#2a9d8f','#e76f51','#9b2226',
  '#ae2012','#bb3e03','#ca6702','#ee9b00','#94d2bd',
  '#0a9396','#005f73','#001219','#e9d8a6',
];

// ─── Normalización ─────────────────────────────────────────────────────
function norm(name) {
  let s = String(name||'').replace(/([a-z])([A-Z])/g,'$1 $2');
  return s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\./g,' ')
    .replace(/\bGRAL\b/g,'GENERAL').replace(/\bCNEL\b/g,'CORONEL')
    .replace(/\bSTA\b/g,'SANTA').replace(/\bSTO\b/g,'SANTO')
    .replace(/\bTTE\b/g,'TENIENTE').replace(/\bPTE\b/g,'PRESIDENTE')
    .replace(/\s+/g,' ').trim();
}

// ─── Color calor ───────────────────────────────────────────────────────
function hCol(soc, max) {
  if (!soc || max===0) return '#14222f';
  const t = Math.pow(soc/max, 0.45);
  return C.heat[Math.min(C.heat.length-1, Math.floor(t*C.heat.length))];
}

// ─── Paleta de zonas (asigna color único por zona) ─────────────────────
function buildZonePalette(zonasOrdenadas=[]) {
  const p = {};
  zonasOrdenadas.forEach((z,i) => { p[z] = ZONA_PAL[i % ZONA_PAL.length]; });
  return p;
}

// ─── Construir datos por depto ─────────────────────────────────────────
function buildByDepto(data188) {
  const m = {};
  (data188||[]).forEach(r => {
    const rawName = String(r.partido_establecimiento_senasa||r.partido_fiscal_senasa||'').trim();
    const rawProv = String(r.prov_establecimiento_senasa  ||r.prov_fiscal_senasa  ||'').trim();
    if (!rawName) return;
    const key = norm(rawName);
    if (!m[key]) m[key] = {soc:0,kt:0,kv:0,name:rawName,prov:rawProv};
    m[key].soc++;
    m[key].kt += parseFloat(r.total_bovinos)||0;
    m[key].kv += parseFloat(r.total_vacas)  ||0;
  });
  return m;
}

const fmt = n => n>=1e6?(n/1e6).toFixed(1)+'M':n>=1000?(n/1000).toFixed(1)+'K':String(Math.round(n));

// ─── Botón de modo ─────────────────────────────────────────────────────
function ModeBtn({label, active, onClick}) {
  return (
    <button onClick={onClick} style={{
      padding:'7px 18px', borderRadius:8,
      border:`1px solid ${active?C.brand:C.border}`,
      background: active ? C.brandSub : 'transparent',
      color: active ? C.brandL : C.textMuted,
      fontWeight: active?700:400, fontSize:13, cursor:'pointer', transition:'all .15s',
    }}>{label}</button>
  );
}

// ─── Mapa Leaflet con capas diferenciadas ──────────────────────────────
function LeafletMap({
  geojsonDeptos, geojsonProvs,
  byDepto, zonaData, zonePalette,
  filterMode, selectedKeys, onFeatureClick,
}) {
  const cRef    = useRef(null);
  const mapR    = useRef(null);
  const LRef    = useRef(null);
  // Capas separadas
  const lyrHeatR  = useRef(null); // fill heatmap (siempre)
  const lyrProvR  = useRef(null); // overlay provincias (modo provincias)
  const lyrZonaR  = useRef(null); // overlay bordes zona (modo zonas)
  const lyrDeptR  = useRef(null); // overlay bordes depto (modo departamentos)

  const maxSoc = useMemo(
    () => Math.max(...Object.values(byDepto).map(d=>d.soc),1),
    [byDepto]
  );

  // ── Init map ───────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      if (!cRef.current || mapR.current) return;
      const L = (await import('leaflet')).default;
      LRef.current = L;
      await import('leaflet/dist/leaflet.css');
      const map = L.map(cRef.current, {
        center:[-37.5,-64.5], zoom:4, zoomControl:false, preferCanvas:false,
      });
      mapR.current = map;
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
        {attribution:'&copy; CARTO', subdomains:'abcd', maxZoom:19}).addTo(map);
      L.control.zoom({position:'topright'}).addTo(map);
    }
    init();
    return () => { if (mapR.current){mapR.current.remove();mapR.current=null;} };
  }, []);

  // ── Capa HEATMAP (fill siempre visible, interacción) ───────────────
  useEffect(() => {
    const map = mapR.current, L = LRef.current;
    if (!map||!L||!geojsonDeptos) return;
    if (lyrHeatR.current){lyrHeatR.current.remove();lyrHeatR.current=null;}

    const layer = L.geoJSON(geojsonDeptos, {
      pointToLayer: (f,ll) => {
        const key = norm(f.properties?.NAME_2||f.properties?.nombre||'');
        const d = byDepto[key]; const soc=d?.soc||0; const sel=selectedKeys.has(key);
        const r = soc>0?Math.max(4,Math.min(30,4+Math.sqrt(soc/maxSoc)*30)):3;
        return L.circleMarker(ll,{radius:r,fillColor:sel?C.sel:hCol(soc,maxSoc),color:'rgba(0,0,0,0.2)',weight:0.4,fillOpacity:soc>0?0.88:0.2});
      },
      style: (f) => {
        const key = norm(f.properties?.NAME_2||f.properties?.nombre||'');
        const d = byDepto[key]; const soc=d?.soc||0; const sel=selectedKeys.has(key);
        return {
          fillColor: sel ? C.sel : hCol(soc,maxSoc),
          weight: 0, // sin borde — el borde lo pone la capa de overlay
          fillOpacity: 0.88,
        };
      },
      onEachFeature: (f,lyr) => {
        const nombre = f.properties?.NAME_2||f.properties?.nombre||'';
        const prov   = f.properties?.NAME_1||f.properties?.provincia_nombre||'';
        const key    = norm(nombre);
        const d      = byDepto[key]; const soc=d?.soc||0; const kt=d?.kt||0;
        const zona   = zonaData?.deptoMap?.[key]?.zona||'';

        lyr.on({
          click: () => onFeatureClick({key,nombre:d?.name||nombre,prov:d?.prov||prov,d:d||{soc:0,kt:0,kv:0},zona}),
          mouseover: e => { e.target.setStyle({fillOpacity:1}); e.target.bringToFront(); },
          mouseout:  e => { layer.resetStyle(e.target); },
        });

        const zCol = zona&&zonePalette?.[zona] ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${zonePalette[zona]};margin-right:4px"></span>${zona}` : '';
        lyr.bindTooltip(
          `<div style="font-family:system-ui;padding:2px 4px">
            <div style="font-weight:700;font-size:13px;color:${C.text}">${d?.name||nombre}</div>
            <div style="font-size:11px;color:${C.textMuted};margin-bottom:3px">${prov}</div>
            ${zone?`<div style="font-size:10px;color:${C.textFaint};margin-bottom:3px">${zCol}</div>`:''}
            ${soc>0
              ?`<div style="font-size:12px;color:${C.sel}"><strong>${soc}</strong> soc · <strong>${fmt(kt)}</strong> cab</div>`
              :`<div style="font-size:11px;color:${C.textFaint};font-style:italic">Sin datos</div>`
            }
           </div>`,
          {sticky:true,direction:'top',className:'dep-tip',offset:[0,-8]}
        );
      },
    }).addTo(map);
    lyrHeatR.current = layer;
  }, [geojsonDeptos, byDepto, zonaData, zonePalette, selectedKeys, onFeatureClick, maxSoc]);

  // ── Capa BORDES DEPARTAMENTOS (modo departamentos) ─────────────────
  useEffect(() => {
    const map = mapR.current, L = LRef.current;
    if (!map||!L) return;
    if (lyrDeptR.current){lyrDeptR.current.remove();lyrDeptR.current=null;}
    if (filterMode!=='departamentos'||!geojsonDeptos) return;

    const layer = L.geoJSON(geojsonDeptos, {
      pointToLayer: ()=>null,
      style: (f) => {
        const key = norm(f.properties?.NAME_2||f.properties?.nombre||'');
        const sel = selectedKeys.has(key);
        return {
          fillColor:'transparent', fillOpacity:0,
          color: sel ? '#fff' : '#7a9ab5',
          weight: sel ? 2 : 0.6,
        };
      },
      interactive: false,
    }).addTo(map);
    lyrDeptR.current = layer;
  }, [geojsonDeptos, filterMode, selectedKeys]);

  // ── Capa OVERLAY PROVINCIAS (modo provincias) ──────────────────────
  useEffect(() => {
    const map = mapR.current, L = LRef.current;
    if (!map||!L) return;
    if (lyrProvR.current){lyrProvR.current.remove();lyrProvR.current=null;}
    // Modo provincias: borde depto fino + overlay de provincia blanco grueso
    if (filterMode==='provincias') {
      // Capa de bordes departamentales finos (siempre en modo provincias)
      if (geojsonDeptos) {
        const dLayer = L.geoJSON(geojsonDeptos,{
          pointToLayer:()=>null,
          style:()=>({fillColor:'transparent',fillOpacity:0,color:'#7a9ab5',weight:0.4}),
          interactive:false,
        }).addTo(map);
        lyrProvR.current = dLayer; // reutilizamos la ref para el primer sub-layer
      }

      // Capa de bordes provinciales (blanco grueso, sin relleno)
      if (geojsonProvs) {
        const pLayer = L.geoJSON(geojsonProvs,{
          pointToLayer:()=>null,
          style:()=>({fillColor:'transparent',fillOpacity:0,color:'#ffffff',weight:3,opacity:0.9}),
          interactive:false,
        }).addTo(map);
        // Guardar ambas: usamos array
        lyrProvR.current = {remove: ()=>{dLayer&&dLayer.remove?.();pLayer&&pLayer.remove?.();}};
      }
    }
  }, [geojsonDeptos, geojsonProvs, filterMode, selectedKeys]);

  // ── Capa OVERLAY ZONAS (modo zonas) ───────────────────────────────
  useEffect(() => {
    const map = mapR.current, L = LRef.current;
    if (!map||!L) return;
    if (lyrZonaR.current){lyrZonaR.current.remove();lyrZonaR.current=null;}
    if (filterMode!=='zonas'||!geojsonDeptos||!zonaData||!zonePalette) return;

    // Cada departamento tiene borde del color de su zona
    // El grosor del borde hace visible el cambio de zona entre deptos vecinos
    const layer = L.geoJSON(geojsonDeptos, {
      pointToLayer:()=>null,
      style: (f) => {
        const nombre = f.properties?.NAME_2||f.properties?.nombre||'';
        const key    = norm(nombre);
        const zona   = zonaData?.deptoMap?.[key]?.zona;
        const col    = (zona && zonePalette[zona]) ? zonePalette[zona] : '#3a4a5a';
        const sel    = selectedKeys.has(key);
        return {
          fillColor:'transparent', fillOpacity:0,
          color: sel ? '#fff' : col,
          weight: sel ? 3 : 1.8,
          opacity: sel ? 1 : 0.85,
        };
      },
      interactive: false,
    }).addTo(map);
    lyrZonaR.current = layer;
  }, [geojsonDeptos, filterMode, zonaData, zonePalette, selectedKeys]);

  return <div ref={cRef} style={{height:'100%',width:'100%'}} />;
}

// ─── Panel lateral de zonas ────────────────────────────────────────────
function ZonaPanel({zonaData, byDepto, selectedDeptos, selectedKeys, onDeptoFilter, zonePalette}) {
  return (
    <div style={{width:230,background:C.surface,borderRight:`1px solid ${C.border}`,overflowY:'auto',padding:'12px 0'}}>
      <p style={{padding:'0 14px',margin:'0 0 10px',fontSize:11,fontWeight:700,color:C.textFaint,textTransform:'uppercase',letterSpacing:'0.08em'}}>Zonas</p>
      {(zonaData?.zonasOrdenadas||[]).map((zona,i) => {
        const col = zonePalette?.[zona]||C.brand;
        const deptosZona = Object.keys(byDepto).filter(k=>zonaData.deptoMap?.[k]?.zona===zona);
        const allSel  = deptosZona.length>0 && deptosZona.every(k=>selectedKeys.has(k));
        const someSel = !allSel && deptosZona.some(k=>selectedKeys.has(k));
        const cnt = deptosZona.reduce((a,k)=>a+(byDepto[k]?.soc||0),0);
        const resp = zonaData?.zonasConResp?.[zona]||'';
        return (
          <button key={zona} onClick={() => {
            const newSel = allSel
              ? (selectedDeptos||[]).filter(x=>zonaData.deptoMap?.[x.key]?.zona!==zona)
              : [...(selectedDeptos||[]), ...deptosZona.filter(k=>!selectedKeys.has(k))
                  .map(k=>({key:k,name:byDepto[k].name,prov:byDepto[k].prov,d:byDepto[k],zona}))];
            onDeptoFilter?.(newSel);
          }} style={{
            display:'block',width:'100%',textAlign:'left',padding:'8px 14px',
            border:'none',borderLeft:`4px solid ${allSel||someSel?col:'transparent'}`,
            background: allSel?`${col}22`:someSel?`${col}11`:'transparent',
            cursor:'pointer',transition:'all .12s',
          }}>
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              <div style={{width:10,height:10,borderRadius:2,background:col,flexShrink:0}}/>
              <span style={{fontSize:13,fontWeight:allSel?700:400,color:allSel?C.text:someSel?C.textMuted:C.textFaint}}>{zona}</span>
              {cnt>0&&<span style={{marginLeft:'auto',fontSize:10,color:C.textFaint,background:C.bg,borderRadius:99,padding:'1px 6px'}}>{cnt.toLocaleString()}</span>}
            </div>
            {resp&&<div style={{fontSize:10,color:C.textFaint,marginTop:1,paddingLeft:17}}>{resp}</div>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────
export default function MapaTab({data188ext, data189, selectedDeptos=[], onDeptoFilter}) {
  const [mapaData,    setMapaData]    = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError,   setDataError]   = useState(null);
  const [geojsonD,    setGeojsonD]    = useState(null);  // departamentos
  const [geojsonP,    setGeojsonP]    = useState(null);  // provincias
  const [loadingGeo,  setLoadingGeo]  = useState(true);
  const [zonaData,    setZonaData]    = useState(null);
  const [filterMode,  setFilterMode]  = useState('provincias');
  const [activeInfo,  setActiveInfo]  = useState(null);
  const [isClient,    setIsClient]    = useState(false);

  useEffect(()=>{setIsClient(true);},[]);

  // Auto-fetch Q188
  useEffect(()=>{
    fetch('/api/mapa-data')
      .then(r=>r.ok?r.json():Promise.reject(r.statusText))
      .then(({data})=>setMapaData(data))
      .catch(e=>setDataError(String(e)))
      .finally(()=>setLoadingData(false));
  },[]);

  // Fetch GeoJSON departamentos + provincias en paralelo
  useEffect(()=>{
    Promise.all([
      fetch('/deptos.geojson').then(r=>r.ok?r.json():null).catch(()=>null),
      fetch('/provincias.geojson').then(r=>r.ok?r.json():null).catch(()=>null),
    ]).then(([d,p])=>{
      if(d?.features?.length>0) setGeojsonD(d);
      if(p?.features?.length>0) setGeojsonP(p);
    }).finally(()=>setLoadingGeo(false));
  },[]);

  // Fetch zonas
  useEffect(()=>{
    fetch('/api/zonas')
      .then(r=>r.ok?r.json():null)
      .then(d=>{if(d&&!d.error)setZonaData(d);})
      .catch(()=>{});
  },[]);

  const data = (data188ext&&data188ext.length>0) ? data188ext : mapaData;
  const byDepto = useMemo(()=>buildByDepto(data),[data]);
  const selectedKeys = useMemo(()=>new Set((selectedDeptos||[]).map(d=>d.key)),[selectedDeptos]);
  const zonePalette  = useMemo(()=>buildZonePalette(zonaData?.zonasOrdenadas||[]),[zonaData]);

  const handleFeatureClick = useCallback(({key,nombre,prov,d,zona})=>{
    let newSelected = [...(selectedDeptos||[])];
    if (filterMode==='departamentos') {
      newSelected = selectedKeys.has(key)
        ? newSelected.filter(x=>x.key!==key)
        : [...newSelected,{key,name:nombre,prov,d,zona}];
    } else if (filterMode==='provincias') {
      const targetProv = zonaData?.deptoMap?.[key]?.provincia||norm(prov);
      const deptosOfProv = Object.entries(byDepto)
        .filter(([k,v])=>{
          const info=zonaData?.deptoMap?.[k];
          return info ? info.provincia===targetProv : norm(v.prov)===targetProv;
        })
        .map(([k,v])=>({key:k,name:v.name,prov:v.prov,d:v,zona:zonaData?.deptoMap?.[k]?.zona||''}));
      const allSel = deptosOfProv.every(x=>selectedKeys.has(x.key));
      if (allSel) {
        newSelected = newSelected.filter(x=>{
          const p=zonaData?.deptoMap?.[x.key]?.provincia||norm(x.prov||'');
          return p!==targetProv;
        });
      } else {
        const ex = new Set(newSelected.map(x=>x.key));
        deptosOfProv.forEach(x=>{if(!ex.has(x.key))newSelected.push(x);});
      }
    } else if (filterMode==='zonas') {
      const targetZona = zonaData?.deptoMap?.[key]?.zona||zona;
      if (!targetZona) return;
      const deptosOfZona = Object.entries(byDepto)
        .filter(([k])=>zonaData?.deptoMap?.[k]?.zona===targetZona)
        .map(([k,v])=>({key:k,name:v.name,prov:v.prov,d:v,zona:targetZona}));
      const allSel = deptosOfZona.every(x=>selectedKeys.has(x.key));
      if (allSel) {
        newSelected = newSelected.filter(x=>zonaData?.deptoMap?.[x.key]?.zona!==targetZona);
      } else {
        const ex = new Set(newSelected.map(x=>x.key));
        deptosOfZona.forEach(x=>{if(!ex.has(x.key))newSelected.push(x);});
      }
    }
    onDeptoFilter?.(newSelected);
    setActiveInfo({key,nombre,prov,d,zona:zonaData?.deptoMap?.[key]?.zona||zona||''});
  },[filterMode,selectedKeys,selectedDeptos,byDepto,zonaData,onDeptoFilter]);

  const totalSoc = selectedDeptos.length>0
    ? selectedDeptos.reduce((a,d)=>a+(d.d?.soc||0),0)
    : (data?.length||0);
  const totalDep = selectedDeptos.length>0 ? selectedDeptos.length : Object.keys(byDepto).length;
  const loading  = loadingData||loadingGeo;

  if (!isClient) return null;

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 60px)',background:C.bg,fontFamily:'system-ui,-apple-system,sans-serif'}}>

      {/* ── Barra modos ── */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:C.surface,borderBottom:`1px solid ${C.border}`,flexWrap:'wrap'}}>
        <span style={{fontSize:11,color:C.textFaint,marginRight:4,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>Ver por:</span>
        <ModeBtn label="PROVINCIAS"    active={filterMode==='provincias'}    onClick={()=>setFilterMode('provincias')}/>
        <ModeBtn label="ZONAS"         active={filterMode==='zonas'}         onClick={()=>setFilterMode('zonas')}/>
        <ModeBtn label="DEPARTAMENTOS" active={filterMode==='departamentos'} onClick={()=>setFilterMode('departamentos')}/>

        {/* Leyenda inline modos */}
        <span style={{marginLeft:12,fontSize:11,color:C.textFaint}}>
          {filterMode==='provincias'&&'Bordes blancos = límites de provincia'}
          {filterMode==='zonas'&&'Bordes de color = zona de cada departamento'}
          {filterMode==='departamentos'&&'Bordes azul claro = límites de departamento'}
        </span>

        {/* Selección activa */}
        {selectedDeptos.length>0&&(
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:10}}>
            <div style={{background:C.selBg,border:`1px solid ${C.sel}`,borderRadius:99,padding:'4px 14px',display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:7,height:7,background:C.sel,borderRadius:'50%',display:'inline-block'}}/>
              <span style={{fontSize:12,color:C.sel,fontWeight:600}}>
                {filterMode==='zonas'&&zonaData
                  ? [...new Set(selectedDeptos.map(d=>zonaData.deptoMap?.[d.key]?.zona).filter(Boolean))].join(' · ')
                  : filterMode==='provincias'
                    ? [...new Set(selectedDeptos.map(d=>d.prov||'').filter(Boolean))].slice(0,4).join(' · ')
                    : `${selectedDeptos.length} deptos`
                }
              </span>
            </div>
            <button onClick={()=>onDeptoFilter?.([])} style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.textMuted,padding:'4px 12px',cursor:'pointer',fontSize:12}}>× Limpiar</button>
          </div>
        )}

        {loading&&(
          <div style={{marginLeft:selectedDeptos.length>0?8:'auto',display:'flex',alignItems:'center',gap:6,color:C.textFaint,fontSize:12}}>
            <div style={{width:12,height:12,border:`2px solid ${C.brand}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
            {loadingData?'Cargando Q188…':'Cargando mapa…'}
          </div>
        )}
      </div>

      {/* ── Contenido ── */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

        {/* Panel izquierdo zonas */}
        {filterMode==='zonas'&&zonaData&&(
          <ZonaPanel
            zonaData={zonaData} byDepto={byDepto}
            selectedDeptos={selectedDeptos} selectedKeys={selectedKeys}
            onDeptoFilter={onDeptoFilter} zonePalette={zonePalette}
          />
        )}

        {/* Mapa */}
        <div style={{flex:1,position:'relative'}}>
          {dataError&&(
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',gap:12,alignItems:'center',justifyContent:'center',zIndex:10}}>
              <div style={{fontSize:36}}>⚠️</div>
              <p style={{color:C.danger,fontWeight:700}}>Error cargando datos del mapa</p>
              <p style={{color:C.textMuted,fontSize:13,maxWidth:320,textAlign:'center'}}>{dataError}</p>
            </div>
          )}

          {/* Hint */}
          {!loading&&!dataError&&selectedDeptos.length===0&&(
            <div style={{position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',zIndex:999,background:'rgba(15,25,35,0.75)',backdropFilter:'blur(8px)',border:`1px solid ${C.border}`,borderRadius:99,padding:'5px 16px',fontSize:12,color:C.textMuted,whiteSpace:'nowrap'}}>
              Click para {filterMode==='provincias'?'seleccionar toda la provincia':filterMode==='zonas'?'seleccionar toda la zona':'seleccionar el departamento'}
            </div>
          )}

          {/* Leyenda heatmap */}
          <div style={{position:'absolute',bottom:12,left:12,zIndex:1000,background:'rgba(15,25,35,0.88)',backdropFilter:'blur(12px)',border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 14px',minWidth:156}}>
            <p style={{margin:'0 0 8px',fontSize:11,fontWeight:700,color:C.text,letterSpacing:'0.04em'}}>SOC. BASE CLAVE</p>
            {C.heat.slice().reverse().map((col,i)=>{
              const labels=['Máxima','Muy alta','Alta','Media','Baja','Muy baja'];
              return(
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                  <div style={{width:28,height:8,borderRadius:2,background:col}}/>
                  <span style={{fontSize:10,color:C.textMuted}}>{labels[i]}</span>
                </div>
              );
            })}
            <div style={{borderTop:`1px solid ${C.border}`,marginTop:6,paddingTop:7,display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:28,height:8,borderRadius:2,background:C.sel}}/>
              <span style={{fontSize:10,color:C.sel,fontWeight:600}}>Seleccionado</span>
            </div>
          </div>

          {/* KPIs */}
          <div style={{position:'absolute',top:12,right:12,zIndex:1000,display:'flex',gap:8}}>
            {[{l:'Soc.',v:totalSoc.toLocaleString('es-AR'),c:C.brandL},{l:'Deptos',v:totalDep,c:C.positive}].map(k=>(
              <div key={k.l} style={{background:'rgba(15,25,35,0.85)',backdropFilter:'blur(8px)',border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 14px',textAlign:'center'}}>
                <div style={{fontSize:18,fontWeight:700,color:k.c}}>{k.v}</div>
                <div style={{fontSize:10,color:C.textMuted}}>{k.l}</div>
              </div>
            ))}
          </div>

          <LeafletMap
            geojsonDeptos={geojsonD}
            geojsonProvs={geojsonP}
            byDepto={byDepto}
            zonaData={zonaData}
            zonePalette={zonePalette}
            filterMode={filterMode}
            selectedKeys={selectedKeys}
            onFeatureClick={handleFeatureClick}
          />
        </div>

        {/* Panel derecho — detalle */}
        <div style={{width:260,background:C.surface,borderLeft:`1px solid ${C.border}`,overflowY:'auto',display:'flex',flexDirection:'column'}}>
          <div style={{padding:'16px 16px 12px',borderBottom:`1px solid ${C.border}`}}>
            <p style={{margin:0,fontSize:14,fontWeight:700,color:C.text}}>Detalle</p>
          </div>

          {activeInfo?(
            <div style={{padding:16,flex:1}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div>
                  <p style={{margin:0,fontWeight:700,color:C.text,fontSize:15}}>{activeInfo.nombre}</p>
                  <p style={{margin:'3px 0 0',fontSize:12,color:C.textMuted}}>{activeInfo.prov}</p>
                  {activeInfo.zona&&(
                    <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                      <div style={{width:10,height:10,borderRadius:2,background:zonePalette?.[activeInfo.zona]||C.brand}}/>
                      <p style={{margin:0,fontSize:11,color:C.brandL,fontWeight:600}}>{activeInfo.zona}</p>
                    </div>
                  )}
                </div>
                <button onClick={()=>setActiveInfo(null)} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.textMuted,cursor:'pointer',width:26,height:26,fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>×</button>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:14}}>
                {[
                  {l:'Soc.',v:activeInfo.d.soc,         c:C.brandL, bg:C.brandSub},
                  {l:'Kt cab',v:fmt(activeInfo.d.kt),   c:C.warn,   bg:C.warnSub},
                  {l:'Kv vac',v:fmt(activeInfo.d.kv),   c:C.positive,bg:C.posSub},
                ].map(({l,v,c,bg})=>(
                  <div key={l} style={{background:bg,borderRadius:8,padding:'7px 6px',textAlign:'center'}}>
                    <div style={{fontWeight:700,fontSize:15,color:c}}>{v}</div>
                    <div style={{fontSize:10,color:C.textMuted,marginTop:1}}>{l}</div>
                  </div>
                ))}
              </div>

              {activeInfo.zona&&zonaData?.zonasConResp?.[activeInfo.zona]&&(
                <div style={{background:C.bg,borderRadius:8,padding:'8px 10px',marginBottom:12,border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10,color:C.textFaint,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Responsable de zona</div>
                  <div style={{fontSize:13,color:C.text,fontWeight:600}}>{zonaData.zonasConResp[activeInfo.zona]}</div>
                </div>
              )}

              <button onClick={()=>handleFeatureClick(activeInfo)} style={{
                width:'100%',padding:'9px',
                background:selectedKeys.has(activeInfo.key)?'rgba(224,96,96,0.15)':C.brandSub,
                color:selectedKeys.has(activeInfo.key)?C.danger:C.brandL,
                border:`1px solid ${selectedKeys.has(activeInfo.key)?C.danger+'50':C.brand+'50'}`,
                borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700,
              }}>
                {selectedKeys.has(activeInfo.key)?'× Quitar del filtro':'+ Agregar al filtro'}
              </button>
            </div>
          ):(
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,gap:12}}>
              <div style={{fontSize:32,opacity:0.25}}>🗺️</div>
              <p style={{fontSize:12,color:C.textFaint,textAlign:'center',margin:0}}>Hacé click en el mapa para ver el detalle y filtrar</p>
            </div>
          )}

          {selectedDeptos.length>0&&(
            <div style={{padding:'12px 16px',borderTop:`1px solid ${C.border}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <p style={{margin:0,fontSize:11,fontWeight:600,color:C.textFaint,textTransform:'uppercase',letterSpacing:'0.06em'}}>Filtro activo ({selectedDeptos.length})</p>
                <button onClick={()=>onDeptoFilter?.([])} style={{fontSize:11,color:C.danger,background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Limpiar</button>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {selectedDeptos.slice(0,10).map(dep=>(
                  <div key={dep.key} style={{display:'flex',alignItems:'center',gap:3,background:C.selBg,border:`1px solid ${C.sel}40`,borderRadius:99,padding:'2px 9px'}}>
                    <span style={{fontSize:11,color:C.sel,fontWeight:600}}>{dep.name}</span>
                    <button onClick={()=>onDeptoFilter?.((selectedDeptos||[]).filter(x=>x.key!==dep.key))} style={{background:'none',border:'none',color:C.sel,cursor:'pointer',fontSize:13,lineHeight:1,padding:0,opacity:0.7}}>×</button>
                  </div>
                ))}
                {selectedDeptos.length>10&&<span style={{fontSize:11,color:C.textFaint}}>+{selectedDeptos.length-10} más</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .dep-tip{background:#0f1923!important;border:1px solid #2a3a4d!important;border-radius:8px!important;box-shadow:0 4px 20px rgba(0,0,0,.6)!important;padding:8px 12px!important}
        .dep-tip::before,.dep-tip::after{display:none!important}
        .leaflet-control-zoom a{background:#1a2433!important;color:#e2eaf2!important;border-color:#2a3a4d!important}
        .leaflet-control-zoom a:hover{background:#3179a7!important}
        .leaflet-control-attribution{background:rgba(15,25,35,0.7)!important;color:#4d6a82!important;font-size:10px!important}
      `}</style>
    </div>
  );
}
