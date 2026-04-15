# CONTEXT.md — Tablero Ganadero De Campo a Campo

> **Propósito**: Este archivo es el contexto principal para asistentes de IA (Cursor, Copilot, Claude, etc.).

---

## 1. 🐄 Visión General del Proyecto

**Nombre interno**: `mi-tablero-ganadero`  
**Empresa**: De Campo a Campo (Consignataria de hacienda, Río Cuarto, Argentina)

### Problema que resuelve
Los Asociados Comerciales (ACs) y la gerencia necesitan visibilidad en tiempo real de KPIs operativos de consignación de hacienda: volumen de cabezas, rendimiento por lote, performance por Unidad de Negocio (UN) y métricas regionales, sin depender de reportes manuales en Excel.

### Qué hace
- Dashboard privado con autenticación Google (dominio `@decampoacampo.com`)
- Cada AC ve **sus propios datos** filtrados por su ID de operador en Metabase
- Admins ven **todos los datos** y pueden simular la vista de cualquier AC (`?preview=email`)
- Datos extraídos en tiempo real desde **Metabase** (BI) y **Google Sheets** (datos externos como SAC)
- Incluye una vista de **Insights** (análisis agregado) y funcionalidades de **Leads/Tareas** que escriben a Google Sheets

### Público objetivo
- **ACs (Asociados Comerciales)**: Vista de sus propias métricas
- **Administradores / Gerencia**: Vista global y herramientas de análisis
- **Uso interno exclusivo**: No es una app pública

---

## 2. 🛠️ Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | `16.1.6` |
| Runtime UI | React | `19.2.3` |
| Lenguaje | TypeScript (strict) | `^5` |
| Estilos | TailwindCSS | `^4` (vía `@tailwindcss/postcss`) |
| Gráficos | Recharts | `^3.8.0` |
| Autenticación | NextAuth.js | `^4.24.13` (Google OAuth) |
| BI / Datos | Metabase | API REST + autenticación por sesión |
| Datos externos | Google Sheets | `googleapis@144.0.0` |
| Storage | Vercel Blob | `^2.3.1` |
| Utilidades | `lodash.memoize` | `^4.1.2` |
| Linter | ESLint | `^9` (config `eslint-config-next`) |
| Deploy | Vercel | (producción) |

### Variables de entorno obligatorias (`.env.local`)
```
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
METABASE_URL=
METABASE_USERNAME=
METABASE_PASSWORD=
GOOGLE_SERVICE_ACCOUNT_JSON=   # JSON del service account para Sheets
BLOB_READ_WRITE_TOKEN=         # Vercel Blob token
```

---

## 3. 🗂️ Arquitectura y Estructura de Directorios

