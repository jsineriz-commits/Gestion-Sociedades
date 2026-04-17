const fs = require('fs');
const dotenv = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(dotenv.split('\n').filter(l => l.includes('=')).map(l => {
  let [k, ...v] = l.split('=');
  return [k.trim(), v.join('=').trim().replace(/['"]/g, '')];
}));
fetch(env.METABASE_URL + '/api/card/190/query/json', {
  method: 'POST',
  headers: { 'X-API-Key': env.METABASE_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ parameters: JSON.stringify([{ type: 'category', target: ['variable', ['template-tag', 'busqueda']], value: 'martin' }]) })
}).then(async r => {
  const data = await r.json();
  console.log('190 keys:', Object.keys(data[0] || {}).join(', '));
});
