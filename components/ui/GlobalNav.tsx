'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/',        label: '📊 Tablero',   exact: true  },
  { href: '/insights',label: '🔍 Insights',  exact: false },
  { href: '/mapa',    label: '🗺️ Mapa',      exact: false },
  { href: '/cuentas', label: '📁 Cuentas',   exact: false },
];

export default function GlobalNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[2000] bg-slate-900/95 backdrop-blur border-t border-slate-800 md:hidden flex justify-around py-2 px-2">
      {NAV_ITEMS.map(item => {
        const isActive = item.exact ? path === item.href : path.startsWith(item.href) && item.href !== '/';
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center text-[10px] gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              isActive ? 'text-emerald-400 bg-slate-800' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="text-base">{item.label.split(' ')[0]}</span>
            <span>{item.label.split(' ').slice(1).join(' ')}</span>
          </Link>
        );
      })}
    </nav>
  );
}
