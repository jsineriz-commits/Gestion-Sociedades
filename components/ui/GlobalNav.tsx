'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Design tokens DeCampoacampo
const T = {
  surfaceL2:      '#ffffff',
  brand:          '#3179a7',
  brandSubtle:    '#eaf2f6',
  contentTertiary:'#888888',
  borderTertiary: '#ededed',
} as const;

const NAV_ITEMS = [
  { href: '/',         label: 'Tablero',  icon: 'bar_chart',   exact: true  },
  { href: '/insights', label: 'Insights', icon: 'analytics',   exact: false },
  { href: '/mapa',     label: 'Mapa',     icon: 'map',         exact: false },
  { href: '/cuentas',  label: 'Cuentas',  icon: 'folder_open', exact: false },
];

export default function GlobalNav() {
  const path = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[2000] md:hidden flex justify-around"
      style={{
        background: T.surfaceL2,
        borderTop: `1px solid ${T.borderTertiary}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {NAV_ITEMS.map(item => {
        const isActive = item.exact
          ? path === item.href
          : path.startsWith(item.href) && item.href !== '/';
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '8px 16px', gap: 2, textDecoration: 'none',
              color: isActive ? T.brand : T.contentTertiary,
              background: isActive ? T.brandSubtle : 'transparent',
              borderRadius: 8,
              transition: 'color 0.15s, background 0.15s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
