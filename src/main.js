// --- Global Constants & State ---
const CFG_ACS = [];
let TERR_DATA = null;
let MAP = null;
let GEO_LAYER = null;
let GEOJSON_CACHE = null;
let SELECTED_DEPTOS = [];
let GEO_MAX_Q = 1;
let GEO_CACHE_ALL = {};
let GEO_CACHE_AC = {};
let GEO_CACHE_NAME = '';
let VIEW_MODE = 'DEPTO';

const REGION_COLORS = {
  'NOA': '#8B4513', 'NEA': '#90EE90', 'CORR': '#DC143C', 'ER': '#006400',
  'CBA NORTE': '#DA70D6', 'CBA + SL SUR': '#4169E1', 'CUYO': '#800080',
  'STA FE NORTE': '#FF8C00', 'STA FE SUR': '#FFA07A', 'BA Norte Corredor 8/9': '#00008B',
  'BA Oeste Produ': '#4682B4', 'LPA': '#87CEEB', 'BA Cuenca Sala': '#3CB371',
  'BA Sudoeste/Atl': '#FF69B4', 'PAT': '#2F4F4F'
};

const DEPTO_ALIASES = {
  '9 DE JULIO':'NUEVE DE JULIO', '25 DE MAYO':'VEINTICINCO DE MAYO',
  '12 DE OCTUBRE':'DOCE DE OCTUBRE','2 DE ABRIL':'DOS DE ABRIL',
  '1 DE MAYO':'PRIMERO DE MAYO','BRANSEN':'BRANDSEN',
  'CORONEL BRANDSEN':'BRANDSEN','CHICALCO':'CHICAL CO',
  'MBUCURUYA':'MBURUCUYA','MAYOR LUIS JFONTANA':'MAYOR LUIS J. FONTANA',
  'MAYOR LUIS J FONTANA':'MAYOR LUIS J. FONTANA',
  'LEANDRO N ALEM':'LEANDRO N. ALEM',
  'GENERAL MADARIAGA':'GENERAL JUAN MADARIAGA',
  'GENERAL LAMADRID':'GENERAL LA MADRID',
  'CORONEL ROSALES':'CORONEL DE MARINA LEONARDO ROSALES',
  'CORONEL DE MARINA L ROSALES':'CORONEL DE MARINA LEONARDO ROSALES',
  'AMEGHINO':'FLORENTINO AMEGHINO',
  'GONZALES CHAVES':'ADOLFO GONZALES CHAVES',
  'GONZALEZ CHAVES':'ADOLFO GONZALEZ CHAVES',
  'PRESIDENTE ROQUE SAENZ PEA':'PRESIDENTE ROQUE SAENZ PENA',
  'PRESIDENTE ROQUE SAENZ PENA':'PRESIDENTE ROQUE SAENZ PENA',
  'CAUELAS':'CANUELAS','CANUELAS':'CANUELAS',
  'LA BANDA':'BANDA','BANDA':'BANDA','EL TIGRE':'TIGRE'
};

const PROV_MAP = {
  'BUENOS AIRES':'BA','CORRIENTES':'COR','CORDOBA':'CBA','ENTRE RIOS':'ER',
  'FORMOSA':'FOR','LA PAMPA':'LPA','SANTIAGO DEL ESTERO':'SDE','SALTA':'SAL',
  'CHUBUT':'CHU','LA RIOJA':'LRJ','CHACO':'CHA','RIO NEGRO':'RN','SAN LUIS':'SLU',
  'MENDOZA':'MZA','NEUQUEN':'NQN','SANTA FE':'SFE','TUCUMAN':'TUC','JUJUY':'JUJ',
  'CATAMARCA':'CAT','MISIONES':'MIS','SAN JUAN':'SJU','TIERRA DEL FUEGO':'TDF',
  'CIUDAD AUTONOMA DE BUENOS AIRES':'CABA','CIUDAD DE BUENOS AIRES':'CABA','MDZ':'MZA'
};

// --- Utility Functions ---

