'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// ─── Paleta UI ─────────────────────────────────────────────────────────
const C = {
  bg:'#0f1923',surface:'#1a2433',border:'#2a3a4d',
  brand:'#3179a7',brandL:'#4a9dcf',brandSub:'rgba(49,121,167,0.18)',
  text:'#e2eaf2',textMuted:'#8fa8c0',textFaint:'#4d6a82',
  positive:'#34c68e',posSub:'rgba(52,198,142,0.15)',
  warn:'#f0a742',warnSub:'rgba(240,167,66,0.15)',
  danger:'#e06060',sel:'#60c4f0',selBg:'rgba(96,196,240,0.22)',
  heat:['#d4e9f7','#9ac8e8','#5fa8d3','#3179a7','#1d5a87','#0d3d62'],
};

const ZONA_PAL = [
  '#f94144','#f3722c','#f9c74f','#90be6d','#43aa8b',
  '#4d908e','#277da1','#a8dadc','#e07a5f','#81b29a',
  '#e9c46a','#264653','#2a9d8f','#e76f51','#9b2226',
  '#ae2012','#bb3e03','#ca6702','#ee9b00','#94d2bd',
  '#0a9396','#005f73','#cc99bb','#e9d8a6',
];

// ─── Normalización ─────────────────────────────────────────────────────
function norm(name) {
  // Separar CamelCase con letras Unicode (ej: "QuemúQuemú" → "Quemú Quemú", "LaPampa" → "La Pampa")
  let s = String(name||'').replace(/(\p{Ll})(\p{Lu})/gu,'$1 $2');
  return s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\./g,' ')
    .replace(/\bGRAL\b/g,'GENERAL').replace(/\bCNEL\b/g,'CORONEL')
    .replace(/\bSTA\b/g,'SANTA').replace(/\bSTO\b/g,'SANTO')
    .replace(/\bTTE\b/g,'TENIENTE').replace(/\bPTE\b/g,'PRESIDENTE')
    // Reparar artículos fusionados en CamelCase GADM:
    // "VEINTICINCODE MAYO" → "VEINTICINCO DE MAYO"
    // "GENERALDELASHOCES" → "GENERAL DEL LAS HACES" etc.
    .replace(/(\w+?)DEL\b/g,'$1 DEL')
    .replace(/(\w+?)DE\b/g,'$1 DE')
    .replace(/(\w+?)LAS\b/g,'$1 LAS')
    .replace(/(\w+?)LOS\b/g,'$1 LOS')
    .replace(/\s+/g,' ').trim();
}

// ─── Abreviaturas de provincia en Q188 → nombre completo ───────────────
const PROV_ABBR = {
  'BUE':'BUENOS AIRES','BSAS':'BUENOS AIRES','PBA':'BUENOS AIRES',
  'CAT':'CATAMARCA','CHA':'CHACO','CHU':'CHUBUT',
  'CBA':'CORDOBA','COR':'CORRIENTES',
  'ER':'ENTRE RIOS','RIOS':'ENTRE RIOS',
  'FOR':'FORMOSA','JUJ':'JUJUY',
  'LPA':'LA PAMPA','PAMPA':'LA PAMPA',
  'LRI':'LA RIOJA','RIOJA':'LA RIOJA',
  'MZA':'MENDOZA','MIS':'MISIONES',
  'NEU':'NEUQUEN','RNG':'RIO NEGRO','NEGRO':'RIO NEGRO',
  'SAL':'SALTA','SJU':'SAN JUAN','SLU':'SAN LUIS',
  'SCR':'SANTA CRUZ','SF':'SANTA FE','SFE':'SANTA FE',
  'SDE':'SANTIAGO DEL ESTERO','TDF':'TIERRA DEL FUEGO','TUC':'TUCUMAN',
  'CABA':'CIUDAD AUTONOMA DE BUENOS AIRES',
  'CAP':'CIUDAD AUTONOMA DE BUENOS AIRES',
};
function expandProv(raw) {
  const u = String(raw||'').trim().toUpperCase();
  return PROV_ABBR[u] || u;
}

// ─── Color calor ───────────────────────────────────────────────────────
function hCol(soc,max) {
  if (!soc||max===0) return '#14222f';
  const t = Math.pow(soc/max,0.45);
  return C.heat[Math.min(C.heat.length-1,Math.floor(t*C.heat.length))];
}

