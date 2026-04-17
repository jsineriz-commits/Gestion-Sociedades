const fs = require('fs');
const dotenv = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(dotenv.split('\n').filter(l => l.includes('=')).map(l => {
  let [k, ...v] = l.split('=');
  return [k.trim(), v.join('=').trim().replace(/['"]/g, '')];
}));

async function testQuery(id) {
  const start = Date.now();
  console.log('Querying CARD ' + id + '...');
  try {
    const r = await fetch(env.METABASE_URL + '/api/card/' + id + '/query/json', {
      method: 'POST',
      headers: { 'X-API-Key': env.METABASE_API_KEY }
    });
    console.log('CARD ' + id + ' Status:', r.status);
    if (!r.ok) {
      console.log('CARD ' + id + ' Error:', await r.text());
    } else {
      const data = await r.json();
      console.log('CARD ' + id + ' Success!', data.length, 'rows. Took: ' + (Date.now() - start) + 'ms');
    }
  } catch (e) {
    console.log('CARD ' + id + ' Fetch Exception:', e.message);
  }
}

async function run() {
  await testQuery(188);
  await testQuery(189);
}

run();
