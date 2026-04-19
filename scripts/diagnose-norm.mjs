// Diagnose why byDepto only has 33 unique keys from 339 Q202 rows

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
  // Fetch Q202
  const r = await fetch('https://metabase.dcac.ar/api/card/202/query/json', {
    method: 'POST',
    headers: { 'x-api-key': 'mb_OB8cA0XB9CFF8hy4eQFGGDtClBlqtkBIaz2I70Ry0tI=', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'parameters=[]'
  });
  const rows = await r.json();

  const keys = {};
  const damaged = [];

  rows.forEach(row => {
    const rawName = row.partido_domicilio_est || '';
    const rawProv = row.provincia || '';
    const normName = norm(rawName);
    const normKey  = norm(rawProv) + '|' + normName;

    if (normName !== rawName) damaged.push({ orig: rawName, normed: normName });

    if (!keys[normKey]) keys[normKey] = [];
    keys[normKey].push(rawName);
  });

  const collisions = Object.entries(keys).filter(([k,v]) => v.length > 1);

  console.log('Total rows:', rows.length);
  console.log('Unique keys:', Object.keys(keys).length);
  console.log('\nCollisions (keys with >1 row):');
  collisions.forEach(([k,v]) => console.log(' ', k, '->', v));
  console.log('\nNames changed by norm():');
  damaged.slice(0, 20).forEach(d => console.log(' ', JSON.stringify(d.orig), '->', JSON.stringify(d.normed)));
  console.log('Total name changes:', damaged.length);
}

main().catch(console.error);