// ─── Paleta de calor por zona ──────────────────────────────────────────
function _hue2rgb(p,q,t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;}
function _hexToHsl(hex){
  const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0,l=(mx+mn)/2;
  if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=((g-b)/d+(g<b?6:0))/6;else if(mx===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}
  return[h*360,s*100,l*100];
}
function _hslToHex(h,s,l){
  h/=360;s/=100;l/=100;let r,g,b;
  if(s===0){r=g=b=l;}else{const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;r=_hue2rgb(p,q,h+1/3);g=_hue2rgb(p,q,h);b=_hue2rgb(p,q,h-1/3);}
  return'#'+[r,g,b].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
}
// Genera 6 pasos de paleta oscuro→claro en el matiz de la zona
function makeZoneHeatPalette(baseHex,steps=6){
  if(!baseHex) return C.heat;
  try{
    const[h,s]=_hexToHsl(baseHex);
    return Array.from({length:steps},(_,i)=>{
      const t=i/(steps-1);
      const lightness=12+t*62;       // 12% (oscuro) → 74% (claro brillante)
      const saturation=10+t*Math.min(s,90); // poco saturado → saturado
      return _hslToHex(h,Math.min(100,saturation),Math.min(88,lightness));
    });
  }catch(e){return C.heat;}
}
// Cache de paletas por zona (evita recomputar en cada feature)
const _zoneHeatCache={};
function getZHeat(zona,col){
  if(!zona||!col) return C.heat;
  if(!_zoneHeatCache[zona]) _zoneHeatCache[zona]=makeZoneHeatPalette(col);
  return _zoneHeatCache[zona];
}
// Aplica calor usando paleta de zona
function hColZone(soc,max,pal){
  if(!soc||max===0) return '#14222f';
  const t=Math.pow(soc/max,0.45);
  return pal[Math.min(pal.length-1,Math.floor(t*pal.length))];
}

// Usa colores del Sheet (col M) cuando existen, sino asigna secuencialmente de ZONA_PAL
function buildZonePalette(zonasOrdenadas=[], zonaColors={}) {
  const p={};
  let fallbackIdx=0;
  zonasOrdenadas.forEach(z=>{
    if(zonaColors[z]) {
      p[z]=zonaColors[z]; // color real del Sheet
    } else {
      p[z]=ZONA_PAL[fallbackIdx%ZONA_PAL.length]; // fallback secuencial
      fallbackIdx++;
    }
  });
  return p;
}

// ─── Construir datos por depto ─────────────────────────────────────────
// Q202: pre-agregado por depto — provincia (completa), partido_domicilio_est,
//       total_establecimientos, total_bovinos, total_vacas (1 fila por depto)
// Compatible también con Q188 como fallback (1 fila por establecimiento)
function buildByDepto(data, bcLookup, bcDeptOnly) {
  const m={};
  (data||[]).forEach(r=>{
    // Q202 usa partido_domicilio_est; Q188 usa partido_establecimiento_senasa
    const rawName = String(r.partido_domicilio_est || r.partido_establecimiento_senasa || r.partido_fiscal_senasa || '').trim();
    const rawProv = String(r.provincia             || r.prov_establecimiento_senasa    || r.prov_fiscal_senasa    || '').trim();
    if (!rawName) return;

    // Q202 ya trae totales; Q188 tiene 1 fila por establecimiento
    const soc = r.total_establecimientos != null ? parseFloat(r.total_establecimientos)||0 : 1;
    const kt  = parseFloat(r.total_bovinos)||0;
    const kv  = parseFloat(r.total_vacas)  ||0;

    // Q202: provincia ya es completa ("BUENOS AIRES"). Q188: abreviatura ("BUE") → expandir
    const fullProv = r.provincia ? rawProv : expandProv(rawProv);

    let key;
    if (bcLookup) {
      const normKey = norm(fullProv)+'|'+norm(rawName);
      const id = bcLookup[normKey] || (bcDeptOnly && bcDeptOnly[norm(rawName)]);
      key = id ? String(id) : norm(fullProv)+'|'+norm(rawName);
    } else {
      // Fallback: prov+dept (garantiza unicidad entre provincias)
      key = norm(fullProv)+'|'+norm(rawName);
    }

    if (!m[key]) m[key]={soc:0,kt:0,kv:0,name:rawName,prov:rawProv};
    m[key].soc += soc;
    m[key].kt  += kt;
    m[key].kv  += kv;
  });
  return m;
}

// ─── Centroide simple de feature GeoJSON ──────────────────────────────
function computeCentroid(feature) {
  let sumLat=0,sumLng=0,cnt=0;
  function scan(c) {
    if (typeof c[0]==='number'){sumLng+=c[0];sumLat+=c[1];cnt++;}
    else c.forEach(scan);
  }
  try{scan(feature.geometry.coordinates);}catch{}
  return cnt>0?{lat:sumLat/cnt,lng:sumLng/cnt}:null;
}

// ─── Nearest-neighbor: GADM centroid → DEPTO_ID ───────────────────────
function findNearestId(centroid, mergeCoords) {
  if (!centroid||!mergeCoords?.length) return null;
  let best=null,bestD=Infinity;
  for (const m of mergeCoords) {
    const d=(centroid.lat-m.lat)**2+(centroid.lng-m.lng)**2;
    if (d<bestD){bestD=d;best=m.id;}
  }
  return best;
}

