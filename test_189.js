const fs = require('fs');
const dotenv = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(dotenv.split('\n').filter(l => l.includes('=')).map(l => {
  let [k, ...v] = l.split('=');
  return [k.trim(), v.join('=').trim().replace(/['"]/g, '')];
}));
fetch(env.METABASE_URL + '/api/card/189/query/json', {
  method: 'POST',
  headers: { 'X-API-Key': env.METABASE_API_KEY }
}).then(async r => {
  if (r.ok) {
     const j = await r.json();
     console.log('Q189 OK:', j.length);
  } else {
     console.log('Q189 FAIL:', await r.text());
  }
}).catch(console.error);
