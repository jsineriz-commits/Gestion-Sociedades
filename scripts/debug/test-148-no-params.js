const url = 'https://metabase.dcac.ar';
fetch(url + '/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'sdewey@decampoacampo.com', password: 'Gallardo@25' })
})
.then(res => res.json())
.then(data => fetch(url + '/api/card/148/query/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': data.id },
    body: JSON.stringify({ parameters: [] })
}))
.then(r => r.json())
.then(json => {
    if(Array.isArray(json)) console.log('Without params returned:', json.length, 'rows');
    else console.log('Error/Response:', json);
})
.catch(console.error);