```
dashboard-decampoacampo/
│
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (fuentes, providers)
│   ├── page.tsx                  # Dashboard principal (Server Component, carga inicial SSR)
│   ├── loading.tsx               # Skeleton global (CowLoader)
│   ├── providers.tsx             # SessionProvider de NextAuth
│   ├── globals.css               # Variables CSS globales y base styles
│   │
│   ├── insights/                 # Ruta /insights — vista de análisis agregado
│   │   └── page.tsx
│   │
│   ├── login/                    # Ruta /login — pantalla de auth
│   │
│   └── api/                      # Route Handlers (servidor)
│       ├── auth/[...nextauth]/   # NextAuth — Google OAuth
│       ├── metabase/             # Proxy hacia Metabase (autentica con session token)
│       ├── regional/             # Endpoint principal de datos del dashboard
│       ├── ci-detail/            # Detalle de un CI/Lote específico
│       ├── ofertas/              # Datos de ofertas
│       ├── monitor-ofertas/      # Monitor en tiempo real de ofertas
│       ├── notificaciones/       # Sistema de notificaciones
│       ├── cron/                 # Jobs programados (Vercel Cron)
│       └── debug/                # Endpoints de diagnóstico (no exponer en producción)
│
├── components/                   # Componentes React ('use client')
│   ├── dashboard/                # Componentes del dashboard principal
│   │   ├── DashboardClient.tsx   # Shell principal: maneja tabs, filtros globales, contexto
│   │   ├── EstadoTropas.tsx      # Vista de lotes/tropas y su estado
│   │   ├── KPIsRegional.tsx      # KPIs con filtros de año/mes y por AC
│   │   ├── EvolucionAnual.tsx    # Gráfico de evolución anual de operaciones
│   │   ├── MonitorCIs.tsx        # Monitor de CIs (contratos de compraventa)
│   │   ├── PagosPanel.tsx        # Panel de pagos pendientes/realizados
│   │   ├── NoConcretadasPanel.tsx # Operaciones no concretadas
│   │   └── NotificationCenter.tsx # Centro de notificaciones
│   │
│   ├── analisis/                 # Componentes de la vista /insights
│   │   ├── InsightsClient.tsx    # Shell de insights
│   │   ├── MercadoInsights.tsx   # Tendencias de mercado
│   │   ├── OperacionesRegional.tsx # Operaciones por región
│   │   ├── RankingAC.tsx         # Ranking de Asociados Comerciales
│   │   └── TopSociedades.tsx     # Top Ranking de Sociedades (con datos SAC)
│   │
│   ├── admin/                    # Componentes de administración
│   ├── publicaciones/            # Componentes de publicaciones/leads
│   │
│   └── ui/                       # Componentes UI genéricos reutilizables
│       ├── CowLoader.tsx         # Loader animado temático
│       ├── DetailPanel.tsx       # Panel de detalle deslizable
│       └── InfoTooltip.tsx       # Tooltip informativo
│
├── lib/                          # Lógica de negocio y utilidades (sin UI)
│   ├── api/
│   │   ├── metabase.ts           # Cliente Metabase para llamadas desde el browser
│   │   └── metabase-server.ts    # Cliente Metabase para llamadas server-side
│   │
│   ├── data/                     # Datos estáticos y constantes del dominio
│   │   ├── constants.ts          # AcDef, TODOS_LOS_USUARIOS, ADMIN_EMAILS, UN_LIST
│   │   ├── usuarios.ts           # Definición de todos los usuarios del sistema
│   │   ├── targets.ts            # Metas/objetivos por AC y período
│   │   └── comerciales.ts        # Lógica de datos comerciales
│   │
│   └── utils/                    # Funciones utilitarias puras
│       ├── estados.ts            # Mapeo de estados de lotes/CIs
│       ├── regional-data.ts      # Transformaciones de datos regionales
│       ├── snapshot.ts           # Lógica de snapshots de datos
│       ├── timeUtils.ts          # Helpers de fechas
│       └── unColors.ts           # Mapeo de colores por Unidad de Negocio
│
├── data/                         # Datos estáticos de referencia (JSON, CSV)
├── scripts/                      # Scripts de mantenimiento / migración
├── public/                       # Assets estáticos
├── middleware.ts                  # Auth guard: protege `/` y `/api/regional`
├── next.config.ts
├── tsconfig.json
├── CLAUDE.md                     # Instrucciones de workflow para Claude AI
└── CONTEXT.md                    # ← Este archivo
```

### Flujo de datos principal
```
Browser → DashboardClient (Client Component)
       → /api/regional (Route Handler, Server)
       → Metabase API (autenticado con session token)
       → Google Sheets API (service account)
       → Datos transformados → Estado del componente → Render
```

---

## 4. 📐 Reglas y Convenciones de Código

### Lenguaje y tipos
- **Usa TypeScript estricto siempre** (`strict: true` en `tsconfig.json`)
- **No uses `any`** salvo en casos extremos documentados con un comentario explicando por qué
- Define interfaces explícitas para todos los datos de Metabase/Sheets antes de usarlos
- Usa `type` para uniones/aliases, usa `interface` para formas de objetos

### Nombrado
- **Componentes React**: `PascalCase` — `DashboardClient.tsx`, `KPIsRegional.tsx`
- **Funciones y variables**: `camelCase` — `getMetabaseCard()`, `acByEmail`
- **Constantes globales**: `SCREAMING_SNAKE_CASE` — `ADMIN_EMAILS`, `UN_LIST`, `OFICINA_ID`
- **Archivos de utils/lib**: `camelCase` — `regional-data.ts`, `timeUtils.ts`
- **Rutas API**: `kebab-case` en carpetas — `app/api/ci-detail/`

### Paradigma
- Programación **funcional con hooks** para componentes React
- No uses **class components**
- Funciones puras para transformaciones de datos en `lib/utils/`
- Memoización con `useMemo` / `useCallback` / `lodash.memoize` para cálculos costosos

### Componentes
- **Todos los componentes en `components/`** son Client Components: inclúe `'use client'` al inicio
- **`app/page.tsx` y `app/layout.tsx`** son Server Components: **no agregar `'use client'`**
- Los Route Handlers (`app/api/**/route.ts`) corren en el servidor: **nunca expongas credenciales en `components/`**
- Un componente = un archivo. No exportes múltiples componentes por archivo

### Estado y datos
- El estado global de filtros vive en `DashboardClient.tsx` y se pasa como props
- No uses librerías de estado global (Zustand, Redux, Jotai) salvo aprobación explícita
- Usa `FilterContext` de React para pasar filtros globales a componentes descendientes
- Para fetching, usa `fetch` nativo con `async/await`; no uses SWR ni React Query

