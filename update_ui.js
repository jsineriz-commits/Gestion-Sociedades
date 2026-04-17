const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'page.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add State Hooks
code = code.replace(
  "const [busquedaUsuarios, setBusquedaUsuarios] = useState('');",
  "const [busquedaUsuarios, setBusquedaUsuarios] = useState('');\n  const [filtroTextoGeneral, setFiltroTextoGeneral] = useState('');\n  const [visibleCountNODCAC, setVisibleCountNODCAC] = useState(20);\n  const [visibleCountACTIVAS, setVisibleCountACTIVAS] = useState(20);\n  const [visibleCountUSUARIOS, setVisibleCountUSUARIOS] = useState(20);"
);

// 2. Add 'filtroTextoGeneral' logic in useMemo
const filterLogic = `
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
`;
code = code.replace(
  "// TABLA 1: FUNNEL POR DEPARTAMENTO",
  filterLogic + "\n    // TABLA 1: FUNNEL POR DEPARTAMENTO"
);
code = code.replace("dataUsers, filtroPartido]", "dataUsers, filtroPartido, filtroTextoGeneral]");

// 3. Insert filter UI in Sidebar
const uiFilter = `
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '13px', color: '#475569' }}>Buscador General Frontend</p>
          <input 
            type="text"
            placeholder="Sociedad, CUIT, Nombre, Apellido..."
            value={filtroTextoGeneral}
            onChange={(e) => setFiltroTextoGeneral(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          />
        </div>
`;
code = code.replace(
  /<div style=\{\{ marginBottom: '1.5rem' \}\}>\s*<p style=\{\{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '13px', color: '#475569' \}\}>Búsqueda de Usuarios<\/p>/g,
  uiFilter + "\n        <div style={{ marginBottom: '1.5rem' }}>\n          <p style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '13px', color: '#475569' }}>Búsqueda de Usuarios Backend (Q190)</p>"
);

const loadMoreBtn = (tab) => \`
                      <div style={{ padding: '1rem', textAlign: 'center', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                          <button 
                            onClick={() => setVisibleCount\${tab}(prev => prev + 10)}
                            style={{ padding: '0.5rem 1.5rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '20px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}
                          >
                            Cargar 10 más ↓
                          </button>
                      </div>
\`;

// 4. Update NODCAC Rendering
code = code.replace(
  "{tables.dt188.map((row, i) => {",
  "{getSortedData(tables.dt188, 'NODCAC').slice(0, visibleCountNODCAC).map((row, i) => {"
);
code = code.replace(
  /<\/tbody>\s*<\/table>\s*<\/div>\s*<\/div>\s*\)\}/g,
  (match) => \`</tbody>
                      </table>
                    </div>
                    {tables.dt188.length > visibleCountNODCAC && (
\${loadMoreBtn('NODCAC')}
                    )}
                  </div>
                )}\`
);

// 5. Update ACTIVAS Rendering
code = code.replace(
  "{tables.dt189.map((row, i) => {",
  "{getSortedData(tables.dt189, 'ACTIVAS').slice(0, visibleCountACTIVAS).map((row, i) => {"
);

// This is tricky because the regex might match the wrong block.
// I'll be more specific for ACTIVAS:
code = code.replace(
  "                          })}",
  "                          })}"
);
// We'll just replace the exact end of ACTIVAS
const objEndActivas = \`                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
\`;
// Actually, I can use JS tools to insert the button for ACTIVAS.
code = code.replace(
  "                      </table>\\n                    </div>\\n                  </div>\\n                )}\\n\\n                {activeTab === 'USUARIOS'",
  "                      </table>\\n                    </div>\\n                    {tables.dt189.length > visibleCountACTIVAS && ( " + loadMoreBtn('ACTIVAS') + " )}                  </div>\\n                )}\\n\\n                {activeTab === 'USUARIOS'"
);

// 6. Update USUARIOS Rendering
code = code.replace(
  "{tables.usuarios.map((row, i) => (",
  "{getSortedData(tables.usuarios, 'USUARIOS').slice(0, visibleCountUSUARIOS).map((row, i) => ("
);
code = code.replace(
  "                      </table>\\n                    </div>\\n                  </div>\\n                )}\\n             </>\\n          )}",
  "                      </table>\\n                    </div>\\n                    {tables.usuarios.length > visibleCountUSUARIOS && ( " + loadMoreBtn('USUARIOS') + " )}                  </div>\\n                )}\\n             </>\\n          )}"
);

// 7. Map ALL headers of ACTIVAS for sorting
const activasHeaders = [
  ['Cabezas Totales (Miles)', 'K', 'total_bovinos'],
  ['Vientres (Miles)', 'Kv', 'total_vacas'],
  ['% Usuarios', '%U', 'q_usuarios'], // Just a placeholder field for %U for now
  ['Concreción General', 'CCC', 'conc_gral'],
  ['Concreción Ult 5', 'CCC ult 5', 'porc_conc_5_Tot'],
  ['Razon social', 'Razon social', 'razon_social'],
  ['CUIT', 'CUIT', 'cuit'],
  ['Libre', 'Libre', 'asociado_comercial'],
  ['Fecha creación', 'Fecha creación', 'fecha_creacion'],
  ['Últ. ingreso', 'Últ. ingreso', 'ult_ingreso'],
  ['Q usuarios', 'Q usuarios', 'q_usuarios'],
  ['Provincia', 'Provincia', 'prov_est_bc'],
  ['Partido', 'Partido', 'part_est_bc'],
  ['AC', 'AC', 'asociado_comercial'],
  ['Rep', 'Rep', 'representante'],
  ['Operador', 'Operador', 'operador'],
  ['CI Fae', 'CI Fae', 'sugerido_ci_faena'],
  ['CI Inv', 'CI Inv', 'sugerido_ci_invernada'],
  ['Credito', 'Credito', 'credito'],
  ['FUOp', 'FUOp', 'Ult_op'],
  ['FUAct', 'FUAct', 'Ult_act']
];

let hdrOriginal = \`                            <th title="Cabezas Totales (Miles)">K</th>
                            <th title="Vientres (Miles)">Kv</th>
                            <th title="% Usuarios">%U</th>
                            <th title="Concreción General">CCC</th>
                            <th title="Concreción Ult 5">CCC ult 5</th>
                            <th>Razon social</th>
                            <th>CUIT</th>
                            <th>Libre</th>
                            <th>Fecha creación</th>
                            <th>Últ. ingreso</th>
                            <th>Q usuarios</th>
                            <th>Provincia</th>
                            <th>Partido</th>
                            <th>AC</th>
                            <th>Rep</th>
                            <th>Operador</th>
                            <th>CI Fae</th>
                            <th>CI Inv</th>
                            <th>Credito</th>
                            <th>FUOp</th>
                            <th>FUAct</th>\`;

let hdrReplaced = activasHeaders.map(h => {
  return \`                            <th title="\${h[0]}" onClick={() => handleSort('ACTIVAS', '\${h[2]}')} style={thStyle}>\${h[1]} {sortIcon('ACTIVAS', '\${h[2]}')}</th>\`;
}).join('\\n');

code = code.replace(hdrOriginal, hdrReplaced);

fs.writeFileSync(filePath, code, 'utf8');
console.log("Update complete!");
