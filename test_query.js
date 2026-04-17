const fs = require('fs');
const dotenv = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(dotenv.split('\n').filter(l => l.includes('=')).map(l => {
  let [k, ...v] = l.split('=');
  return [k.trim(), v.join('=').trim().replace(/['"]/g, '')];
}));

console.log('Querying: ' + env.METABASE_URL + '/api/card/' + (env.METABASE_CARD_ID || 188) + '/query/json');

fetch(env.METABASE_URL + '/api/card/' + (env.METABASE_CARD_ID || 188) + '/query/json', {
  method: 'POST',
  headers: {
    'X-API-Key': env.METABASE_API_KEY
  }
}).then(async r => {
   console.log('Status: ', r.status);
   if (!r.ok) {
      console.log('Error: ', await r.text());
   } else {
      console.log('Success!', (await r.json()).length, 'rows');
   }
}).catch(console.error);