function normalize(s) {
  var str = String(s || '').toUpperCase()
    .replace(/Ã'/g, 'N').replace(/PEA/g, 'PENA').replace(/AUELAS/g, 'ANUELAS')
    .replace(/LA BANDA/g, 'BANDA')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, '').trim();
  return DEPTO_ALIASES[str] || str;
}

function extractName(props) {
  return props.nombre || props.name || props.NOM_DEP || props.NOMBRE || props.departamento || '';
}

function extractProvCode(props) {
  var raw = '';
  if (props.provincia && typeof props.provincia === 'object') {
    raw = props.provincia.nombre || props.provincia.id || '';
  } else {
    raw = props.provincia_nombre || props.provincia || props.PROVINCIA || props.NOM_PROV || '';
  }
  return PROV_MAP[normalize(String(raw))] || '';
}

function extractKey(props) {
  var dept = normalize(extractName(props));
  var prov = extractProvCode(props);
  return dept + (prov ? '|' + prov : '');
}

function findDeptoKey(fKey, map) {
  if (map[fKey]) return fKey;
  var parts = fKey.split('|');
  var fBase = parts[0];
  var fProv = parts[1] || '';
  var keys = Object.keys(map);
  var matchingKeys = [];
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].split('|')[0] === fBase) matchingKeys.push(keys[i]);
  }
  if (matchingKeys.length === 0) return null;
  for (var j = 0; j < matchingKeys.length; j++) {
    var matchKey = matchingKeys[j];
    var kProv = matchKey.split('|')[1] || '';
    if (fProv && kProv && fProv !== kProv) continue;
    return matchKey;
  }
  return null;
}

function findRegionKey(fKey, map) {
  if (map[fKey]) return map[fKey];
  var parts = fKey.split('|');
  var fBase = parts[0];
  var fProv = parts[1] || '';
  for (var k in map) {
    if (k.split('|')[0] === fBase) {
      if (fProv && k.split('|')[1] && k.split('|')[1] !== fProv) continue;
      return map[k];
    }
  }
  return null;
}

function getRegionKey(featureKey) {
  if (!TERR_DATA || !TERR_DATA.deptoToRegion) return null;
  return findRegionKey(featureKey, TERR_DATA.deptoToRegion);
}

function arrayContains(arr, val) {
  for (var i = 0; i < arr.length; i++) { if (arr[i] === val) return true; }
  return false;
}

function fmt(n) { return Number(n || 0).toLocaleString('es-AR'); }

function showLoader(on) {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.style.display = on ? 'flex' : 'none';
}

function showError(err) {
  showLoader(false);
  console.error('Error:', err);
  alert('Error: ' + ((err && err.message) || JSON.stringify(err) || 'Error desconocido'));
}

async function apiFetch(url, options) {
  const r = await fetch(url, options || {});
  if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + url);
  return r.json();
}

// --- Dashboard Logic ---

async function loadTerritoryData(ac = '') {
  showLoader(true);
  try {
    const url = `/api/getTerritoryData${ac ? `?ac=${encodeURIComponent(ac)}` : ''}`;
    const data = await apiFetch(url);
    TERR_DATA = data;
    renderTerritory(data, ac);
    showLoader(false);
  } catch (err) {
    showError(err);
  }
}

function renderTerritory(data, ac) {
  document.getElementById('app').style.display = 'block';
  // document.getElementById('userName').textContent = ac || 'Todos los AC'; // We could add this to top bar later
  updateZonePanel_Stats(data.allByDepto || {}, data.acAdmByDepto || {}, ac);
  renderMap(data.allByDepto || {}, data.acAdmByDepto || {}, ac);
}

