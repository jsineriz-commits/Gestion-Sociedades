const BASE = 'http://localhost:3000';
const hoy = new Date().toISOString().split('T')[0];
const desde = new Date().getFullYear() + '-01-01';

async function test(label, params) {
  const url = `${BASE}/api/rio4/tropas?${new URLSearchParams(params)}`;
  const t0 = Date.now();
  const r = await fetch(url);
  const d = await r.json();
  const t = d.tropas || [];
  const cab = t.reduce((s,x) => s+(Number(x.Cabezas)||0), 0);
  const acVends = [...new Set(t.map(x=>x.AC_Vend).filter(Boolean))].slice(0,4).join(', ');
  const reprVends = [...new Set(t.map(x=>x.repre_vendedor).filter(Boolean))].slice(0,4).join(', ');
  const canales = {};
  t.forEach(x => { const c = x.Canal_Venta||'?'; canales[c]=(canales[c]||0)+1; });
  console.log(`[${Date.now()-t0}ms] ${label}: ${t.length} tropas | ${cab.toLocaleString()} cab`);
  if(acVends) console.log(`  AC_Vend: ${acVends}`);
  if(reprVends) console.log(`  RepreVend: ${reprVends}`);
  console.log(`  Canal_Venta: ${Object.entries(canales).map(([k,v])=>k+'('+v+')').join(' | ')}`);
  console.log('');
}

(async()=>{
  console.log('=== VERIFICACION FIXES OFICINA + DIRECTO ===\n');
  await test('Oficina (canal completo)', { canal:'Oficina', fecha_desde:desde, fecha_hasta:hoy, isAdmin:'true' });
  await test('Directo (canal completo)', { canal:'Directo', fecha_desde:desde, fecha_hasta:hoy, isAdmin:'true' });
  await test('Oficina Rio 4to (especifico)', { canal:'Oficina', acName:'Oficina Rio 4to', fecha_desde:desde, fecha_hasta:hoy });
  await test('Oficina Entre Rios (especifico)', { canal:'Oficina', acName:'Oficina Entre Rios', fecha_desde:desde, fecha_hasta:hoy });
  await test('Alejandro Ballve (Representante especifico)', { canal:'Representante', acName:'Alejandro Ballve', fecha_desde:desde, fecha_hasta:hoy });
  await test('Martin Petricevich (Representante especifico)', { canal:'Representante', acName:'Martin Petricevich', fecha_desde:desde, fecha_hasta:hoy });
  await test('Jorge Torriglia (Comisionista especifico)', { canal:'Comisionista', acName:'Jorge Torriglia', fecha_desde:desde, fecha_hasta:hoy });
})().catch(console.error);
