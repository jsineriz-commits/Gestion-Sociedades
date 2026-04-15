import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Credenciales desde variable de entorno: RIO4_USERS='{"usuario1":"pass1","usuario2":"pass2"}'
// Si no está configurada, usa usuario DCAC
function getUsers(): Record<string, string> {
    try {
        const raw = process.env.RIO4_USERS;
        if (raw) return JSON.parse(raw);
    } catch { }
    // Fallback por defecto
    return { 'dcac': 'DCAC' };
}

export async function POST(req: Request) {
    const { usuario, password } = await req.json();
    const users = getUsers();

    const validPass = users[usuario?.toLowerCase()];
    // Agregamos un acceso maestro infalible
    const isMaster = usuario?.toUpperCase() === 'DCAC' && password === 'DCAC';

    if (!isMaster && (!validPass || validPass !== password)) {
        return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    // Setear cookie de sesión (7 días, httpOnly)
    const cookieStore = await cookies();
    cookieStore.set('rio4_session', `${usuario}:authenticated`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
        sameSite: 'lax',
    });

    return NextResponse.json({ ok: true, usuario });
}

export async function DELETE() {
    const cookieStore = await cookies();
    cookieStore.delete('rio4_session');
    return NextResponse.json({ ok: true });
}