function updateZonePanel_Stats(allByDepto, acByDepto, acName) {
  const isDefault = SELECTED_DEPTOS.length === 0;
  const targetDepts = isDefault ? Object.keys(acByDepto) : SELECTED_DEPTOS;
  const n = targetDepts.length;

  const headerTitle = document.getElementById('zona-titulo');
  if (headerTitle) {
      headerTitle.textContent = isDefault ? 'Territorio Asignado' : (n + (n > 1 ? ' partidos seleccionados' : ' partido seleccionado'));
  }

  let totSoc = 0, totQT = 0, totQV = 0, zAdmTot = 0, zAdmAct = 0;

  for (let i = 0; i < targetDepts.length; i++) {
    const dep = targetDepts[i];
    for (let k in allByDepto) {
      const dummyMap = {}; dummyMap[dep] = true;
      if (findDeptoKey(k, dummyMap)) {
        const dataK = allByDepto[k];
        totSoc += dataK.soc; totQT += dataK.qtotal; totQV += dataK.qvaca;
        zAdmTot += (dataK.admTotal || 0); zAdmAct += (dataK.admAct || 0);
      }
    }
  }

  // Bind to stats grid
  const elements = {
      't-ac-bc-tot': fmt(totSoc),
      't-ac-bc-qt': fmt(totQT),
      't-ac-bc-qv': fmt(totQV),
      't-ac-dcac-tot': fmt(zAdmTot),
      't-ac-dcac-act': fmt(zAdmAct),
      't-ac-dcac-pct': (zAdmTot > 0 ? Math.round((zAdmAct / zAdmTot) * 100) : 0) + '%'
  };

  for (const [id, val] of Object.entries(elements)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
  }

  recalcLeads();
  renderSocTable(TERR_DATA.acSocieties, acName);
}

function renderSocTable(socs, acFilter) {
  const tbody = document.getElementById('soc-tbody');
  if (!tbody) return;

  let filteredSocs = socs;
  if (SELECTED_DEPTOS.length > 0) {
    const depMap = {};
    SELECTED_DEPTOS.forEach(d => depMap[d] = true);
    filteredSocs = socs.filter(s => {
      if (!s.inBc) return false;
      const sKey = normalize(s.depto) + (s.prov ? '|' + s.prov : '');
      return findDeptoKey(sKey, depMap);
    });
  }

  let totQt = 0, totQv = 0;
  filteredSocs.forEach(s => { totQt += s.qtotal; totQv += s.qvaca; });

  const socCountEl = document.getElementById('soc-count');
  if (socCountEl) socCountEl.textContent = filteredSocs.length;

  if (!filteredSocs.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem; color: var(--text-secondary);">Sin sociedades encontradas</td></tr>';
    document.getElementById('soc-total-q').textContent = '-';
  } else {
    filteredSocs.sort((a, b) => b.qtotal - a.qtotal);
    tbody.innerHTML = filteredSocs.map(s => `
        <tr class="fade-in">
            <td>
                <div style="font-weight: 600;">${s.nombre}</div>
                <div style="font-size: 0.7rem; color: var(--text-secondary);">CUIT: ${s.cuit}</div>
            </td>
            <td>
                <span style="font-size: 0.8rem; opacity: 0.8;">${s.depto}</span>
                <span class="depto-badge" style="font-size: 0.6rem; vertical-align: middle;">${s.prov || ''}</span>
            </td>
            <td class="text-end">
                <span class="text-warning fw-bold">${fmt(s.qtotal)}</span><br>
                <span class="text-success fw-bold">${fmt(s.qvaca)}</span>
            </td>
        </tr>
    `).join('');
    document.getElementById('soc-total-q').innerHTML = `<span class="text-warning">${fmt(totQt)}</span> / <span class="text-success">${fmt(totQv)}</span>`;
  }
}

// --- Map Control ---
const GEO_URLS = [
  'https://raw.githubusercontent.com/mgaitan/departamentos_argentina/master/departamentos-argentina.json',
  'https://apis.datos.gob.ar/georef/api/departamentos?formato=geojson&max=600'
];

async function tryFetchGeo(urls, idx, allByDepto, acByDepto, acName) {
  if (idx >= urls.length) {
    try {
      const geojson = await apiFetch('/api/getDeptoGeoJSON');
      GEOJSON_CACHE = geojson;
      drawGeoLayer(GEOJSON_CACHE, allByDepto, acByDepto, acName);
    } catch (e) {
      document.getElementById('map').innerHTML = '<div style="text-align:center;padding:60px;color:#dc3545;"><b>No se pudo cargar el mapa.</b></div>';
    }
    return;
  }
  try {
    const r = await fetch(urls[idx]);
    if (!r.ok) throw new Error();
    const json = await r.json();
    GEOJSON_CACHE = json;
    drawGeoLayer(GEOJSON_CACHE, allByDepto, acByDepto, acName);
  } catch (err) {
    tryFetchGeo(urls, idx + 1, allByDepto, acByDepto, acName);
  }
}

