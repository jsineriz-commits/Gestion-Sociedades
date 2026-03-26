# Territorio AC — Migración Apps Script → Vercel

## Estructura del proyecto

```
/
├── api/
│   ├── _lib/
│   │   ├── sheets.js          ← Auth Google Sheets API + helper de acceso
│   │   ├── cache.js           ← Cache en memoria (reemplaza CacheService)
│   │   └── logic.js           ← Toda la lógica de negocio
│   ├── getACs.js              ← GET /api/getACs
│   ├── getTerritoryData.js    ← GET /api/getTerritoryData?ac=...
│   ├── getDashboardData.js    ← GET /api/getDashboardData?email=...&ac=...
│   ├── invalidateCache.js     ← POST /api/invalidateCache
│   └── getDeptoGeoJSON.js     ← GET /api/getDeptoGeoJSON
├── public/
│   └── index.html             ← Frontend (sin cambios visuales)
├── package.json
├── vercel.json
└── .env.example
```

## Setup

### 1. Service Account de Google

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un proyecto (o usar uno existente)
3. Activar la **Google Sheets API**
4. Crear una **Service Account** en IAM → Service Accounts
5. Generar una clave JSON para esa service account
6. **Compartir la Google Sheet** con el email de la service account (solo lectura)

### 2. Variables de entorno en Vercel

En Vercel Dashboard → tu proyecto → Settings → Environment Variables:

| Variable | Valor |
|----------|-------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | El JSON completo de la clave (en una sola línea) |

### 3. Deploy

```bash
# Instalar Vercel CLI
npm i -g vercel

# Desde la carpeta del proyecto
vercel

# O conectar el repo en vercel.com y hacer push
```

### 4. Desarrollo local

```bash
npm install
cp .env.example .env.local
# Editar .env.local con el JSON real de la service account
vercel dev
```

## Diferencias con Apps Script

| Apps Script | Vercel/Node |
|------------|-------------|
| `SpreadsheetApp.openById()` | `googleapis` con Service Account |
| `CacheService` | Cache en memoria (módulo Node) |
| `Session.getActiveUser()` | Parámetro `email` en query string |
| `google.script.run` | `fetch('/api/...')` |
| `UrlFetchApp.fetch()` | `fetch()` nativo (Node 18) |

## Notas sobre el caché

El caché en memoria persiste entre invocaciones "calientes" de la misma instancia Vercel.
En cold starts se regenera automáticamente. Para producción con mucho tráfico,
considerar reemplazar `api/_lib/cache.js` con [Upstash Redis](https://upstash.com/).
