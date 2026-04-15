const http = require('http');
fetch('http://localhost:3000/api/rio4/tropas')
  .then(res => res.text())
  .then(console.log)
  .catch(console.error);