### Manejo de errores
```tsx
// Patrón estándar en todos los componentes con fetch
const [error, setError] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(true);

try {
  const data = await fetchSomething();
  setError(null);
} catch (err) {
  const message = err instanceof Error ? err.message : 'Error desconocido';
  setError(message);
  console.error('[NombreComponente]', err);
} finally {
  setIsLoading(false);
}
```
- **Siempre** muestra un estado de error visible al usuario (no solo `console.error`)
- **Siempre** muestra un skeleton de carga mientras se esperan datos
- Usa `AbortController` + `setTimeout` para timeouts en fetch críticos (ver `app/page.tsx`)

### Metabase
- **Nunca llames a Metabase directamente desde un Client Component**
- Toda llamada a Metabase pasa por `/api/metabase` (Route Handler servidor)
- Referencia siempre el número de Card ID con un comentario: `// Metabase Card #95: Rendimiento por lote`
- Los datos de Metabase se reciben como arrays de objetos; transforma con funciones en `lib/utils/`

### Estilos (TailwindCSS 4)
- Usa **exclusivamente TailwindCSS**; no escribas CSS personalizado salvo en `globals.css`
- Usa breakpoint `lg:` para layouts de 2 columnas (mobile-first)
- Paleta de colores por AC: definida en `constants.ts` (no hardcodees colores por AC en componentes)
- Paleta de colores por UN: `unColors.ts` — usa siempre `getUNColor(un)`
- Espaciado consistente: `p-4`, `p-6`, `gap-4`, `gap-6`
- Estados de carga: `animate-pulse` con divs placeholder

### Internacionalización
- Toda la UI está **en español argentino**
- Fechas: `new Date().toLocaleDateString('es-AR', { ... })`
- Meses en español: usar el mapeo definido en los componentes (no `Intl` directo)
- Números monetarios: formato argentino (`#.###,##`)

---

## 5. 🧪 Testing

> ⚠️ **Ver sección "Información Faltante"** — no hay suite de tests configurada actualmente.

### Estado actual
- No existe configuración de Jest, Vitest, Playwright ni Testing Library
- No hay archivos `.test.ts` ni `.spec.ts` en el repositorio

### Si se agrega testing (recomendado)
- Usa **Vitest** (compatible con Vite/Next.js moderno)
- Para componentes: **React Testing Library**
- Para E2E: **Playwright**
- Ubica tests junto al archivo que prueban: `ComponenteX.test.tsx` al lado de `ComponenteX.tsx`
- Mínimo de cobertura a definir: **pendiente de decisión del equipo**

---

## 6. 🔀 Flujo de Trabajo (Git / CI-CD)

### Commits
- Usa **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Ejemplos:
  - `feat(kpis): add rendimiento filter by AC`
  - `fix(metabase): handle timeout on card 95`
  - `chore(deps): update recharts to 3.8.0`
- Escribe el mensaje en **inglés** (el cuerpo del commit puede ser en español si es necesario)

### Estrategia de ramas
```
main          → producción (Vercel auto-deploy)
feature/*     → nuevas funcionalidades
fix/*         → correcciones de bugs
chore/*       → mantenimiento, deps, refactor
```
- **No hagas push directo a `main`** sin revisión
- Crea PRs para cambios de más de 20 líneas

### CI/CD
- Deploy automático en **Vercel** al hacer merge a `main`
- No hay pipeline de GitHub Actions configurado para tests actualmente
- Variables de entorno de producción configuradas en Vercel Dashboard

### Variables de entorno
- `.env.local` para desarrollo local (nunca committear, está en `.gitignore`)
- Producción: configuradas directamente en Vercel
- Si agregas una nueva variable de entorno, documentarla en este archivo (sección 2)

---

## 7. 🏗️ Dominio de Negocio (Glosario)

Conoce estos términos antes de tocar el código:

| Término | Significado |
|---|---|
| **AC** | Asociado Comercial (vendedor/operador) |
| **CI** | Compra inmediata ofrecida a una sociedad compradora |
| **Lote / Tropa** | Grupo de animales en una operación |
| **UN** | Unidad de Negocio: `Faena`, `Invernada`, `Cría`, `MAG` |
| **Rendimiento** | Rendimiento financiero o economico del lote (ya viene como % desde Metabase) |
| **CCC%** | Porcentaje de cabezas concretadas |
| **SAC** | Sistema de Aprobación de Créditos (datos en Google Sheets) |
| **NOSIS / FACT / JD** | Campos de aprobación crediticia del sistema SAC |
| **Sociedad** | Empresa/persona jurídica que compra o vende hacienda |
| **Vendedor / Comprador** | Rol en la operación (toggle en muchas vistas) |
| **Oficina Río 4to** | Oficina principal, `OFICINA_ID = 696` en Metabase |
| **Motivo de Asignación** | Razón por la que un lead fue asignado a un AC |
