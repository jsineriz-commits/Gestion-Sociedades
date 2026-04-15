const url = 'https://metabase.dcac.ar';

fetch(`${url}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'sdewey@decampoacampo.com', password: 'Gallardo@25' })
})
.then(res => res.json().then(data => ({ status: res.status, data })))
.then(result => {
    console.log('Login result:', result);
    if(result.status === 200 && result.data.id) {
        return fetch(`${url}/api/card/148/query/json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': result.data.id },
            body: JSON.stringify({ parameters: [] })
        }).then(res => res.text().then(text => ({ status: res.status, text })));
    }
})
.then(res => {
    if(res) {
        console.log('Card 148 status:', res.status);
        console.log('Card 148 preview:', res.text.substring(0, 200));
    }
})
.catch(console.error);
