'use client';

import { useState, useMemo, lazy, Suspense } from 'react';
import dynamic from 'next/dynamic';

const MapaTab   = dynamic(() => import('../src/MapaTab'),   { ssr: false });
const CuentasTab = dynamic(() => import('../src/CuentasTab'), { ssr: false });

const ALL_PROVINCES = [
  { code: 'BUE', name: 'Buenos Aires', raw: 'BUENOS AIRES' },
  { code: 'CABA', name: 'CABA', raw: 'CABA' },
  { code: 'CAT', name: 'Catamarca', raw: 'CATAMARCA' },
  { code: 'CHA', name: 'Chaco', raw: 'CHACO' },
  { code: 'CHU', name: 'Chubut', raw: 'CHUBUT' },
  { code: 'CBA', name: 'Córdoba', raw: 'CORDOBA' },
  { code: 'COR', name: 'Corrientes', raw: 'CORRIENTES' },
  { code: 'ERI', name: 'Entre Ríos', raw: 'ENTRE RIOS' },
  { code: 'FOR', name: 'Formosa', raw: 'FORMOSA' },
  { code: 'JUJ', name: 'Jujuy', raw: 'JUJUY' },
  { code: 'LPA', name: 'La Pampa', raw: 'LA PAMPA' },
  { code: 'LAR', name: 'La Rioja', raw: 'LA RIOJA' },
  { code: 'MZA', name: 'Mendoza', raw: 'MENDOZA' },
  { code: 'MIS', name: 'Misiones', raw: 'MISIONES' },
  { code: 'NQN', name: 'Neuquén', raw: 'NEUQUEN' },
  { code: 'RNE', name: 'Río Negro', raw: 'RIO NEGRO' },
  { code: 'SAL', name: 'Salta', raw: 'SALTA' },
  { code: 'SJU', name: 'San Juan', raw: 'SAN JUAN' },
  { code: 'SLU', name: 'San Luis', raw: 'SAN LUIS' },
  { code: 'SCR', name: 'Santa Cruz', raw: 'SANTA CRUZ' },
  { code: 'SFE', name: 'Santa Fe', raw: 'SANTA FE' },
  { code: 'SDE', name: 'Santiago del Estero', raw: 'SANTIAGO DEL ESTERO' },
  { code: 'TDF', name: 'Tierra del Fuego', raw: 'TIERRA DEL FUEGO' },
  { code: 'TUC', name: 'Tucumán', raw: 'TUCUMAN' }
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('FUNNEL');
  const [activeProvs, setActiveProvs] = useState([]);
  const [filtroPartido, setFiltroPartido] = useState('');
  const [soloAmarillas, setSoloAmarillas] = useState(false);
  const [busquedaUsuarios, setBusquedaUsuarios] = useState('');
  const [filtroTextoGeneral, setFiltroTextoGeneral] = useState('');
  const [visibleCountNODCAC, setVisibleCountNODCAC] = useState(20);
  const [visibleCountACTIVAS, setVisibleCountACTIVAS] = useState(20);
  const [visibleCountUSUARIOS, setVisibleCountUSUARIOS] = useState(20);
  
  const [data189, setData189] = useState(null);
  const [data188, setData188] = useState(null);
  const [dataUsers, setDataUsers] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchedText, setSearchedText] = useState('');
  const [showGlosario, setShowGlosario] = useState(false);
  const [drilldownDep, setDrilldownDep] = useState(null);
  const [sortConfig, setSortConfig] = useState({ tab: null, field: null, dir: 'desc' });
  // Departamentos seleccionados desde el mapa (filtro visual)
  const [selectedDeptos, setSelectedDeptos] = useState([]);

  const handleSort = (tab, field) => {
    setSortConfig(prev => {
      if (prev.tab === tab && prev.field === field) {
        return { tab, field, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { tab, field, dir: 'desc' };
    });
  };

  const sortIcon = (tab, field) => {
    if (sortConfig.tab !== tab || sortConfig.field !== field) return <span style={{marginLeft:'4px', color:'#94a3b8', fontSize:'10px'}}>↕</span>;
    return <span style={{marginLeft:'4px', color:'var(--accent)', fontSize:'12px', fontWeight: 'bold'}}>{sortConfig.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  const thStyle = {cursor: 'pointer', userSelect: 'none'};

  const isEmpty = (data188 === null && data189 === null);

  const handleFetchData = () => {
    setLoading(true);
    setError(null);
    setSearchedText((activeProvs.length > 0 ? activeProvs.map(p => p.name).join(', ') : 'Nación') + (filtroPartido ? ` (${filtroPartido})` : ''));
    
    const provPayload = activeProvs.length > 0 ? activeProvs.map(p => p.raw).join(',') : '';

    Promise.all([
      fetch('/api/funnel', { method: 'POST', body: JSON.stringify({ provincia: provPayload }) }).then(res => res.json()),
      fetch('/api/prospectos', { method: 'POST', body: JSON.stringify({ provincia: provPayload }) }).then(res => res.json()),
      fetch('/api/usuarios', { method: 'POST', body: JSON.stringify({ busqueda: busquedaUsuarios }) }).then(res => res.json().catch(() => ({error: true})))
    ]).then(([res189, res188, resUsers]) => {
      
      if (res188.error) throw new Error("Error grave: Q188 Base Clave no responde.");
      if (res189.error) console.warn("Atención: Q189 está fallando en Metabase. Simulando vacío.");
      
      setData189(res189.error ? [] : (res189.data?.rows || []));
      setData188(Array.isArray(res188) ? res188 : (res188.data?.rows || []));
      setDataUsers(resUsers.error ? [] : (resUsers.data?.rows || []));

      setLoading(false);
    }).catch(err => {
      setError(err.message);
      setLoading(false);
    });
  };

  // Compute logic mathematically matching Google Sheets tabs
  const { funnelStats, tables } = useMemo(() => {
    if (isEmpty) return { funnelStats: {}, tables: { funnel: [], dt188: [], dt189: [], usuarios: [] } };

    let base188 = data188 || [];
    let base189 = data189 || [];
    let baseUsers = dataUsers || [];

    const getSortedData = (dataArray, tabId) => {
      if (!sortConfig.field || sortConfig.tab !== tabId) return dataArray;
      return [...dataArray].sort((a, b) => {
        let aVal = a[sortConfig.field];
        let bVal = b[sortConfig.field];
        if (aVal === undefined || aVal === null) aVal = '';
        if (bVal === undefined || bVal === null) bVal = '';
        if (!isNaN(Number(aVal)) && !isNaN(Number(bVal)) && aVal !== '' && bVal !== '') {
           return sortConfig.dir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
        }
        return sortConfig.dir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      });
    };

    const rawProvs = activeProvs.map(p => p.raw.toUpperCase());
      
    // Filtros geográficos locales OBLIGATORIOS (porque Q189 y Q190 no tienen el tag configurado en Metabase)
    if (rawProvs.length > 0) {
      base189 = base189.filter(r => {
        const p = (r.prov_est_bc || r.prov_dcac || r.prov_fiscal_bc || r.prov_est_dcac || r.todas_las_provincias_bc || '').toUpperCase();
        return rawProvs.some(prov => p.includes(prov));
      });
      baseUsers = baseUsers.filter(r => {
        const p = (r.provincia || r.provincia_est || r.provincia_usuario || '').toUpperCase();
        return rawProvs.some(prov => p.includes(prov));
      });
    }

    // Filtro Post-fetch en memoria (si agregaron un string en partido que Metabase no haya filtrado)
    if (filtroPartido && filtroPartido.trim() !== '') {
      const q = filtroPartido.toUpperCase().trim();
      base188 = base188.filter(r => 
        String(r.partido_fiscal_senasa || '').toUpperCase().includes(q) || 
        String(r.partido_establecimiento_senasa || '').toUpperCase().includes(q) ||
        String(r.partido_registro_dcac || '').toUpperCase().includes(q)
      );
      base189 = base189.filter(r => 
        String(r.part_est_bc || '').toUpperCase().includes(q) ||
        String(r.part_fiscal_bc || '').toUpperCase().includes(q) ||
        String(r.part_dcac || '').toUpperCase().includes(q) ||
        String(r.partido_est_dcac || '').toUpperCase().includes(q) ||
        String(r.localidad_est || '').toUpperCase().includes(q) ||
        String(r.todos_los_partidos_bc || '').toUpperCase().includes(q) ||
        String(r.todas_las_localidades_bc || '').toUpperCase().includes(q)
      );
      baseUsers = baseUsers.filter(r => 
        String(r.partido || '').toUpperCase().includes(q) ||
        String(r.partido_est || '').toUpperCase().includes(q) ||
        String(r.partido_usuario || '').toUpperCase().includes(q) ||
        String(r.localidad_soc || '').toUpperCase().includes(q)
      );
    }

    // ── Filtro por departamentos seleccionados en el mapa ──
    if (selectedDeptos && selectedDeptos.length > 0) {
      const depNames = new Set(selectedDeptos.map(d => d.name.toUpperCase()));
      base188 = base188.filter(r => {
        const dep = String(r.partido_establecimiento_senasa || r.partido_fiscal_senasa || '').toUpperCase();
        return depNames.has(dep);
      });
      base189 = base189.filter(r => {
        const dep = String(r.part_est_bc || r.part_dcac || r.partido_est_dcac || '').toUpperCase();
        return depNames.has(dep);
      });
      baseUsers = baseUsers.filter(r => {
        const dep = String(r.partido || r.partido_est || r.partido_usuario || r.localidad_soc || '').toUpperCase();
        return [...depNames].some(d => dep.includes(d));
      });
    }

    const fifteenMonthsAgo = new Date();
    fifteenMonthsAgo.setMonth(fifteenMonthsAgo.getMonth() - 15);

    // Etiquetado y Filtrado de Amarillas
    let amarillasCount = 0;
    let conActividadReciente = 0;

    const base189Marcada = base189.map(r => {
      const ultActDate = r.Ult_act ? new Date(r.Ult_act) : null;
      const tieneRed = String(r.repre || '').trim().length > 0 || String(r.oficina || '').trim().length > 0 || String(r.red_comercial || '').trim().length > 0;
      
      let esAmarilla = false;
      if (!ultActDate || ultActDate < fifteenMonthsAgo) {
          if (!tieneRed) {
              esAmarilla = true;
              amarillasCount++;
          }
      }
      if (ultActDate && ultActDate >= fifteenMonthsAgo) conActividadReciente++;
      
      return { ...r, esAmarilla };
    });

    // Toggle Filtro Amarillas (afecta TODA LA APP)
    let b188Final = base188;
    let b189Final = base189Marcada;
    if (soloAmarillas) {
        b189Final = b189Final.filter(r => r.esAmarilla);
        const cuitsAmarillos = new Set(b189Final.map(r => String(r.cuit)));
        b188Final = b188Final.filter(r => cuitsAmarillos.has(String(r.cuit)));
    }

    if (filtroTextoGeneral && filtroTextoGeneral.trim() !== '') {
      const q = filtroTextoGeneral.toUpperCase().trim();
      b188Final = b188Final.filter(r => 
        String(r.razon_social_senasa || r.razon_social || '').toUpperCase().includes(q) || 
        String(r.cuit || r.cuit_titular_up || '').toUpperCase().includes(q)
      );
      b189Final = b189Final.filter(r => 
        String(r['st.razon_social'] || r.razon_social || '').toUpperCase().includes(q) || 
        String(r['st.cuit'] || r.cuit || '').toUpperCase().includes(q) ||
        String(r.representante || '').toUpperCase().includes(q) ||
        String(r.asociado_comercial || '').toUpperCase().includes(q)
      );
      baseUsers = baseUsers.filter(r => 
        String(r.nombre || '').toUpperCase().includes(q) ||
        String(r.apellido || '').toUpperCase().includes(q) ||
        String(r.razon_social || '').toUpperCase().includes(q) ||
        String(r.cuit_sociedad || '').toUpperCase().includes(q)
      );
    }

    // TABLA 1: FUNNEL POR DEPARTAMENTO (Espejo de Hoja "Funnel Sociedades")
    const agrupadoPartido = {};
    
    b188Final.forEach(r => {
        const dep = String(r.partido_establecimiento_senasa || 'S/D').toUpperCase();
        if (!agrupadoPartido[dep]) {
            agrupadoPartido[dep] = { dep, socBase: 0, cabezas: 0, socDcac: 0, cabezasDcacOperadas: 0, socDcacOp: 0, ccc: 0 };
        }
        agrupadoPartido[dep].socBase += 1;
        agrupadoPartido[dep].cabezas += (r.total_bovinos || 0);
        
        if (r.existe_en_dcac === 'SI') {
            agrupadoPartido[dep].socDcac += 1;
            const opDC = (r.cabezas_operadas_dcac || 0);
            agrupadoPartido[dep].cabezasDcacOperadas += opDC;
            if (opDC > 0) agrupadoPartido[dep].socDcacOp += 1;
        }
    });
    
    b189Final.forEach(r => {
        // En Q189 un usuario puede no tener partido si no es un BC matcheado. Intentamos mapearlo.
        const dep = String(r.part_est_bc || r.part_dcac || r.partido_est_dcac || 'S/D').toUpperCase();
        
        // Sumamos CCC solo si el departamento origen existe en el embudo Base
        if (agrupadoPartido[dep]) {
            agrupadoPartido[dep].ccc += (r.total_bovinos || 0); // CCC (Cabezas Carga Comercial)
        }
    });

    const funnelView = Object.values(agrupadoPartido).sort((a,b) => b.cabezas - a.cabezas);

    return {
      funnelStats: {
        totalSenasa: base188.length,
        estanEnDCAC: base189.length,
        actividadUltimos15M: conActividadReciente,
        amarillasCount: amarillasCount
      },
      tables: {
        funnel: funnelView,
        dt188: b188Final.sort((a,b) => (b.total_bovinos || 0) - (a.total_bovinos || 0)),
        dt189: b189Final.sort((a,b) => {
            const fechaA = a.Ult_act ? new Date(a.Ult_act).getTime() : 0;
            const fechaB = b.Ult_act ? new Date(b.Ult_act).getTime() : 0;
            return fechaB - fechaA;
        }),
        usuarios: baseUsers
      }
    };
  }, [isEmpty, soloAmarillas, activeProvs, data188, data189, dataUsers, filtroPartido, filtroTextoGeneral, selectedDeptos]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)' }}>
      
      {/* SIDEBAR DE FILTROS */}
      <div style={{ width: '320px', flexShrink: 0, borderRight: '1px solid var(--border-color)', background: '#fff', padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, overflowY: 'auto' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '2rem', color: 'var(--accent)' }}>Neo<span style={{color:'#1e293b'}}>Panel</span></h2>
        
        <h3 className="kpi-title" style={{ marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>Filtro de Datos Nativos</h3>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '13px', color: '#475569' }}>Provincias de Búsqueda</p>
          <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.5rem', background: '#f8fafc', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
            {ALL_PROVINCES.map(p => (
              <label key={p.code} style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.2rem', cursor: 'pointer', borderBottom: '1px solid #e2e8f0', margin: 0 }}>
                <input 
                  type="checkbox" 
                  checked={activeProvs.some(ap => ap.code === p.code)}
                  onChange={(e) => {
                    if (e.target.checked) setActiveProvs([...activeProvs, p]);
                    else setActiveProvs(activeProvs.filter(ap => ap.code !== p.code));
                  }}
                  style={{ marginRight: '0.75rem', width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{p.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '13px', color: '#475569' }}>Partido / Localidad</p>
          <input 
            type="text"
            placeholder="Ej: Paso de los libres..."
            value={filtroPartido}
            onChange={(e) => setFiltroPartido(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '13px', color: '#475569' }}>Buscador General (Frontend)</p>
          <input 
            type="text"
            placeholder="Sociedad, CUIT, Nombre, Apellido..."
            value={filtroTextoGeneral}
            onChange={(e) => setFiltroTextoGeneral(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--accent)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', boxShadow: '0 1px 3px rgba(37,99,235,0.2)' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '13px', color: '#475569' }}>Búsqueda en Base Usuarios</p>
          <input 
            type="text"
            placeholder="Forzar usuario desde el servidor..."
            value={busquedaUsuarios}
            onChange={(e) => setBusquedaUsuarios(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          />
        </div>
        
        {/* BOTÓN EXTRAORDINARIO AMARILLAS */}
        <div style={{ marginBottom: '1.5rem', padding: '0.8rem', background: soloAmarillas ? '#fef3c7' : '#fff', border: `1px solid ${soloAmarillas ? '#fcd34d' : 'var(--border-color)'}`, borderRadius: '6px', transition: 'all 0.3s' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
            <input 
              type="checkbox" 
              checked={soloAmarillas}
              onChange={(e) => setSoloAmarillas(e.target.checked)}
              style={{ marginRight: '0.75rem', width: '16px', height: '16px', accentColor: '#d97706', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13.5px', color: '#92400e', fontWeight: 600 }}>Solo Candidatas "Amarillas" <br/><span style={{fontSize: '11px', fontWeight: 400}}>(Inactivas &gt; 15M y sin AC Mapeado)</span></span>
          </label>
        </div>
        
        <div style={{ marginTop: 'auto', padding: '1rem', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
          <button 
            onClick={handleFetchData}
            disabled={loading}
            style={{ width: '100%', padding: '0.8rem', background: loading ? '#93c5fd' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(29,78,216,0.3)', marginBottom: '0.5rem' }}
          >
            {loading ? 'Consultando...' : (isEmpty ? 'Buscar en Metabase' : 'Actualizar Datos')}
          </button>

          {!isEmpty && (
              <button 
                style={{ width: '100%', padding: '0.6rem', background: '#fff', border: '1px solid #93c5fd', color: '#1d4ed8', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
                onClick={() => { setActiveProvs([]); setFiltroPartido(''); setSoloAmarillas(false); setData188(null); setData189(null); }}
              >
                Limpiar todo y Volver
              </button>
          )}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        
        {/* TABS HEADER NAV */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--border-color)', padding: '0 2rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div className="tabs-nav" style={{ marginBottom: '-1px' }}>
            <button className={`tab-btn ${activeTab === 'FUNNEL' ? 'active' : ''}`} onClick={() => setActiveTab('FUNNEL')}>
              Funnel Sociedades
            </button>
            <button className={`tab-btn ${activeTab === 'NODCAC' ? 'active' : ''}`} onClick={() => setActiveTab('NODCAC')}>
              Sociedades B.C
            </button>
            <button className={`tab-btn ${activeTab === 'ACTIVAS' ? 'active' : ''}`} onClick={() => setActiveTab('ACTIVAS')}>
              Sociedades dCaC
            </button>
            <button className={`tab-btn ${activeTab === 'USUARIOS' ? 'active' : ''}`} onClick={() => setActiveTab('USUARIOS')}>
              Directorio Neo
            </button>
            <button className={`tab-btn ${activeTab === 'MAPA' ? 'active' : ''}`} onClick={() => setActiveTab('MAPA')} style={{borderLeft: '2px solid #e2e8f0'}}>
              🗺️ Mapa {selectedDeptos.length > 0 && <span style={{background:'#1d6fa4',color:'#fff',borderRadius:99,fontSize:10,padding:'1px 6px',marginLeft:4}}>{selectedDeptos.length}</span>}
            </button>
            <button className={`tab-btn ${activeTab === 'CUENTAS' ? 'active' : ''}`} onClick={() => setActiveTab('CUENTAS')}>
              📁 Cuentas
            </button>
          </div>
        </div>

        <div className="tablero-container" style={{ padding: '2rem', maxWidth: '100%', margin: 0 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: selectedDeptos.length > 0 ? '0.75rem' : '2rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0f172a' }}>Tablero de Tráfico & Operaciones</h1>
              <p className="subtitle" style={{ margin: '0.4rem 0 0 0', fontSize: '1rem', color: '#64748b' }}>
                {isEmpty ? 'Esperando orden de búsqueda...' : `Visualizando: ${searchedText}`}
              </p>
            </div>
            <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
               <button onClick={() => setShowGlosario(true)} style={{background: '#e2e8f0', color: '#1e293b', padding: '0.5rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'background 0.2s'}}>📖 Glosario</button>
               {!isEmpty && (
                   <div style={{background: '#f8fafc', padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 500}}>
                      🔥 Extracción Limitless Activada
                   </div>
               )}
            </div>
          </div>

          {/* Banner filtro mapa activo */}
          {selectedDeptos.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem', background: '#d0e8f5', border: '1px solid #bfd5e4', borderRadius: 8, padding: '8px 16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#1d6fa4', fontWeight: 600 }}>📍 Filtro de mapa activo:</span>
              {selectedDeptos.map(d => (
                <span key={d.key} style={{ background: '#fff', border: '1px solid #bfd5e4', borderRadius: 99, padding: '2px 10px', fontSize: 12, color: '#1d6fa4', fontWeight: 600 }}>{d.name}</span>
              ))}
              <button onClick={() => setSelectedDeptos([])} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #bfd5e4', borderRadius: 6, color: '#1d6fa4', padding: '3px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>× Limpiar filtro mapa</button>
            </div>
          )}

          {isEmpty && !loading && (
            <div style={{ textAlign: 'center', padding: '6rem 2rem', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <img src="/splash.png" alt="Bienvenida" style={{ width: '100%', maxWidth: '320px', margin: '0 auto 2rem auto', display: 'block', borderRadius: '8px' }} />
              <h2 style={{ fontSize: '1.6rem', color: '#1e293b', marginBottom: '0.5rem', fontWeight: 700 }}>Selecciona tu Área Comercial</h2>
              <p style={{ color: '#64748b', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
                Para evitar demoras descargando toda la base de datos nacional, usa el menú lateral para perfilar tu zona de interés o presiona <strong>Buscar</strong> para traer todo el potencial ganadero.
              </p>
            </div>
          )}

          {loading && (
            <div className="loader-container" style={{ padding: '4rem 0' }}>
              <div className="spinner"></div>
              <h3 style={{marginTop: '1rem', color: '#475569'}}>Sincronizando Metabase...</h3>
              <p style={{color: '#94a3b8', fontSize: '13px'}}>Esto puede demorar unos segundos si buscás a nivel Nación</p>
            </div>
          )}

          {error && (
            <div style={{ color: 'var(--danger)', padding: '1.5rem', border: '1px solid var(--danger)', borderRadius: '0.5rem', background: '#fef2f2', fontWeight: 500 }}>
              <strong>Error de conexión:</strong> {error}
            </div>
          )}

          {!loading && !error && !isEmpty && (
             <>
                <div className="grid-kpis">
                  <div className="kpi-card">
                    <div className="kpi-title">ESTABLECIMIENTOS BC</div>
                    <div className="kpi-value">{funnelStats.totalSenasa}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-title">ESTÁN EN DCAC (Q189)</div>
                    <div className="kpi-value" style={{color: 'var(--accent)'}}>{funnelStats.estanEnDCAC}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-title">ACT. ÚLTIMOS 15 MESES</div>
                    <div className="kpi-value" style={{color: 'var(--success)'}}>{funnelStats.actividadUltimos15M}</div>
                  </div>
                  <div className="kpi-card" style={{borderColor: soloAmarillas ? 'var(--warning)' : 'var(--border-color)', background: soloAmarillas ? '#fffbeb' : '#fff'}}>
                    <div className="kpi-title">TOTAL AMARILLAS</div>
                    <div className="kpi-value amarillo">{funnelStats.amarillasCount}</div>
                  </div>
                </div>

                {activeTab === 'FUNNEL' && (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Funnel Sociedades</h2>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Agrupado por Departamento Ppal. (Mayor a 300 cab)</span>
                    </div>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Departamento (Est. Ppal.)</th>
                            <th>Soc. (Base Clave)</th>
                            <th>Cabezas</th>
                            <th>Sociedades dCaC</th>
                            <th>Cabezas Operadas dCaC</th>
                            <th>% Penetración (Activas)</th>
                            <th style={{width: '90px'}}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {tables.funnel.map((row, i) => (
                            <tr key={i}>
                              <td><div className="highlight">{row.dep}</div></td>
                              <td><div className="metric">{row.socBase}</div></td>
                              <td><div className="metric">🐄 {row.cabezas}</div></td>
                              <td><div>{row.socDcac || 0}</div></td>
                              <td><div className="metric">📈 {row.cabezasDcacOperadas || 0}</div></td>
                              <td title={`Calculado: ${row.socDcacOp || 0} Soc. Operando / ${row.socBase} Soc. Base Clave`}>
                                <span className={`badge ${((row.socDcacOp || 0)/row.socBase) > 0.15 ? 'badge-yes' : 'badge-outline'}`}>
                                  {Math.round(((row.socDcacOp || 0)/row.socBase) * 100)}%
                                </span>
                              </td>
                              <td style={{textAlign: 'right'}}>
                                <button
                                  onClick={() => setDrilldownDep(row.dep)}
                                  style={{background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.15rem 0.5rem', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(29, 78, 216, 0.1)'}}
                                >
                                  Ver Detalle
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'NODCAC' && (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', background: '#f8fafc' }}>
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Sociedades B.C. (No en dCaC)</h2>
                    </div>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                      <table>
                        <thead>
                          <tr>
                            <th onClick={() => handleSort('NODCAC', 'total_bovinos')} title="Cabezas Totales (Miles)" style={{...thStyle, textAlign: 'center', background: '#f8fafc'}}>K (Total) {sortIcon('NODCAC', 'total_bovinos')}</th>
                            <th onClick={() => handleSort('NODCAC', 'total_vacas')} title="Vientres (Miles)" style={{...thStyle, textAlign: 'center', background: '#f8fafc'}}>Kv (Vacas) {sortIcon('NODCAC', 'total_vacas')}</th>
                            <th onClick={() => handleSort('NODCAC', 'razon_social_senasa')} style={thStyle}>Razón Social {sortIcon('NODCAC', 'razon_social_senasa')}</th>
                            <th onClick={() => handleSort('NODCAC', 'cuit')} style={thStyle}>CUIT {sortIcon('NODCAC', 'cuit')}</th>
                            <th onClick={() => handleSort('NODCAC', 'prov_fiscal_senasa')} style={thStyle}>Domicilio Fiscal {sortIcon('NODCAC', 'prov_fiscal_senasa')}</th>
                            <th onClick={() => handleSort('NODCAC', 'prov_establecimiento_senasa')} style={thStyle}>Ubicación Establecimiento {sortIcon('NODCAC', 'prov_establecimiento_senasa')}</th>
                            <th>Status Red</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getSortedData(tables.dt188, 'NODCAC').slice(0, visibleCountNODCAC).map((row, i) => {
                            const cuitBuscado = String(row.cuit || row.cuit_titular_up || '').trim();
                            const matchDcac = data189 && data189.find(d => String(d.cuit || '').trim() === cuitBuscado);
                            
                            const rawBov = Number(row.total_bovinos || 0);
                            const totalK = rawBov >= 1000 ? (rawBov/1000).toFixed(1) + 'k' : rawBov;
                            
                            const rawVacas = Number(row.total_vacas || 0);
                            const vacaK = rawVacas >= 1000 ? (rawVacas/1000).toFixed(1) + 'k' : rawVacas;
                            
                            const getFormatStyle = (val) => {
                              if (!val || val < 1) return { background: '#f8fafc', color: '#94a3b8' };
                              if (val <= 500) return { background: '#eb9b9e', color: '#000' };
                              if (val <= 1000) return { background: '#b86407', color: '#fff' };
                              if (val <= 5000) return { background: '#cccccc', color: '#000' };
                              if (val <= 10000) return { background: '#eaaa20', color: '#000' };
                              return { background: '#000000', color: '#f59e0b' }; 
                            };
                            
                            const totalStyle = getFormatStyle(rawBov);
                            const vacasStyle = getFormatStyle(rawVacas);
                            
                            return (
                              <tr key={i} style={matchDcac ? {background: '#f0fdf4'} : {}}>
                                <td style={{textAlign: 'center', fontWeight: 'bold', background: totalStyle.background, color: totalStyle.color}}>{totalK}</td>
                                <td style={{textAlign: 'center', fontWeight: 'bold', background: vacasStyle.background, color: vacasStyle.color}}>{vacaK}</td>
                                <td>
                                  <div className="highlight">{row.razon_social_senasa || row.razon_social}</div>
                                  {matchDcac && matchDcac.razon_social !== (row.razon_social_senasa || row.razon_social) && (
                                    <div style={{fontSize: '11px', color: '#16a34a'}}>dCaC: {matchDcac.razon_social}</div>
                                  )}
                                </td>
                                <td><div className="metric">{cuitBuscado}</div></td>
                                <td>
                                  <div style={{fontSize: '12.5px', fontWeight: 600}}>{row.prov_fiscal_senasa || row.prov_fiscal}</div>
                                  <div style={{fontSize: '11px', color: '#444'}}>{`${row.partido_fiscal_senasa || ''} - ${row.localidad_fiscal || ''}`.replace(/^- | -$/g, '').trim()}</div>
                                  <div style={{fontSize: '10.5px', color: '#777'}}>{row.direccion_fiscal || ''}</div>
                                </td>
                                <td>
                                  <div style={{fontSize: '12.5px', fontWeight: 600}}>{row.prov_establecimiento_senasa || row.provincia}</div>
                                  <div style={{fontSize: '11px', color: '#444'}}>{row.partido_establecimiento_senasa || ''}</div>
                                </td>
                                <td>
                                  {matchDcac ? (
                                     <span className="badge badge-yes" style={{fontSize: '10px', background: '#16a34a', color: 'white'}}>EN DCAC</span>
                                  ) : (
                                     <span className="badge badge-no" style={{fontSize: '10px'}}>SIN DCAC</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {tables.dt188.length > visibleCountNODCAC && (
                        <div style={{ padding: '1rem', textAlign: 'center', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                          <button onClick={() => setVisibleCountNODCAC(prev => prev + 10)} style={{ padding: '0.5rem 1.5rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '20px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>
                            Cargar 10 más ↓
                          </button>
                        </div>
                    )}
                  </div>
                )}

                {activeTab === 'ACTIVAS' && (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', background: '#f8fafc' }}>
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Sociedades en dCaC {soloAmarillas && <span style={{color: '#d97706'}}>(Sólo Amarillas)</span>}</h2>
                    </div>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                      <table>
                        <thead>
                          <tr>
                            <th colSpan="21" style={{ textAlign: 'center' }}>INFORMACIÓN PRINCIPAL</th>
                            <th colSpan="4" style={{ textAlign: 'center', background: '#dbeafe' }}>FAENA</th>
                            <th colSpan="4" style={{ textAlign: 'center', background: '#fee2e2' }}>INVERNADA</th>
                            <th colSpan="4" style={{ textAlign: 'center', background: '#fef3c7' }}>CRÍA</th>
                            <th colSpan="4" style={{ textAlign: 'center', background: '#f3f4f6' }}>DIRECCIONES</th>
                          </tr>
                          <tr>
                            <th onClick={() => handleSort('ACTIVAS', 'total_bovinos')} title="Cabezas Totales (Miles)" style={thStyle}>K {sortIcon('ACTIVAS', 'total_bovinos')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'total_vacas')} title="Vientres (Miles)" style={thStyle}>Kv {sortIcon('ACTIVAS', 'total_vacas')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'q_usuarios')} title="% Usuarios" style={thStyle}>%U {sortIcon('ACTIVAS', 'q_usuarios')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'conc_gral')} title="Concreción General" style={thStyle}>CCC {sortIcon('ACTIVAS', 'conc_gral')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'porc_conc_5_Tot')} title="Concreción Ult 5" style={thStyle}>CCC ult 5 {sortIcon('ACTIVAS', 'porc_conc_5_Tot')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'st.razon_social')} style={thStyle}>Razon social {sortIcon('ACTIVAS', 'st.razon_social')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'st.cuit')} style={thStyle}>CUIT {sortIcon('ACTIVAS', 'st.cuit')}</th>
                            <th>Libre</th>
                            <th onClick={() => handleSort('ACTIVAS', 'fecha_creacion')} style={thStyle}>Fecha creación {sortIcon('ACTIVAS', 'fecha_creacion')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'ult_ingreso')} style={thStyle}>Últ. ingreso {sortIcon('ACTIVAS', 'ult_ingreso')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'q_usuarios')} style={thStyle}>Q usuarios {sortIcon('ACTIVAS', 'q_usuarios')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'prov_est_bc')} style={thStyle}>Provincia {sortIcon('ACTIVAS', 'prov_est_bc')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'part_est_bc')} style={thStyle}>Partido {sortIcon('ACTIVAS', 'part_est_bc')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'asociado_comercial')} style={thStyle}>AC {sortIcon('ACTIVAS', 'asociado_comercial')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'representante')} style={thStyle}>Rep {sortIcon('ACTIVAS', 'representante')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'operador')} style={thStyle}>Operador {sortIcon('ACTIVAS', 'operador')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'sugerido_ci_faena')} style={thStyle}>CI Fae {sortIcon('ACTIVAS', 'sugerido_ci_faena')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'sugerido_ci_invernada')} style={thStyle}>CI Inv {sortIcon('ACTIVAS', 'sugerido_ci_invernada')}</th>
                            <th>Credito</th>
                            <th onClick={() => handleSort('ACTIVAS', 'Ult_op')} style={thStyle}>FUOp {sortIcon('ACTIVAS', 'Ult_op')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'Ult_act')} style={thStyle}>FUAct {sortIcon('ACTIVAS', 'Ult_act')}</th>
                            
                            <th style={{background: '#dbeafe'}}>Q total OP</th>
                            <th onClick={() => handleSort('ACTIVAS', 'q_ofrec_fae')} style={{...thStyle, background: '#dbeafe'}}>OFR {sortIcon('ACTIVAS', 'q_ofrec_fae')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'q_ventas_fae')} style={{...thStyle, background: '#dbeafe'}}>VEN {sortIcon('ACTIVAS', 'q_ventas_fae')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'q_compras_fae')} style={{...thStyle, background: '#dbeafe'}}>COMP {sortIcon('ACTIVAS', 'q_compras_fae')}</th>
                            
                            <th style={{background: '#fee2e2'}}>Q total op</th>
                            <th onClick={() => handleSort('ACTIVAS', 'q_ofrec_inv')} style={{...thStyle, background: '#fee2e2'}}>OFR {sortIcon('ACTIVAS', 'q_ofrec_inv')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'q_ventas_inv')} style={{...thStyle, background: '#fee2e2'}}>VEN {sortIcon('ACTIVAS', 'q_ventas_inv')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'q_compras_inv')} style={{...thStyle, background: '#fee2e2'}}>COMP {sortIcon('ACTIVAS', 'q_compras_inv')}</th>
                            
                            <th onClick={() => handleSort('ACTIVAS', 'q_ofrec_cria')} style={{...thStyle, background: '#fef3c7'}}>OFR {sortIcon('ACTIVAS', 'q_ofrec_cria')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'q_ventas_cria')} style={{...thStyle, background: '#fef3c7'}}>VEND {sortIcon('ACTIVAS', 'q_ventas_cria')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'FUV_cria')} style={{...thStyle, background: '#fef3c7'}}>FUV {sortIcon('ACTIVAS', 'FUV_cria')}</th>
                            <th onClick={() => handleSort('ACTIVAS', 'q_compras_cria')} style={{...thStyle, background: '#fef3c7'}}>COMP {sortIcon('ACTIVAS', 'q_compras_cria')}</th>
                            
                            <th style={{background: '#f3f4f6'}}>Dir. FIscal (Prov)</th>
                            <th style={{background: '#f3f4f6'}}>Dir. FIscal (Part)</th>
                            <th style={{background: '#f3f4f6'}}>Dir. Establecimiento (Prov)</th>
                            <th style={{background: '#f3f4f6'}}>Dir. Establecimiento (Part)</th>
                          </tr>
                        </thead>
                        <tbody style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                          {getSortedData(tables.dt189, 'ACTIVAS').slice(0, visibleCountACTIVAS).map((row, i) => {
                            const rawBov = Number(row.total_bovinos || 0);
                            const totalK = rawBov >= 1000 ? (rawBov/1000).toFixed(1) + 'k' : rawBov;
                            
                            const rawVacas = Number(row.total_vacas || 0);
                            const vacaK = rawVacas >= 1000 ? (rawVacas/1000).toFixed(1) + 'k' : rawVacas;
                            
                            const getFormatStyle = (val) => {
                              if (!val || val < 1) return { background: '#f8fafc', color: '#94a3b8' };
                              if (val <= 500) return { background: '#eb9b9e', color: '#000' };
                              if (val <= 1000) return { background: '#b86407', color: '#fff' };
                              if (val <= 5000) return { background: '#cccccc', color: '#000' };
                              if (val <= 10000) return { background: '#eaaa20', color: '#000' };
                              return { background: '#000000', color: '#f59e0b' }; 
                            };
                            
                            const totalStyle = getFormatStyle(rawBov);
                            const vacasStyle = getFormatStyle(rawVacas);
                            
                            const ccc = row.conc_gral ? (Number(row.conc_gral) * 100).toFixed(0) + '%' : '-';
                            const cccU5 = row.porc_conc_5_Tot ? (Number(row.porc_conc_5_Tot) * 100).toFixed(0) + '%' : '-';
                            const esLibre = (!row.asociado_comercial && !row.representante) ? 'SI' : 'NO';
                            const fCreacion = row.fecha_creacion ? new Date(row.fecha_creacion).toLocaleDateString('es-AR') : '-';
                            const uIngreso = row.ult_ingreso ? new Date(row.ult_ingreso).toLocaleDateString('es-AR') : '-';
                            const fuOp = row.Ult_op ? new Date(row.Ult_op).toLocaleDateString('es-AR') : '-';
                            const fuAct = row.Ult_act ? new Date(row.Ult_act).toLocaleDateString('es-AR') : '-';
                            const fuvCria = row.FUV_cria ? new Date(row.FUV_cria).toLocaleDateString('es-AR') : '-';
                            
                            const qOpFaena = (row.q_ofrec_fae || 0) + (row.q_ventas_fae || 0) + (row.q_compras_fae || 0);
                            const qOpInv = (row.q_ofrec_inv || 0) + (row.q_ventas_inv || 0) + (row.q_compras_inv || 0);
                            
                            return (
                              <tr key={i} style={row.esAmarilla ? {background: '#fefbeb'} : {}}>
                                <td style={{textAlign: 'center', fontWeight: 'bold', background: totalStyle.background, color: totalStyle.color}}>{totalK}</td>
                                <td style={{textAlign: 'center', fontWeight: 'bold', background: vacasStyle.background, color: vacasStyle.color}}>{vacaK}</td>
                                <td>-</td>
                                <td><div className="metric">{ccc}</div></td>
                                <td><div className="metric" style={{color: '#6366f1'}}>{cccU5}</div></td>
                                <td>
                                    <div className="highlight" style={row.esAmarilla ? {color: '#92400e', fontWeight: 600} : {fontWeight: 600}}>
                                        {row['st.razon_social'] || row.razon_social_senasa || row.razon_social}
                                    </div>
                                </td>
                                <td><div className="metric">{row['st.cuit'] || row.cuit}</div></td>
                                <td><span className={`badge ${esLibre === 'SI' ? 'badge-yes' : 'badge-outline'}`} style={{fontSize: '9px'}}>{esLibre}</span></td>
                                <td>{fCreacion}</td>
                                <td>{uIngreso}</td>
                                <td>{row.q_usuarios || 0}</td>
                                <td>{row.prov_est_bc || row.prov_dcac || '-'}</td>
                                <td>{`${row.part_est_bc || row.part_dcac || ''} ${row.localidad_est ? '('+row.localidad_est+')' : ''}`.trim() || '-'}</td>
                                <td style={{fontWeight: 600, color: 'var(--accent)'}}>{row.asociado_comercial || '-'}</td>
                                <td style={{color: '#64748b'}}>{row.representante || '-'}</td>
                                <td>{row.operador || '-'}</td>
                                <td>{row.sugerido_ci_faena || 0}</td>
                                <td>{row.sugerido_ci_invernada || 0}</td>
                                <td>-</td>
                                <td>{fuOp}</td>
                                <td>{fuAct}</td>
                                
                                <td style={{background: '#eff6ff', fontWeight: 600}}>{qOpFaena}</td>
                                <td style={{background: '#eff6ff'}}>{row.q_ofrec_fae || 0}</td>
                                <td style={{background: '#eff6ff'}}>{row.q_ventas_fae || 0}</td>
                                <td style={{background: '#eff6ff'}}>{row.q_compras_fae || 0}</td>
                                
                                <td style={{background: '#fef2f2', fontWeight: 600}}>{qOpInv}</td>
                                <td style={{background: '#fef2f2'}}>{row.q_ofrec_inv || 0}</td>
                                <td style={{background: '#fef2f2'}}>{row.q_ventas_inv || 0}</td>
                                <td style={{background: '#fef2f2'}}>{row.q_compras_inv || 0}</td>
                                
                                <td style={{background: '#fffbeb'}}>{row.q_ofrec_cria || 0}</td>
                                <td style={{background: '#fffbeb'}}>{row.q_ventas_cria || 0}</td>
                                <td style={{background: '#fffbeb'}}>{fuvCria}</td>
                                <td style={{background: '#fffbeb'}}>{row.q_compras_cria || 0}</td>
                                
                                <td style={{background: '#f3f4f6'}}>{row.prov_fiscal_bc || ''}</td>
                                <td style={{background: '#f3f4f6'}}>{row.part_fiscal_bc || ''}</td>
                                <td style={{background: '#f3f4f6'}}>{row.prov_est_bc || ''}</td>
                                <td style={{background: '#f3f4f6'}}>{row.part_est_bc || row.localidad_est || ''}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {tables.dt189.length > visibleCountACTIVAS && (
                        <div style={{ padding: '1rem', textAlign: 'center', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                          <button onClick={() => setVisibleCountACTIVAS(prev => prev + 10)} style={{ padding: '0.5rem 1.5rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '20px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>
                            Cargar 10 más ↓
                          </button>
                        </div>
                    )}
                  </div>
                )}

                {activeTab === 'USUARIOS' && (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', background: '#f8fafc' }}>
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Directorio de Usuarios</h2>
                    </div>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                      <table>
                        <thead>
                          <tr>
                            <th onClick={() => handleSort('USUARIOS', 'nombre')} style={thStyle}>Cliente {sortIcon('USUARIOS', 'nombre')}</th>
                            <th onClick={() => handleSort('USUARIOS', 'telefono')} style={thStyle}>Contacto {sortIcon('USUARIOS', 'telefono')}</th>
                            <th onClick={() => handleSort('USUARIOS', 'ultimo_ingreso')} style={thStyle}>Último Ingreso {sortIcon('USUARIOS', 'ultimo_ingreso')}</th>
                            <th onClick={() => handleSort('USUARIOS', 'razon_social')} style={thStyle}>Sociedad / Vínculo {sortIcon('USUARIOS', 'razon_social')}</th>
                            <th>Status</th>
                           </tr>
                        </thead>
                        <tbody>
                          {getSortedData(tables.usuarios, 'USUARIOS').slice(0, visibleCountUSUARIOS).map((row, i) => (
                            <tr key={i}>
                              <td>
                                <div className="highlight">{row.nombre} {row.apellido}</div>
                                <div style={{fontSize: '0.8rem'}}>{row.username}</div>
                              </td>
                              <td>
                                <div>{row.telefono}</div>
                                <div style={{fontSize: '0.8rem', color: 'var(--accent)'}}>{row.mail_usuario || 'Sin Correo'}</div>
                              </td>
                              <td>
                                 <div className="metric">
                                   {(!row.ultimo_ingreso || row.ultimo_ingreso === '0000-00-00 00:00:00') ? 'NUNCA' : new Date(row.ultimo_ingreso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                                 </div>
                              </td>
                              <td>
                                <div className="highlight" style={{fontSize: '0.85rem'}}>{row.razon_social}</div>
                                <div className="metric">CUIT: {row.cuit_sociedad}</div>
                              </td>
                              <td>
                                <span className={`badge ${row.tiene_ac === '1' ? 'badge-yes' : 'badge-outline'}`}>
                                  {row.tiene_ac === '1' ? 'CON AC' : 'SIN AC'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {tables.usuarios.length > visibleCountUSUARIOS && (
                        <div style={{ padding: '1rem', textAlign: 'center', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                          <button onClick={() => setVisibleCountUSUARIOS(prev => prev + 10)} style={{ padding: '0.5rem 1.5rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '20px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>
                            Cargar 10 más ↓
                          </button>
                        </div>
                    )}
                  </div>
                )}
             </>
          )}

        </div>

        {/* SOLAPA MAPA */}
        {activeTab === 'MAPA' && (
          <Suspense fallback={<div style={{padding:'4rem',textAlign:'center',color:'#888'}}>Cargando mapa…</div>}>
            <MapaTab
              data188={data188}
              data189={data189}
              selectedDeptos={selectedDeptos}
              onDeptoFilter={setSelectedDeptos}
            />
          </Suspense>
        )}

        {/* SOLAPA CUENTAS */}
        {activeTab === 'CUENTAS' && (
          <Suspense fallback={<div style={{padding:'4rem',textAlign:'center',color:'#888'}}>Cargando cuentas…</div>}>
            <CuentasTab data188={data188} data189={data189} />
          </Suspense>
        )}

      </div>

      {showGlosario && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
           <div style={{background: '#fff', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto'}}>
              <h2 style={{fontSize: '1.5rem', marginBottom: '1rem', color: '#0f172a'}}>📖 Glosario & Criterios</h2>
              
              <h3 style={{fontSize: '1.1rem', color: '#1e293b', marginTop: '1.5rem', marginBottom: '0.5rem'}}>Funnel Sociedades (Q188)</h3>
              <p style={{fontSize: '13px', color: '#475569', marginBottom: '0.5rem'}}>
                <strong>Agrupación por Departamento:</strong> Las sociedades provenientes de la Base Clave de Senasa se agrupan en base a su establecimiento principal (el que más capacidad de cabezas reporta).
              </p>
              <p style={{fontSize: '13px', color: '#475569', marginBottom: '0.5rem'}}>
                <strong>Sociedades dCaC:</strong> Se utiliza el número CUIT para intentar determinar cuántas de esas productoras Senasa están efectivamente registradas en dCaC, para calcular el grado de penetración de mercado de cada departamento geoespacial.
              </p>
              <p style={{fontSize: '13px', color: '#475569', marginBottom: '0.5rem'}}>
                <strong>Cabezas Operadas dCaC:</strong> Representa una sumatoria del total de cabezas operadas (Compras y Ventas de Inverna y Faena sumadas) para cada sociedad a lo largo de nuestro historial.
              </p>
              
              <h3 style={{fontSize: '1.1rem', color: '#1e293b', marginTop: '1.5rem', marginBottom: '0.5rem'}}>Sociedades en dCaC (Q189)</h3>
              <p style={{fontSize: '13px', color: '#475569', marginBottom: '0.5rem'}}>
                <strong>CCC (Concreción General):</strong> Porcentaje que mide el nivel de concreción: % de operaciones formalmente liquidadas ó concretadas por sobre las operaciones ingresadas como "No concretadas/Caídas". No incluye operaciones latentes.
              </p>
              <p style={{fontSize: '13px', color: '#475569', marginBottom: '0.5rem'}}>
                <strong>Candidatas "Amarillas":</strong> Son sociedades de dCaC inactvas y posiblemente abandonadas. Se etiquetan según dos criterios: que no hayan tenido actividad en el portal web (ni logins, ni posteos, ni miradas de negocio) por más de 15 meses; y que además NO tengan ni A.C mapeado ni Representante comercial interno.
              </p>
              
              <button 
                onClick={() => setShowGlosario(false)} 
                style={{width: '100%', marginTop: '2rem', padding: '0.8rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s', fontSize: '14px'}}>
                Entendido
              </button>
           </div>
        </div>
      )}

      {drilldownDep && (() => {
        const depRows = tables.dt188.filter(r => (String(r.partido_establecimiento_senasa || 'S/D')).toUpperCase() === drilldownDep);
        
        return (
          <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
           <div style={{background: '#fff', padding: '2rem', borderRadius: '12px', width: '95%', maxWidth: '1100px', maxHeight: '90vh', overflowY: 'auto'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem'}}>
                 <div>
                    <h2 style={{fontSize: '1.5rem', color: '#0f172a', margin: 0}}>Detalle del Departamento: {drilldownDep}</h2>
                    <p style={{margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '14px'}}>Listado de sociedades base en este departamento y su mapeo en la red comercial dCaC.</p>
                 </div>
                 <button onClick={() => setDrilldownDep(null)} style={{background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', transition: 'background 0.2s'}}>✕</button>
              </div>
              
              <div className="table-wrapper" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', margin: 0 }}>
                 <table>
                   <thead>
                     <tr>
                       <th>Sociedad (Razón Social)</th>
                       <th>CUIT</th>
                       <th>Cabezas Totales</th>
                       <th>Cabezas Vaca</th>
                       <th>Cuenta en dCaC</th>
                       <th>Cabezas Operadas dCaC</th>
                       <th>Fecha Últ. OP dCaC</th>
                     </tr>
                   </thead>
                   <tbody>
                     {depRows.map((r, i) => {
                        const cuit = String(r.cuit || r.cuit_titular_up || '').trim();
                        const dcacRow = data189 && data189.find(d => String(d.cuit || '').trim() === cuit);
                        const ultOp = dcacRow && dcacRow.Ult_op ? new Date(dcacRow.Ult_op).toLocaleDateString('es-AR') : '-';
                        const tieneCuenta = r.existe_en_dcac === 'SI';
                        
                        return (
                          <tr key={i} style={tieneCuenta ? {background: '#f0fdf4'} : {}}>
                            <td>
                              <div className="highlight">{r.razon_social_senasa || r.razon_social}</div>
                              {tieneCuenta && dcacRow && dcacRow.razon_social !== (r.razon_social_senasa || r.razon_social) && (
                                <div style={{fontSize: '11px', color: '#16a34a', marginTop: '4px'}}>dCaC: {dcacRow.razon_social}</div>
                              )}
                            </td>
                            <td><div className="metric">{cuit}</div></td>
                            <td><div className="metric">🐄 {Number(r.total_bovinos || 0).toLocaleString('es-AR')}</div></td>
                            <td><span style={{color: '#64748b', fontSize: '13px'}}>{Number(r.total_vacas || 0).toLocaleString('es-AR')}</span></td>
                            <td>
                              <span className={`badge ${tieneCuenta ? 'badge-yes' : 'badge-outline'}`} style={{fontSize: '10px', background: tieneCuenta ? '#16a34a' : 'transparent', color: tieneCuenta ? '#fff' : '#64748b'}}>
                                {tieneCuenta ? 'SÍ' : 'NO'}
                              </span>
                            </td>
                            <td>
                              {tieneCuenta && r.cabezas_operadas_dcac > 0 ? (
                                <div className="metric" style={{color: 'var(--accent)'}}>📈 {Number(r.cabezas_operadas_dcac || 0).toLocaleString('es-AR')}</div>
                              ) : (
                                <span style={{color: '#94a3b8'}}>-</span>
                              )}
                            </td>
                            <td>
                              <span style={{fontWeight: 500, color: ultOp !== '-' ? '#0f172a' : '#cbd5e1'}}>{ultOp}</span>
                            </td>
                          </tr>
                        );
                     })}
                   </tbody>
                 </table>
              </div>
           </div>
          </div>
        );
      })()}

    </div>
  );
}
