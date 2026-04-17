const fs = require('fs');
const dotenv = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(dotenv.split('\n').filter(l => l.includes('=')).map(l => {
  let [k, ...v] = l.split('=');
  return [k.trim(), v.join('=').trim().replace(/['"]/g, '')];
}));

const exec = async (id) => {
  const r = await fetch(env.METABASE_URL + '/api/card/' + id + '/query/json', {
    method: 'POST',
    headers: { 'X-API-Key': env.METABASE_API_KEY }
  });
  const data = await r.json();
  if (data.length > 0) {
    console.log('CARD ' + id + ' keys:', Object.keys(data[0]).join(', '));
  } else {
    console.log('CARD ' + id + ' no data');
  }
};

(async () => {
   await exec(188);
   await exec(189);
   await exec(190);
})();