// Construir mapa GID_2 → DEPTO_ID por coordenadas (una sola vez)
function buildGadmToId(geojson, mergeCoords) {
  const map={};
  if (!geojson||!mergeCoords?.length) return map;
  for (const f of geojson.features) {
    const gid=f.properties?.GID_2||f.properties?.gid;
    if (!gid) continue;
    const c=computeCentroid(f);
    const id=findNearestId(c,mergeCoords);
    if (id) map[String(gid)]=String(id);
  }
  return map;
}

// ─── Resolver key de un feature ────────────────────────────────────────
// 1. nameToId (prov+dept) → DEPTO_ID        — más preciso, el Merge sheet
// 2. norm(prov)|norm(nombre)                 — siempre incluye provincia
//    Nunca se cae a dept-solo para evitar colisiones entre provincias
//    (ej. "Veinticinco de Mayo" en BS.AS. ≠ San Juan)
function getFeatureKey(f, gadmToId, nameToId, gadmRawToNorm) {
  const nombre=String(f.properties?.NAME_2||f.properties?.nombre||'');
  const prov  =String(f.properties?.NAME_1||f.properties?.provincia_nombre||'');
  const gid   =f.properties?.GID_2||f.properties?.gid||'';

  // 0. PRIORIDAD MÁS ALTA: GID_2 → DEPTO_ID via centroide geográfico
  //    Completamente independiente de nombres, resuelve todos los casos de CamelCase
  if(gadmToId && gid && gadmToId[gid]) return gadmToId[gid];

  // Traducir nombre GADM crudo → nombre normalizado usando col D del GADM-Match sheet
  const cleanNombre=(gadmRawToNorm&&gadmRawToNorm[nombre])||nombre;

  // 1. PRIMARIO — prov+cleanDept contra nameToId del Merge sheet → DEPTO_ID
  if(nameToId){
    const idKey=norm(prov)+'|'+norm(cleanNombre);
    if(nameToId[idKey]) return String(nameToId[idKey]);
    const rawKey=norm(prov)+'|'+norm(nombre);
    if(rawKey!==idKey&&nameToId[rawKey]) return String(nameToId[rawKey]);
  }

  // 2. FALLBACK — prov+nombre limpio normalizado (usa el nombre limpio si está disponible)
  return norm(prov)+'|'+norm(cleanNombre);
}

const fmt=n=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1000?(n/1000).toFixed(1)+'K':String(Math.round(n));

function ModeBtn({label,active,onClick}) {
  return (
    <button onClick={onClick} style={{
      padding:'7px 18px',borderRadius:8,
      border:`1px solid ${active?C.brand:C.border}`,
      background:active?C.brandSub:'transparent',
      color:active?C.brandL:C.textMuted,
      fontWeight:active?700:400,fontSize:13,cursor:'pointer',transition:'all .15s',
    }}>{label}</button>
  );
}

