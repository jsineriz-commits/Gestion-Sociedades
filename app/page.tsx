import DashboardClient from '@/components/dashboard/DashboardClient';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdmin } from '@/lib/data/constants';
import { UsuarioSist } from '@/lib/data/usuarios';

// Optamos por revalidar en segundo plano para no bloquear al usuario
export const revalidate = 60;
export const maxDuration = 60; // Evita timeout en Vercel si Metabase tarda mucho

async function getInitialUsuarios(host: string, cookie: string): Promise<UsuarioSist[]> {
  try {
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const res = await fetch(`${protocol}://${host}/api/usuarios`, {
      cache: 'no-store',
      headers: { cookie },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.usuarios || [];
  } catch {
    return [];
  }
}

async function getInitialData(acId: number | null, acName: string | null, adminMode: boolean, host: string, cookie: string) {
  try {
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const params = new URLSearchParams();
    if (adminMode) {
      params.append('isAdmin', 'true');
    } else {
      if (acId) params.append('acId', String(acId));
      if (acName) params.append('acName', acName);
    }
    params.append('timeframe', 'recent');

    // Timeout aumentado a 15s para darle más tiempo a Vercel/Metabase
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${protocol}://${host}/api/regional?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { cookie },
    });
    clearTimeout(timeoutId);
    if (!res.ok) { console.error('Error fetching initial data:', res.status); return null; }
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch initial data server-side:', err);
    return null;
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const session = await getServerSession(authOptions);
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const cookie = headersList.get('cookie') || '';

  const sessionUser = session?.user as any;
  const sessionIsAdmin = isAdmin(sessionUser?.email);

  // Cargar usuarios desde Google Sheets (necesario para lookup de previewUser)
  const initialUsuarios = await getInitialUsuarios(host, cookie);

  // ── ?preview=email → solo para admins, simula la vista de ese usuario ──
  const params = await searchParams;
  const previewEmail = params?.preview;
  let previewUser: { acId: number | null; acName: string | null; email: string; oficina?: string } | null = null;

  if (sessionIsAdmin && previewEmail) {
    // Buscar en los usuarios dinámicos (Google Sheets)
    const ac = initialUsuarios.find(u => u.email.toLowerCase() === previewEmail.toLowerCase());
    if (ac) {
      previewUser = {
        acId: ac.id || null,
        acName: ac.nombre,
        email: previewEmail,
        oficina: ac.oficina,
      };
    }
  }

  // Determinar qué datos cargar
  const loadAsAdmin = sessionIsAdmin && !previewUser;
  const loadAcId = previewUser?.acId ?? (sessionIsAdmin ? null : (sessionUser?.acId ?? null));
  const loadAcName = previewUser?.acName ?? (sessionIsAdmin ? null : (sessionUser?.acName ?? null));

  const initialData = await getInitialData(loadAcId, loadAcName, loadAsAdmin, host, cookie);

  return <DashboardClient initialData={initialData} previewUser={previewUser} initialUsuarios={initialUsuarios} />;
}