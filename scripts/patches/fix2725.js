const fs = require('fs');

// PATCH 1: Publicaciones.tsx
let pub = fs.readFileSync('components/Publicaciones.tsx', 'utf8');
const search = `    const recientes = useMemo(() => {
        let base = acFilter
            ? lotes.filter(l => {
                const norm = (s: string) => (s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
                const acFirstWord = norm(acFilter).split(' ')[0].trim();
                return norm(l.operador).includes(acFirstWord) || 
                       norm(l.representante).includes(acFirstWord) ||
                       norm(l.sociedad_vendedora).includes(acFirstWord);
            })
            : lotes;`;
const replace = `    const recientes = useMemo(() => {
        let base = lotes.filter(l => l.Estado_Pub === 'Publicado' || l.estado === 'Publicado' || l.activo === true || l.publicado === true || (!l.estado && !l.cierre));`;

if (pub.includes(search)) {
    pub = pub.replace(search, replace);
    fs.writeFileSync('components/Publicaciones.tsx', pub);
    console.log('Patch 1 OK');
} else {
    console.log('Patch 1 FAIL');
}

// PATCH 2: KPIsRio4.tsx
let kpi = fs.readFileSync('components/KPIsRio4.tsx', 'utf8');
const insert_kpi1 = `
    const normStr = (s: string) => (s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
    const acFirstWord = acFilter ? normStr(acFilter).split(' ')[0] : null;

    const isMiVenta = (o: any) => {
        if (!o.AC_Vend || String(o.AC_Vend).trim() === '') return false;
        if (!acFilter) return true;
        return normStr(o.AC_Vend).includes(acFirstWord!);
    };
    const isMiCompra = (o: any) => {
        if (!o.AC_Comp || String(o.AC_Comp).trim() === '') return false;
        if (!acFilter) return true;
        return normStr(o.AC_Comp).includes(acFirstWord!);
    };

    // ── KPIs ──────────────────────────────────────────────────────────────────
`;
if (!kpi.includes('isMiVenta = (o: any)')) {
    kpi = kpi.replace('// ── KPIs ──────────────────────────────────────────────────────────────────', insert_kpi1);
}

// Apply reductions correctly
kpi = kpi.replace(
    /const cbzsVenta  = concretadas\.filter\(o => o\.AC_Vend && String\(o\.AC_Vend\)\.trim\(\) !== ''\)\.reduce/g,
    'const cbzsVenta  = concretadas.filter(isMiVenta).reduce'
);
kpi = kpi.replace(
    /const cbzsCompra = concretadas\.filter\(o => o\.AC_Comp && String\(o\.AC_Comp\)\.trim\(\) !== ''\)\.reduce/g,
    'const cbzsCompra = concretadas.filter(isMiCompra).reduce'
);
kpi = kpi.replace(
    /const opsVenta   = concretadas\.filter\(o => o\.AC_Vend && String\(o\.AC_Vend\)\.trim\(\) !== ''\)\.length;/g,
    'const opsVenta   = concretadas.filter(isMiVenta).length;'
);
kpi = kpi.replace(
    /const opsCompra  = concretadas\.filter\(o => o\.AC_Comp && String\(o\.AC_Comp\)\.trim\(\) !== ''\)\.length;/g,
    'const opsCompra  = concretadas.filter(isMiCompra).length;'
);
kpi = kpi.replace(
    /const ventaOps  = concretadas\.filter\(\(o: any\) => o\.AC_Vend && String\(o\.AC_Vend\)\.trim\(\) !== ''\);/g,
    'const ventaOps  = concretadas.filter(isMiVenta);'
);
kpi = kpi.replace(
    /const compraOps = concretadas\.filter\(\(o: any\) => o\.AC_Comp && String\(o\.AC_Comp\)\.trim\(\) !== ''\);/g,
    'const compraOps = concretadas.filter(isMiCompra);'
);

// We need to do the same for sumImpVenta etc. Oh, wait, sumImpVenta uses ventaOps, which is already fixed!
//  const sumImpVenta  = ventaOps.reduce((s: number, o: any) => s + (o.importe_vendedor || 0), 0);
// It will now use the filtered ventaOps !! Yes!

fs.writeFileSync('components/KPIsRio4.tsx', kpi);
console.log('Patch 2 OK');
