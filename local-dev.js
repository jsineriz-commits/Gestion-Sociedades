const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const fs = require('fs');
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(__dirname));

const endpoints = fs.readdirSync(path.join(__dirname, 'api')).filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''));
endpoints.forEach(ep => {
  app.all('/api/' + ep, async (req, res) => {
    try {
      const handler = require('./api/' + ep + '.js');
      await handler(req, res);
    } catch (e) {
      console.error('[Local Dev] Error en API:', e);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });
});

app.listen(3000, () => {
  console.log('✅ Local Server running on http://localhost:3000/');
  // Precalentar el caché de Metabase en segundo plano para que el primer request del browser sea rápido
  const { fetchMetabaseQuery } = require('./api/_lib/metabase');
  console.log('[warmup] Precargando Q188 + Q189 de Metabase...');
  fetchMetabaseQuery(188)
    .then(() => {
      console.log('[warmup] Q188 en caché ✓');
      return fetchMetabaseQuery(189);
    })
    .then(() => console.log('[warmup] ✅ Q188 + Q189 precargadas. El dashboard cargará al instante.'))
    .catch(e => console.error('[warmup] Error precargando:', e.message));
});
