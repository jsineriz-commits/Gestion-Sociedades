// Diagnose bcLookup / nameToId sizes and check Q202 matches

function norm(name) {
  let s = String(name||'').replace(/([a-z])([A-Z])/g,'$1 $2');
  return s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\./g,' ')
    .replace(/\bGRAL\b/g,'GENERAL').replace(/\bCNEL\b/g,'CORONEL')
    .replace(/\bSTA\b/g,'SANTA').replace(/\bSTO\b/g,'SANTO')
    .replace(/\bTTE\b/g,'TENIENTE').replace(/\bPTE\b/g,'PRESIDENTE')
    .replace(/(\w+?)DEL\b/g,'$1 DEL')
    .replace(/(\w+?)DE\b/g,'$1 DE')
    .replace(/(\w+?)LAS\b/g,'$1 LAS')
    .replace(/(\w+?)LOS\b/g,'$1 LOS')
    .replace(/\s+/g,' ').trim();
}

async function main() {
  const [q202res, idsRes] = await Promise.all([
    fetch('https://metabase.dcac.ar/api/card/202/query/json', {
      method: 'POST',
      headers: { 'x-api-key': 'mb_OB8cA0XB9CFF8hy4eQFGGDtClBlqtkBIaz2I70Ry0tI=', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'parameters=[]'
    }).then(r=>r.json()),
    fetch('https://gestion-sociedades.vercel.app/api/depto-ids').then(r=>r.json()),
  ]);

  const rows = q202res;
  const { bcLookup, bcDeptOnly, nameToId } = idsRes;

  console.log('Q202 rows:', rows.length);
  console.log('bcLookup entries:', Object.keys(bcLookup||{}).length);
  console.log('bcDeptOnly entries:', Object.keys(bcDeptOnly||{}).length);
  console.log('nameToId entries:', Object.keys(nameToId||{}).length);
  console.log('');

  // Run the same logic as buildByDepto
  const m = {};
  let matchedBC = 0, matchedDept = 0, fallback = 0;

  rows.forEach(r => {
    const rawName = String(r.partido_domicilio_est || '').trim();
    const rawProv = String(r.provincia || '').trim();
    if (!rawName) return;

    const fullProv = rawProv; // Q202 has full province names
    const normKey  = norm(fullProv)+'|'+norm(rawName);
    const id = (bcLookup && bcLookup[normKey]) || (bcDeptOnly && bcDeptOnly[norm(rawName)]);
    const key = id ? String(id) : norm(rawName);

    if (bcLookup && bcLookup[normKey]) matchedBC++;
    else if (bcDeptOnly && bcDeptOnly[norm(rawName)]) matchedDept++;
    else { fallback++; }

    if (!m[key]) m[key] = [];
    m[key].push(rawName);
  });

  console.log('Matched via bcLookup:', matchedBC);
  console.log('Matched via bcDeptOnly:', matchedDept);
  console.log('Fallback norm(rawName):', fallback);
  console.log('Total unique keys in byDepto:', Object.keys(m).length);
  console.log('');

  // Show bcLookup sample keys
  const bcKeys = Object.keys(bcLookup||{}).slice(0,5);
  console.log('bcLookup sample keys:', bcKeys);

  // Show nameToId sample
  const ntKeys = Object.keys(nameToId||{}).slice(0,5);
  console.log('nameToId sample keys:', ntKeys);

  // Check a specific partido
  const testKey = norm('BUENOS AIRES')+'|'+norm('ADOLFO ALSINA');
  console.log('\nTest key "BUENOS AIRES|ADOLFO ALSINA":', testKey);
  console.log('  bcLookup match:', bcLookup?.[testKey]);
}

main().catch(console.error);