// ─── Componente Leaflet ────────────────────────────────────────────────
function LeafletMap({
  geojsonDeptos,geojsonProvs,
  byDepto,zonaData,gadmToId,zonePalette,
  filterMode,selectedKeys,onFeatureClick,
  nameToId, normDeptToId, gadmRawToNorm,
}) {
  // fKey: resuelve key para un feature GADM
  // Prioridad: 1) gadmRawToNorm (col D limpio) 2) nameToId (prov+dept) 3) norm(nombre)
  const fKey = useCallback((f)=>getFeatureKey(f,gadmToId,nameToId,gadmRawToNorm),[gadmToId,nameToId,gadmRawToNorm]);

  const cRef   = useRef(null);
  const mapR   = useRef(null);
  const LRef   = useRef(null);
  const lyrHeatR = useRef(null);
  const lyrProvR = useRef(null);
  const lyrZonaR = useRef(null);
  const lyrDeptR = useRef(null);

  const maxSoc = useMemo(()=>Math.max(...Object.values(byDepto).map(d=>d.soc),1),[byDepto]);

  // Resolver zona por key (proba numeric ID → deptoMap por nombre)
  const getZona = useCallback((key,nombre)=>{
    const numId=Number(key);
    // Path 1: clave numérica → idToZona (del Roster-Regiones col C)
    if(numId && zonaData?.idToZona?.[numId]) return zonaData.idToZona[numId];
    // Path 2: clave exacta en deptoMap (ej. "CARLOS TEJEDOR")
    if(zonaData?.deptoMap?.[key]?.zona) return zonaData.deptoMap[key].zona;
    // Path 2b: extraer parte dept de clave "PROV|DEPT" (ej. "BUENOS AIRES|CARLOS TEJEDOR" → "CARLOS TEJEDOR")
    if(key?.includes('|')){
      const deptPart=key.split('|').slice(1).join('|');
      if(zonaData?.deptoMap?.[deptPart]?.zona) return zonaData.deptoMap[deptPart].zona;
    }
    // Path 3: nombre GADM raw normalizado con norm() para manejar CamelCase
    // ej. "CarlosTejedor" → norm() → "CARLOS TEJEDOR" → deptoMap lookup
    const normNombre=nombre?norm(nombre):'';
    return (normNombre&&zonaData?.deptoMap?.[normNombre]?.zona)||'';
  },[zonaData]);

  // ── Init map ───────────────────────────────────────────────────────
  useEffect(()=>{
    async function init(){
      if(!cRef.current||mapR.current) return;
      const L=(await import('leaflet')).default;
      LRef.current=L;
      await import('leaflet/dist/leaflet.css');
      const map=L.map(cRef.current,{center:[-37.5,-64.5],zoom:4,zoomControl:false,preferCanvas:false});
      mapR.current=map;
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
        {attribution:'&copy; CARTO',subdomains:'abcd',maxZoom:19}).addTo(map);
      L.control.zoom({position:'topright'}).addTo(map);
    }
    init();
    return()=>{if(mapR.current){mapR.current.remove();mapR.current=null;}};
  },[]);

  // ── Capa HEATMAP ──────────────────────────────────────────────────
  useEffect(()=>{
    const map=mapR.current,L=LRef.current;
    if(!map||!L||!geojsonDeptos) return;
    if(lyrHeatR.current){lyrHeatR.current.remove();lyrHeatR.current=null;}

    const layer=L.geoJSON(geojsonDeptos,{
      pointToLayer:(f,ll)=>{
        const key=fKey(f);
        const d=byDepto[key];const soc=d?.soc||0;const sel=selectedKeys.has(key);
        const nombre=f.properties?.NAME_2||f.properties?.nombre||'';
        const zona=getZona(key,nombre);
        // Color: amarillo si sel, color sólido zona (siempre opaco), o calor azul
        const inZona = filterMode === 'zonas' && zona && zonePalette?.[zona];
        const fillColor = sel
          ? '#facc15'
          : inZona
            ? zonePalette[zona]
            : filterMode === 'zonas'
              ? '#2a3040' // sin zona → gris oscuro sutil (no negro puro)
              : hColZone(soc, maxSoc, C.heat);
        const opacity = sel ? 0.95 : inZona ? 0.85 : (soc > 0 ? 0.82 : 0.15);
        const r=soc>0?Math.max(4,Math.min(30,4+Math.sqrt(soc/maxSoc)*30)):3;
        return L.circleMarker(ll,{radius:r,fillColor,color:sel?'#ca8a04':'rgba(0,0,0,0.2)',weight:sel?1.5:0.4,fillOpacity:opacity});
      },
      style:(f)=>{
        const key=fKey(f);
        const d=byDepto[key];const soc=d?.soc||0;const sel=selectedKeys.has(key);
        const nombre=f.properties?.NAME_2||f.properties?.nombre||'';
        const zona=getZona(key,nombre);
        // Color: amarillo si sel, color sólido zona (siempre opaco), o calor azul
        const inZona2 = filterMode === 'zonas' && zona && zonePalette?.[zona];
        const fillColor2 = sel
          ? '#facc15'
          : inZona2
            ? zonePalette[zona]
            : filterMode === 'zonas'
              ? '#2a3040' // sin zona → gris oscuro sutil
              : hColZone(soc, maxSoc, C.heat);
        const opacity2 = sel ? 0.95 : inZona2 ? 0.85 : (soc > 0 ? 0.82 : 0.15);
        return{fillColor:fillColor2,weight:sel?2:0,color:sel?'#ca8a04':'transparent',fillOpacity:opacity2};
      },
      onEachFeature:(f,lyr)=>{
        const nombre=f.properties?.NAME_2||f.properties?.nombre||'';
        const prov  =f.properties?.NAME_1||f.properties?.provincia_nombre||'';
        const key   =fKey(f);
        const d     =byDepto[key];const soc=d?.soc||0;const kt=d?.kt||0;
        const zona  =getZona(key,nombre);
        const zCol  =zona&&zonePalette?.[zona]?`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${zonePalette[zona]};margin-right:4px"></span>${zona}`:'';

        lyr.on({
          click:()=>onFeatureClick({key,nombre:d?.name||nombre,prov:d?.prov||prov,d:d||{soc:0,kt:0,kv:0},zona}),
          mouseover:e=>{e.target.setStyle({fillOpacity:1});e.target.bringToFront();},
          mouseout: e=>{layer.resetStyle(e.target);e.target.closeTooltip();},
        });
        lyr.bindTooltip(
          `<div style="font-family:system-ui;padding:2px 4px">
            <div style="font-weight:700;font-size:13px;color:${C.text}">${d?.name||nombre}</div>
            <div style="font-size:11px;color:${C.textMuted};margin-bottom:3px">${prov}</div>
            ${zona?`<div style="font-size:10px;color:${C.textFaint};margin-bottom:3px">${zCol}</div>`:''}
            ${soc>0
              ?`<div style="font-size:12px;color:${C.sel}"><strong>${soc.toLocaleString('es-AR')}</strong> estab · <strong>${fmt(kt)}</strong> bov</div>`
              :`<div style="font-size:11px;color:${C.textFaint};font-style:italic">Sin datos</div>`
            }
           </div>`,
          {sticky:false,direction:'top',className:'dep-tip',offset:[0,-8]}
        );
      },
    }).addTo(map);
    lyrHeatR.current=layer;

    // Cerrar todos los tooltips al mover el mapa (drag)
    const closeTips = () => layer.closeTooltip();
    map.on('movestart', closeTips);
    return () => map.off('movestart', closeTips);
  },[geojsonDeptos,byDepto,zonaData,zonePalette,filterMode,selectedKeys,onFeatureClick,maxSoc,fKey,getZona]);

  // ── Capa bordes DEPARTAMENTOS ─────────────────────────────────────
  useEffect(()=>{
    const map=mapR.current,L=LRef.current;
    if(!map||!L) return;
    if(lyrDeptR.current){lyrDeptR.current.remove();lyrDeptR.current=null;}
    if(filterMode!=='departamentos'||!geojsonDeptos) return;
    const layer=L.geoJSON(geojsonDeptos,{
      pointToLayer:()=>null,
      style:(f)=>{
        const key=fKey(f);const sel=selectedKeys.has(key);
        return{fillColor:'transparent',fillOpacity:0,color:sel?'#fff':'#7a9ab5',weight:sel?2:0.6};
      },
      interactive:false,
    }).addTo(map);
    lyrDeptR.current=layer;
  },[geojsonDeptos,filterMode,selectedKeys,fKey]);

  // ── Capa overlay PROVINCIAS ──────────────────────────────────────
  useEffect(()=>{
    const map=mapR.current,L=LRef.current;
    if(!map||!L) return;
    if(lyrProvR.current){lyrProvR.current.remove();lyrProvR.current=null;}
    if(filterMode==='provincias'){
      const sublayers=[];
      if(geojsonDeptos){
        sublayers.push(L.geoJSON(geojsonDeptos,{
          pointToLayer:()=>null,
          style:()=>({fillColor:'transparent',fillOpacity:0,color:'#7a9ab5',weight:0.4}),
          interactive:false,
        }).addTo(map));
      }
      if(geojsonProvs){
        sublayers.push(L.geoJSON(geojsonProvs,{
          pointToLayer:()=>null,
          style:()=>({fillColor:'transparent',fillOpacity:0,color:'#ffffff',weight:3,opacity:0.9}),
          interactive:false,
        }).addTo(map));
      }
      if(sublayers.length>0) lyrProvR.current={remove:()=>sublayers.forEach(l=>l.remove())};
    }
  },[geojsonDeptos,geojsonProvs,filterMode,selectedKeys]);

  // ── Capa overlay ZONAS ────────────────────────────────────────────
  useEffect(()=>{
    const map=mapR.current,L=LRef.current;
    if(!map||!L) return;
    if(lyrZonaR.current){lyrZonaR.current.remove();lyrZonaR.current=null;}
    if(filterMode!=='zonas'||!geojsonDeptos||!zonaData||!zonePalette) return;
    const layer=L.geoJSON(geojsonDeptos,{
      pointToLayer:()=>null,
      style:(f)=>{
        const key=fKey(f);
        const nombre=f.properties?.NAME_2||f.properties?.nombre||'';
        const zona=getZona(key,nombre);
        const col=(zona&&zonePalette[zona])?zonePalette[zona]:'#3a4a5a';
        const sel=selectedKeys.has(key);
        return{fillColor:'transparent',fillOpacity:0,color:sel?'#fff':col,weight:sel?3:1.8,opacity:sel?1:0.85};
      },
      interactive:false,
    }).addTo(map);
    lyrZonaR.current=layer;
  },[geojsonDeptos,filterMode,zonaData,zonePalette,selectedKeys,fKey,getZona]);

  return <div ref={cRef} style={{height:'100%',width:'100%'}}/>;
}