function renderMap(allByDepto, acByDepto, acName) {
  if (!MAP) {
    MAP = L.map('map', { zoomControl: true }).setView([-38, -63], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '(c) OpenStreetMap CARTO', maxZoom: 10
    }).addTo(MAP);
  }
  if (GEO_LAYER) { MAP.removeLayer(GEO_LAYER); GEO_LAYER = null; }
  GEO_CACHE_ALL = allByDepto;
  GEO_CACHE_AC = acByDepto;
  GEO_CACHE_NAME = acName;

  if (GEOJSON_CACHE) { drawGeoLayer(GEOJSON_CACHE, allByDepto, acByDepto, acName); return; }
  tryFetchGeo(GEO_URLS, 0, allByDepto, acByDepto, acName);
}

function drawGeoLayer(geojson, allByDepto, acByDepto, acName) {
  let geojsonData = geojson;
  if (geojson.type === 'Topology') {
    const key = Object.keys(geojson.objects)[0];
    geojsonData = topojson.feature(geojson, geojson.objects[key]);
  }
  const vals = Object.values(allByDepto).map(d => d.qtotal);
  GEO_MAX_Q = vals.length ? Math.max(...vals) : 1;

  GEO_LAYER = L.geoJSON(geojsonData, {
    style: (feature) => styleFeature(extractKey(feature.properties)),
    onEachFeature: (feature, layer) => {
      const name = extractName(feature.properties);
      const fKey = extractKey(feature.properties);
      layer.bindTooltip('', { sticky: true });
      
      layer.on('click', function () {
        if (VIEW_MODE === 'REGION') {
          const region = getRegionKey(fKey);
          if (!region) return;
          const isSelected = SELECTED_DEPTOS.some(d => getRegionKey(d) === region);
          SELECTED_DEPTOS = SELECTED_DEPTOS.filter(d => getRegionKey(d) !== region);
          
          if (!isSelected) {
            const allDeptosInRegion = Object.keys(TERR_DATA.deptoToRegion).filter(k => TERR_DATA.deptoToRegion[k] === region);
            SELECTED_DEPTOS.push(...allDeptosInRegion);
          }
        } else {
          const dep = findDeptoKey(fKey, allByDepto) || findDeptoKey(fKey, acByDepto) || fKey;
          const idx = SELECTED_DEPTOS.indexOf(dep);
          if (idx >= 0) SELECTED_DEPTOS.splice(idx, 1);
          else SELECTED_DEPTOS.push(dep);
        }
        
        refreshLayerStyles();
        updateZonePanel_Stats(allByDepto, acByDepto, acName);
        
        const badge = document.getElementById('selected-badge');
        const btn = document.getElementById('btn-clear-zona');
        if (SELECTED_DEPTOS.length > 0) {
          badge.textContent = SELECTED_DEPTOS.length + (VIEW_MODE === 'REGION' ? ' deptos selecc.' : ' selecc.');
          badge.style.display = 'inline-block';
          btn.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
          btn.style.display = 'none';
        }
      });
      
      layer.on('mouseover', function () { 
        const region = getRegionKey(fKey);
        const resp = (region && TERR_DATA && TERR_DATA.regionMap && TERR_DATA.regionMap[region]) ? TERR_DATA.regionMap[region] : 'N/A';
        const tt = VIEW_MODE === 'REGION' ? `<div style="text-align:center"><b>Región:</b> ${region || 'Sin región'}<br><b>Resp:</b> ${resp}</div>` : `<b>${name}</b>`;
        this.setTooltipContent(tt);
        
        if (VIEW_MODE === 'REGION') {
          if (region) {
            GEO_LAYER.eachLayer(l => {
              if (getRegionKey(extractKey(l.feature.properties)) === region) {
                l.setStyle({ weight: 2, color: '#ffffff', fillOpacity: 0.8 });
              }
            });
          }
        } else {
          this.setStyle({ weight: 2, color: '#3b82f6' }); 
        }
      });
      
      layer.on('mouseout', function () { 
        if (VIEW_MODE === 'REGION') {
          refreshLayerStyles();
        } else {
          GEO_LAYER.resetStyle(this); 
        }
      });
    }
  }).addTo(MAP);
  
  if (SELECTED_DEPTOS.length > 0) {
      const group = L.featureGroup(GEO_LAYER.getLayers().filter(l => {
          const k = extractKey(l.feature.properties);
          const dep = findDeptoKey(k, allByDepto);
          return dep && SELECTED_DEPTOS.includes(dep);
      }));
      if (group.getBounds().isValid()) MAP.fitBounds(group.getBounds(), { padding: [20, 20] });
  }
}

