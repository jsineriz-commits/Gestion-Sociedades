import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
    const secret = process.env.NEXTAUTH_SECRET || "secreto-super-seguro-local";
    const session = await getToken({ req, secret });
    const { pathname } = req.nextUrl;

    // Rutas protegidas
    const PROTECTED = ['/', '/api/regional', '/insights', '/mapa', '/cuentas', '/api/mapa', '/api/cuentas'];
    const isProtected = PROTECTED.some(p => pathname === p || (p.endsWith('/') ? false : pathname.startsWith(p + '/')));
    if (isProtected || pathname.startsWith('/api/regional') || pathname.startsWith('/api/mapa') || pathname.startsWith('/api/cuentas')) {
        if (!session) {
            const url = req.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }
    }

    // Si ya está logueado, no puede entrar a /login
    if (pathname === '/login') {
        if (session) {
            const url = req.nextUrl.clone();
            url.pathname = '/';
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/', '/login', '/insights', '/mapa', '/cuentas', '/api/regional', '/api/mapa', '/api/cuentas/:path*'],
};