// ─── Panel de zonas ────────────────────────────────────────────────────
function ZonaPanel({zonaData,byDepto,selectedDeptos,selectedKeys,onDeptoFilter,zonePalette}) {
  return (
    <div style={{width:230,background:C.surface,borderRight:`1px solid ${C.border}`,overflowY:'auto',padding:'12px 0'}}>
      <p style={{padding:'0 14px',margin:'0 0 10px',fontSize:11,fontWeight:700,color:C.textFaint,textTransform:'uppercase',letterSpacing:'0.08em'}}>
        Zonas ({(zonaData?.zonasOrdenadas||[]).length})
      </p>
      {(zonaData?.zonasOrdenadas||[]).map(zona=>{
        const col=zonePalette?.[zona]||C.brand;
        // Buscar deptos por nombre (zonaData.deptoMap clave = nombre en mayúsculas)
        // Y por ID numérico en idToInfo
        const deptosZona=Object.keys(byDepto).filter(k=>{
          const numId=Number(k);
          if(numId&&zonaData?.idToZona?.[numId]) return zonaData.idToZona[numId]===zona;
          return zonaData?.deptoMap?.[k]?.zona===zona;
        });
        const allSel=deptosZona.length>0&&deptosZona.every(k=>selectedKeys.has(k));
        const someSel=!allSel&&deptosZona.some(k=>selectedKeys.has(k));
        const cnt=deptosZona.reduce((a,k)=>a+(byDepto[k]?.soc||0),0);
        const resp=zonaData?.zonasConResp?.[zona]||'';
        const base=zonaData?.zonaBase?.[zona]||'';
        return (
          <button key={zona} onClick={()=>{
            const newSel=allSel
              ?(selectedDeptos||[]).filter(x=>{
                  const ni=Number(x.key);
                  const z=ni?zonaData?.idToZona?.[ni]:zonaData?.deptoMap?.[x.key]?.zona;
                  return z!==zona;
                })
              :[...(selectedDeptos||[]),...deptosZona.filter(k=>!selectedKeys.has(k))
                  .map(k=>({key:k,name:byDepto[k].name,prov:byDepto[k].prov,d:byDepto[k],zona}))];
            onDeptoFilter?.(newSel);
          }} style={{
            display:'block',width:'100%',textAlign:'left',padding:'8px 14px',
            border:'none',borderLeft:`4px solid ${allSel||someSel?col:'transparent'}`,
            background:allSel?`${col}22`:someSel?`${col}11`:'transparent',
            cursor:'pointer',transition:'all .12s',
          }}>
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              <div style={{width:10,height:10,borderRadius:2,background:col,flexShrink:0}}/>
              <span style={{fontSize:12,fontWeight:allSel?700:400,color:allSel?C.text:someSel?C.textMuted:C.textFaint,lineHeight:1.3}}>{zona}</span>
              {cnt>0&&<span style={{marginLeft:'auto',fontSize:10,color:C.textFaint,background:C.bg,borderRadius:99,padding:'1px 6px',flexShrink:0}}>{cnt.toLocaleString()}</span>}
            </div>
            {resp&&<div style={{fontSize:10,color:C.textFaint,marginTop:2,paddingLeft:17}}>{resp}</div>}
            {base&&<div style={{fontSize:9,color:C.textFaint,marginTop:1,paddingLeft:17,opacity:0.7}}>{base}</div>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────
export default function MapaTab({data188ext,data189,selectedDeptos=[],onDeptoFilter}) {
  const [mapaData,    setMapaData]    = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError,   setDataError]   = useState(null);
  const [geojsonD,    setGeojsonD]    = useState(null);
  const [geojsonP,    setGeojsonP]    = useState(null);
  const [loadingGeo,  setLoadingGeo]  = useState(true);
  const [zonaData,    setZonaData]    = useState(null);
  const [deptoIds,    setDeptoIds]    = useState(null);
  const [gadmToId,    setGadmToId]    = useState({}); // GID_2 → DEPTO_ID_str
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

  // Fetch GeoJSON
  useEffect(()=>{
    Promise.all([
      fetch('/deptos.geojson').then(r=>r.ok?r.json():null).catch(()=>null),
      fetch('/provincias.geojson').then(r=>r.ok?r.json():null).catch(()=>null),
    ]).then(([d,p])=>{
      if(d?.features?.length>0) setGeojsonD(d);
      if(p?.features?.length>0) setGeojsonP(p);
    }).finally(()=>setLoadingGeo(false));
  },[]);

  // Fetch zonas + depto-ids
  useEffect(()=>{
    Promise.all([
      fetch('/api/zonas').then(r=>r.ok?r.json():null).catch(()=>null),
      fetch('/api/depto-ids').then(r=>r.ok?r.json():null).catch(()=>null),
    ]).then(([z,ids])=>{
      if(z&&!z.error)   setZonaData(z);
      if(ids&&!ids.error) setDeptoIds(ids);
    });
  },[]);

  // Construir gadmToId por coordenadas cuando ambos datasets están listos
  useEffect(()=>{
    if(!geojsonD||!deptoIds?.mergeCoords?.length) return;
    // Ejecutar en next tick para no bloquear el render
    const id=setTimeout(()=>{
      const map=buildGadmToId(geojsonD,deptoIds.mergeCoords);
      setGadmToId(map);
      console.log(`[gadmToId] ${Object.keys(map).length} features mapeados por coordenadas`);
    },0);
    return()=>clearTimeout(id);
  },[geojsonD,deptoIds]);

  const data    = (data188ext&&data188ext.length>0)?data188ext:mapaData;
  const byDepto = useMemo(()=>buildByDepto(data,deptoIds?.bcLookup,deptoIds?.bcDeptOnly),[data,deptoIds]);
  const selectedKeys = useMemo(()=>{
    const s=new Set();
    for(const d of (selectedDeptos||[])){
      if(d.key) s.add(d.key);
      // También agregar norm(prov)|norm(name) para que selecciones del sidebar
      // siempre coincidan con las claves que genera fKey() del mapa
      const nk=norm(d.prov)+'|'+norm(d.name);
      if(nk!='|') s.add(nk);
    }
    return s;
  },[selectedDeptos]);
  const zonePalette  = useMemo(()=>buildZonePalette(zonaData?.zonasOrdenadas||[], zonaData?.zonaColors||{}),[zonaData]);

  // Resolver zona para una key (ID numerico o nombre)
  const getZonaForKey = useCallback((key,zona='')=>{
    if(zona) return zona;
    const numId=Number(key);
    if(numId&&zonaData?.idToZona?.[numId]) return zonaData.idToZona[numId];
    if(zonaData?.deptoMap?.[key]?.zona) return zonaData.deptoMap[key].zona;
    if(key?.includes('|')){const deptPart=key.split('|').slice(1).join('|');if(zonaData?.deptoMap?.[deptPart]?.zona) return zonaData.deptoMap[deptPart].zona;}
    return '';
  },[zonaData]);

  const handleFeatureClick = useCallback(({key,nombre,prov,d,zona})=>{
    const resolvedZona = getZonaForKey(key,zona);
    let newSelected=[...(selectedDeptos||[])];

    if(filterMode==='departamentos'){
      newSelected=selectedKeys.has(key)
        ?newSelected.filter(x=>x.key!==key)
        :[...newSelected,{key,name:nombre,prov,d,zona:resolvedZona}];
    } else if(filterMode==='provincias'){
      // Resolución de provincia por ID si disponible
      const numId=Number(key);
      const targetProv=(numId&&deptoIds?.idToInfo?.[numId]?.prov)
        ||zonaData?.idToInfo?.[numId]?.provincia
        ||zonaData?.deptoMap?.[key]?.provincia||norm(prov);
      const deptosOfProv=Object.entries(byDepto)
        .filter(([k,v])=>{
          const ni=Number(k);
          const kProv=ni
            ?(deptoIds?.idToInfo?.[ni]?.prov||zonaData?.idToInfo?.[ni]?.provincia)
            :(zonaData?.deptoMap?.[k]?.provincia||norm(v.prov||''));
          return kProv===targetProv;
        })
        .map(([k,v])=>({key:k,name:v.name,prov:v.prov,d:v,zona:getZonaForKey(k)}));
      const allSel=deptosOfProv.every(x=>selectedKeys.has(x.key));
      if(allSel){
        newSelected=newSelected.filter(x=>{
          const ni=Number(x.key);
          const p=ni
            ?(deptoIds?.idToInfo?.[ni]?.prov||zonaData?.idToInfo?.[ni]?.provincia)
            :(zonaData?.deptoMap?.[x.key]?.provincia||norm(x.prov||''));
          return p!==targetProv;
        });
      } else {
        const ex=new Set(newSelected.map(x=>x.key));
        deptosOfProv.forEach(x=>{if(!ex.has(x.key))newSelected.push(x);});
      }
    } else if(filterMode==='zonas'){
      const targetZona=resolvedZona;
      if(!targetZona) return;
      const deptosOfZona=Object.entries(byDepto)
        .filter(([k])=>{
          const ni=Number(k);
          return ni
            ?(zonaData?.idToZona?.[ni]===targetZona)
            :(zonaData?.deptoMap?.[k]?.zona===targetZona);
        })
        .map(([k,v])=>({key:k,name:v.name,prov:v.prov,d:v,zona:targetZona}));
      const allSel=deptosOfZona.every(x=>selectedKeys.has(x.key));
      if(allSel){
        newSelected=newSelected.filter(x=>{
          const ni=Number(x.key);
          return ni?(zonaData?.idToZona?.[ni]!==targetZona):(zonaData?.deptoMap?.[x.key]?.zona!==targetZona);
        });
      } else {
        const ex=new Set(newSelected.map(x=>x.key));
        deptosOfZona.forEach(x=>{if(!ex.has(x.key))newSelected.push(x);});
      }
    }
    onDeptoFilter?.(newSelected);
    setActiveInfo({key,nombre,prov,d,zona:resolvedZona});
  },[filterMode,selectedKeys,selectedDeptos,byDepto,zonaData,deptoIds,onDeptoFilter,getZonaForKey]);

  const totalSoc=selectedDeptos.length>0
    ?selectedDeptos.reduce((a,d)=>a+(d.d?.soc||0),0)
    :(data?.length||0);
  const totalDep=selectedDeptos.length>0?selectedDeptos.length:Object.keys(byDepto).length;
  const loading=loadingData||loadingGeo;

  if(!isClient) return null;

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 60px)',background:C.bg,fontFamily:'system-ui,-apple-system,sans-serif'}}>

      {/* Barra de modos */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:C.surface,borderBottom:`1px solid ${C.border}`,flexWrap:'wrap'}}>
        <span style={{fontSize:11,color:C.textFaint,marginRight:4,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>Ver por:</span>
        <ModeBtn label="PROVINCIAS"    active={filterMode==='provincias'}    onClick={()=>setFilterMode('provincias')}/>
        <ModeBtn label="ZONAS"         active={filterMode==='zonas'}         onClick={()=>setFilterMode('zonas')}/>
        <ModeBtn label="DEPARTAMENTOS" active={filterMode==='departamentos'} onClick={()=>setFilterMode('departamentos')}/>

        <span style={{marginLeft:12,fontSize:11,color:C.textFaint}}>
          {filterMode==='provincias'&&'Bordes blancos = límites de provincia'}
          {filterMode==='zonas'&&'Bordes de color = zona de cada departamento'}
          {filterMode==='departamentos'&&'Bordes azul claro = límites de departamento'}
        </span>

        {selectedDeptos.length>0&&(
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:10}}>
            <div style={{background:C.selBg,border:`1px solid ${C.sel}`,borderRadius:99,padding:'4px 14px',display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:7,height:7,background:C.sel,borderRadius:'50%',display:'inline-block'}}/>
              <span style={{fontSize:12,color:C.sel,fontWeight:600}}>
                {filterMode==='zonas'&&zonaData
                  ?[...new Set(selectedDeptos.map(d=>{const ni=Number(d.key);return ni?zonaData.idToZona?.[ni]:zonaData.deptoMap?.[d.key]?.zona;}).filter(Boolean))].join(' · ')
                  :filterMode==='provincias'
                    ?[...new Set(selectedDeptos.map(d=>d.prov||'').filter(Boolean))].slice(0,4).join(' · ')
                    :`${selectedDeptos.length} deptos`
                }
              </span>
            </div>
            <button onClick={()=>onDeptoFilter?.([])} style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.textMuted,padding:'4px 12px',cursor:'pointer',fontSize:12}}>× Limpiar</button>
          </div>
        )}

        {loading&&(
          <div style={{marginLeft:selectedDeptos.length>0?8:'auto',display:'flex',alignItems:'center',gap:6,color:C.textFaint,fontSize:12}}>
            <div style={{width:12,height:12,border:`2px solid ${C.brand}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
            {loadingData?'Cargando datos…':'Cargando mapa…'}
          </div>
        )}
      </div>

      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

        {filterMode==='zonas'&&zonaData&&(
          <ZonaPanel
            zonaData={zonaData} byDepto={byDepto}
            selectedDeptos={selectedDeptos} selectedKeys={selectedKeys}
            onDeptoFilter={onDeptoFilter} zonePalette={zonePalette}
          />
        )}

        <div style={{flex:1,position:'relative'}}>
          {dataError&&(
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',gap:12,alignItems:'center',justifyContent:'center',zIndex:10}}>
              <div style={{fontSize:36}}>⚠️</div>
              <p style={{color:C.danger,fontWeight:700}}>Error cargando datos del mapa</p>
              <p style={{color:C.textMuted,fontSize:13,maxWidth:320,textAlign:'center'}}>{dataError}</p>
            </div>
          )}

          {!loading&&!dataError&&selectedDeptos.length===0&&(
            <div style={{position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',zIndex:999,background:'rgba(15,25,35,0.75)',backdropFilter:'blur(8px)',border:`1px solid ${C.border}`,borderRadius:99,padding:'5px 16px',fontSize:12,color:C.textMuted,whiteSpace:'nowrap'}}>
              Click para {filterMode==='provincias'?'seleccionar toda la provincia':filterMode==='zonas'?'seleccionar toda la zona':'seleccionar el departamento'}
            </div>
          )}

          {/* Leyenda */}
          <div style={{position:'absolute',bottom:12,left:12,zIndex:1000,background:'rgba(15,25,35,0.88)',backdropFilter:'blur(12px)',border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 14px',minWidth:156}}>
            <p style={{margin:'0 0 8px',fontSize:11,fontWeight:700,color:C.text,letterSpacing:'0.04em'}}>ESTABLECIMIENTOS SENASA</p>
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
            {[{
              l:'Estab.',
              v: selectedDeptos.length>0
                  ? selectedDeptos.reduce((a,d)=>a+(d.d?.soc||0),0).toLocaleString('es-AR')
                  : Object.values(byDepto).reduce((a,d)=>a+(d.soc||0),0).toLocaleString('es-AR'),
              c:C.brandL
            },{
              l:'Deptos',
              v: selectedDeptos.length>0 ? selectedDeptos.length : Object.keys(byDepto).length,
              c:C.positive
            }].map(k=>(
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
            gadmToId={gadmToId}
            zonePalette={zonePalette}
            filterMode={filterMode}
            selectedKeys={selectedKeys}
            onFeatureClick={handleFeatureClick}
            nameToId={deptoIds?.nameToId}
            normDeptToId={deptoIds?.bcDeptOnly}
            gadmRawToNorm={deptoIds?.gadmRawToNorm}
          />
        </div>

        {/* Panel detalle */}
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
                  {l:'Estab.',  v:activeInfo.d.soc.toLocaleString('es-AR'), c:C.brandL,  bg:C.brandSub},
                  {l:'Bovinos', v:fmt(activeInfo.d.kt), c:C.warn,    bg:C.warnSub},
                  {l:'Vacas',   v:fmt(activeInfo.d.kv), c:C.positive,bg:C.posSub},
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