function styleFeature(featureKey) {
  const dep = findDeptoKey(featureKey, GEO_CACHE_ALL);
  const depAC = findDeptoKey(featureKey, GEO_CACHE_AC);
  const isSelected = dep && SELECTED_DEPTOS.includes(dep);
  const data = dep ? GEO_CACHE_ALL[dep] : null;

  if (isSelected) return { fillColor: '#f59e0b', fillOpacity: 0.7, weight: 2, color: '#fff' };

  if (VIEW_MODE === 'REGION') {
    const region = getRegionKey(featureKey);
    // Let's use string matching for the prefix since the exact strings might differ sometimes depending on Google sheets
    const rColorKey = Object.keys(REGION_COLORS).find(k => region && region.toUpperCase().startsWith(k.toUpperCase()));
    if (rColorKey) {
       return { fillColor: REGION_COLORS[rColorKey], fillOpacity: 0.6, weight: 0.5, color: 'rgba(255,255,255,0.2)' };
    } else {
       return { fillColor: '#21262d', fillOpacity: 0.1, weight: 0.5, color: 'rgba(255,255,255,0.1)' };
    }
  }

  if (depAC && GEO_CACHE_NAME && GEO_CACHE_NAME !== '') return { fillColor: '#3b82f6', fillOpacity: 0.5, weight: 1, color: '#2563eb' };
  
  return { 
    fillColor: data ? colorScale(data.qtotal / GEO_MAX_Q) : '#21262d', 
    weight: 0.5, 
    color: 'rgba(255,255,255,0.1)', 
    fillOpacity: data ? 0.3 + (data.qtotal / GEO_MAX_Q) * 0.4 : 0.1 
  };
}

function refreshLayerStyles() {
  if (!GEO_LAYER) return;
  GEO_LAYER.eachLayer(layer => { layer.setStyle(styleFeature(extractKey(layer.feature.properties))); });
}

function colorScale(t) {
  if (t <= 0) return '#21262d';
  // Gradient from Deep Blue to Bright Emerald
  const r = Math.round(16 + t * 40);
  const g = Math.round(27 + t * 158);
  const b = Math.round(34 + t * 95);
  return `rgb(${r},${g},${b})`;
}

window.setMapMode = function(mode) {
  VIEW_MODE = mode;
  document.getElementById('btn-mode-depto').classList.toggle('active', mode === 'DEPTO');
  document.getElementById('btn-mode-region').classList.toggle('active', mode === 'REGION');
  window.clearZoneSelection();
};

window.onACChange = function() {
  const ac = document.getElementById('selAC').value;
  SELECTED_DEPTOS = [];
  document.getElementById('selected-badge').style.display = 'none';
  document.getElementById('btn-clear-zona').style.display = 'none';
  loadTerritoryData(ac);
};

window.clearZoneSelection = function() {
  SELECTED_DEPTOS = [];
  refreshLayerStyles();
  document.getElementById('btn-clear-zona').style.display = 'none';
  document.getElementById('selected-badge').style.display = 'none';
  updateZonePanel_Stats(GEO_CACHE_ALL, GEO_CACHE_AC, GEO_CACHE_NAME);
};

