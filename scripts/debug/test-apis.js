const http = require('http');

const tests = [
  { name: 'Admin', path: '/api/rio4?isAdmin=true' },
  { name: 'Regional (Agustin Acuna)', path: '/api/rio4?acId=20128&acName=Agustin%20Acuna&canal=Regional' },
  { name: 'Oficina (Rio 4to)', path: '/api/rio4?acId=696&acName=Oficina%20Rio%204to&canal=Oficina' },
  { name: 'Representante (Agustin Irastorza)', path: '/api/rio4?acId=77728&acName=Agustin%20Irastorza&canal=Representante' },
  { name: 'Comisionista (Adolfo Ochoa)', path: '/api/rio4?acId=2311&acName=Adolfo%20Ochoa&canal=Comisionista' },
  
  // Also test tropas
  { name: 'Tropas Admin', path: '/api/rio4/tropas?isAdmin=true' },
  { name: 'Tropas Regional', path: '/api/rio4/tropas?acId=20128&acName=Agustin%20Acuna&canal=Regional' },
];

function fetchPath(t) {
  return new Promise((resolve) => {
    http.get('http://localhost:3000' + t.path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
              console.log(`${t.name}: ERROR ${json.error}`);
          } else {
              if (json.tropas) {
                  console.log(`${t.name}: ${json.tropas.length} tropas (total=${json.total})`);
              } else {
                  console.log(`${t.name}: ${json.lotes?.length || 0} lotes, ${json.opsOficina?.length || 0} opsOficina`);
              }
          }
        } catch(e) {
          console.log(`${t.name}: PARSE ERROR ${e.message}. Status=${res.statusCode}`);
        }
        resolve();
      });
    }).on('error', (e) => {
      console.log(`${t.name}: REQ ERROR ${e.message}`);
      resolve();
    });
  });
}

(async () => {
    console.log("Starting tests...");
    for (const t of tests) {
        await fetchPath(t);
    }
    console.log("Done");
})();
