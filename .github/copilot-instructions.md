# Copilot Instructions for mi-tablero-ganadero

## Project Overview

**mi-tablero-ganadero** is a Next.js dashboard for livestock/cattle consignment operations. It displays KPIs and operational data pulled from a Metabase BI instance.

**Tech Stack**:
- Next.js 16.1.6 (App Router), React 19, TypeScript, TailwindCSS 4
- Client/Server pattern: Frontend components → Next.js API route → External Metabase service

## Architecture

### Data Flow
1. **Frontend Components** (`components/`) call `getMetabaseCard(cardId)` from the client lib
2. **Client Lib** (`lib/metabase.ts`) makes HTTP requests to `/api/metabase?cardId=X`
3. **Server API Route** (`app/api/metabase/route.ts`) handles authentication:
   - Authenticates with Metabase using credentials from `.env.local` (METABASE_URL, METABASE_USERNAME, METABASE_PASSWORD)
   - Fetches card data using the session token
   - Returns JSON data to frontend
4. **Components** manage loading/error states and render using TailwindCSS

### Component Strategy
- **StatCard**: Reusable KPI display card with title, value, unit, icon, optional trend
- **MetabaseCard**: Generic wrapper for any Metabase card ID (handles loading/error)
- **DataTable**: Table display for structured data (columns, rows)
- **KPIsDashboard**: Complex client component using year/month cascading filters

## Key Patterns

### Cascading Filters (KPIsDashboard)
- Year selection → automatically populates available months from data
- Separate `useEffect` hooks: one for data fetch, one for year changes, one for KPI calculation
- Always select most recent year/first month as defaults
- Filter data dynamically in state without re-fetching

### Client vs Server Components
- Server components: `app/layout.tsx`, `app/page.tsx` (for metadata, initial layout)
- Client components: All feature components in `components/` (marked with `'use client'`)
- API route is the **only** place to expose Metabase credentials

### Error Handling Pattern
```tsx
const [error, setError] = useState<string | null>(null);
try {
  // fetch logic
  setError(null);
} catch (err: any) {
  setError(err.message || 'Error desconocido');
  console.error('Error:', err);
}
```

### Styling Conventions
- **Colors**: TailwindCSS palette (blue, green, red, purple, orange) - see `StatCard` color mapping
- **Layout**: 2-column grids for large screens, 1-column mobile (use `lg:` breakpoint)
- **Spacing**: Consistent `p-6`, `mb-6`, `gap-6` padding/margins
- **Loading states**: Always show `animate-pulse` skeleton with placeholder divs
- **Typography**: Use `text-lg`, `text-xl font-semibold` for headings consistently

### Spanish Language Constants
- Month names in `KPIsDashboard.meses` object mapped by month number
- Date formatting: `new Date().toLocaleDateString('es-AR', {...})` for Spanish Argentina locale
- UI text in Spanish: "Indicadores", "Operaciones", "Análisis Detallado"
- Emoji icons integrated in all section headings (🐄, 📊, 📈, etc.)

## Development Workflow

```bash
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

## Environment Setup

Create `.env.local` with Metabase credentials:
```
METABASE_URL=https://your-metabase-instance.com
METABASE_USERNAME=your_username
METABASE_PASSWORD=your_password
```

## When Adding Features

1. **New Metabase Card**: Add to `app/page.tsx` using `<MetabaseCard cardId={XXX} />`
2. **New KPI**: Add property to `KPIValue` interface in `KPIsDashboard`, update filter logic
3. **New Complex Component**: Use client component pattern with separate fetch/filter/render effects
4. **New Styling**: Follow TailwindCSS 4 (@tailwindcss/postcss), don't add custom CSS unless needed

## Common Pitfalls to Avoid

- **Do NOT** put Metabase auth logic in client components
- **Do NOT** hardcode cardIds in components without documenting which Metabase report it represents
- **Do NOT** use `generateStaticParams` or static rendering for data components (Metabase changes)
- **Do NOT** fetch Metabase data multiple times when data could be shared across components
- **Always** include error states - Metabase connections fail, show user-friendly messages