window.refreshCache = async function() {
    const icon = document.getElementById('refresh-icon');
    const text = document.getElementById('refresh-text');
    if (icon) icon.classList.add('animate-spin');
    if (text) text.textContent = 'Actualizando...';
    
    try {
        await apiFetch('/api/invalidateCache', { method: 'POST' });
        const ac = document.getElementById('selAC').value;
        await loadTerritoryData(ac);
    } catch (err) {
        showError(err);
    } finally {
        if (icon) icon.classList.remove('animate-spin');
        if (text) text.textContent = 'Actualizar';
    }
}

// --- Ranking & Leads ---
function recalcLeads() {
  if (!TERR_DATA || !TERR_DATA.acLeadsRaw) return;
  const m = parseInt(document.getElementById('zp-leads-months').value) || 3;
  const cutTime = Date.now() - (m * 30 * 24 * 60 * 60 * 1000);
  const acName = GEO_CACHE_NAME;
  const isAdmin = !acName;
  
  const isDefault = SELECTED_DEPTOS.length === 0;
  const deptosObj = {};
  if (isDefault) {
    Object.keys(TERR_DATA.acByDepto || {}).forEach(k => deptosObj[k] = true);
    Object.keys(TERR_DATA.acAdmByDepto || {}).forEach(k => deptosObj[k] = true);
  } else {
    SELECTED_DEPTOS.forEach(d => deptosObj[d] = true);
  }
  const targetDepts = Object.keys(deptosObj);
  
  let asigCount = 0, commCount = 0, actCount = 0;
  const acRankMap = {};

  TERR_DATA.acLeadsRaw.forEach(r => {
    if (r.ts < cutTime) return;
    if (r.ac) {
      if (!acRankMap[r.ac]) acRankMap[r.ac] = { n: r.ac, count: 0, act: 0 };
      acRankMap[r.ac].count++;
      if (r.pTs) acRankMap[r.ac].act++;
    }
    if (!isAdmin && r.ac !== acName) return;
    
    const rBase = r.dep.split('|')[0];
    if (targetDepts.some(td => td.split('|')[0] === rBase)) {
      asigCount++;
      if (r.cTxt) commCount++;
      if (r.pTs) actCount++;
    }
  });

  document.getElementById('zp-ld-asig').textContent = asigCount;
  document.getElementById('zp-ld-comm').textContent = commCount;
  document.getElementById('zp-ld-act').textContent = actCount;
  const efectividad = asigCount > 0 ? Math.round((actCount / asigCount) * 100) : 0;
  document.getElementById('zp-ld-pct').textContent = efectividad + '%';

  const rankArr = Object.values(acRankMap).map(item => ({
    ...item,
    efec: item.count > 0 ? Math.round((item.act / item.count) * 100) : 0
  })).sort((a, b) => b.efec - a.efec);

  const rankList = document.getElementById('zp-ranking-list');
  if (rankList) {
    rankList.innerHTML = rankArr.map((item, idx) => `
        <div class="stat-card" style="padding: 0.75rem; background: ${item.n === acName ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)'}; cursor: pointer;" onclick="document.getElementById('selAC').value='${item.n}'; onACChange();">
            <div style="display:flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.8rem; font-weight: 500;">${idx + 1}. ${item.n}</span>
                <span class="status-badge ${item.efec > 50 ? 'status-active' : 'status-pending'}">${item.efec}%</span>
            </div>
            <div style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 4px;">Asignadas: ${item.count} | Activas: ${item.act}</div>
        </div>
    `).join('');
  }
  
  const rankPeriod = document.getElementById('ranking-period');
  if (rankPeriod) rankPeriod.textContent = `(Últ. ${m} meses)`;
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) window.lucide.createIcons();
  
  try {
    const acs = await apiFetch('/api/getACs');
    const sel = document.getElementById('selAC');
    acs.forEach(ac => {
      const opt = document.createElement('option');
      opt.value = ac;
      opt.textContent = ac;
      sel.appendChild(opt);
    });
    loadTerritoryData('');
  } catch (err) {
    showError(err);
  }
});
