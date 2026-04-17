const fs = require('fs');
let code = fs.readFileSync('app/page.js', 'utf8');

// ACTIVAS (Q189 fixes)
code = code.replace(/handleSort\('ACTIVAS', 'razon_social'\)/g, "handleSort('ACTIVAS', 'st.razon_social')");
code = code.replace(/sortIcon\('ACTIVAS', 'razon_social'\)/g, "sortIcon('ACTIVAS', 'st.razon_social')");
code = code.replace(/handleSort\('ACTIVAS', 'cuit'\)/g, "handleSort('ACTIVAS', 'st.cuit')");
code = code.replace(/sortIcon\('ACTIVAS', 'cuit'\)/g, "sortIcon('ACTIVAS', 'st.cuit')");

// NODCAC (Q188 fixes)
// the rendering has to use row.razon_social_senasa alongside st.razon_social and razon_social
code = code.replace(/{row\['st.razon_social'\] \|\| row.razon_social}/g, "{row['st.razon_social'] || row.razon_social_senasa || row.razon_social}");
// provincia should sort by prov_establecimiento_senasa
code = code.replace(/handleSort\('NODCAC', 'provincia'\)/g, "handleSort('NODCAC', 'prov_establecimiento_senasa')");
code = code.replace(/sortIcon\('NODCAC', 'provincia'\)/g, "sortIcon('NODCAC', 'prov_establecimiento_senasa')");

fs.writeFileSync('app/page.js', code, 'utf8');
console.log('Fixes applied successfully to app/page.js');
