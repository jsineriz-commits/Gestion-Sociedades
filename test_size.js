const fs = require('fs');
const dotenv = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(dotenv.split('\n').filter(l => l.includes('=')).map(l => {
  let [k, ...v] = l.split('=');
  return [k.trim(), v.join('=').trim().replace(/['"]/g, '')];
}));
fetch(env.METABASE_URL + '/api/card/188/query/json', {
  method: 'POST',
  headers: { 'X-API-Key': env.METABASE_API_KEY }
}).then(async r => {
  const text = await r.text();
  console.log('Q188 Size:', Math.round(text.length / 1024), 'KB');
}).catch(console.error);
