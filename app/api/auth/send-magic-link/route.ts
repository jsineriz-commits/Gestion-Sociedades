import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { TODOS_LOS_USUARIOS } from '@/lib/data/constants';

const SECRET = process.env.NEXTAUTH_SECRET || 'secreto-super-seguro-local';
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.MAGIC_LINK_TEST_EMAIL; // Override para testing

// Genera un token HMAC firmado con expiración (20 minutos)
function createToken(email: string): string {
    const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 20 * 60 * 1000 })).toString('base64url');
    const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
    return `${payload}.${sig}`;
}

export async function POST(req: Request) {
    try {
        const { email } = await req.json();
        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
        }

        const normalEmail = email.toLowerCase().trim();

        // ── Whitelist estricta: solo usuarios registrados ───────────────────
        const user = TODOS_LOS_USUARIOS.find(u => u.email.toLowerCase() === normalEmail);
        if (!user) {
            // Respuesta genérica para no revelar qué emails existen
            return NextResponse.json({ ok: true });
        }

        const token = createToken(normalEmail);
        const loginUrl = `${APP_URL}/login?token=${encodeURIComponent(token)}&email=${encodeURIComponent(normalEmail)}`;

        // ── Destino del email: TEST_EMAIL override o el email real ──────────
        const sendTo = TEST_EMAIL || normalEmail;

        // ── Envío vía Resend API ────────────────────────────────────────────
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.error('[MagicLink] RESEND_API_KEY no configurado');
            // En dev: devolver el link en la response para testing
            return NextResponse.json({ ok: true, _devLink: loginUrl });
        }

        const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'Tablero Ganadero <onboarding@resend.dev>',
                to: [sendTo],
                subject: '🔐 Tu link de acceso al Tablero Ganadero',
                html: `
                    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
                        <div style="background: #1e3a5f; border-radius: 16px; padding: 32px; color: white; margin-bottom: 24px;">
                            <div style="font-size: 28px; margin-bottom: 8px;">🐄</div>
                            <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 800;">Tablero Ganadero</h1>
                            <p style="margin: 0; color: #93c5fd; font-size: 14px;">DeCampoACampo · Inteligencia Comercial</p>
                        </div>
                        <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                            <h2 style="margin: 0 0 12px; font-size: 18px; color: #1e293b;">Hola${TEST_EMAIL ? ` (testing → enviado a ${sendTo})` : ''}!</h2>
                            <p style="color: #64748b; line-height: 1.6; margin: 0 0 24px;">
                                Recibimos una solicitud de acceso al Tablero Ganadero para <strong>${normalEmail}</strong>.
                                Hacé clic en el botón para ingresar:
                            </p>
                            <a href="${loginUrl}"
                               style="display: block; text-align: center; background: #1d4ed8; color: white; padding: 16px 24px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; margin-bottom: 20px;">
                                ✅ Acceder al Tablero
                            </a>
                            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                                Este link expira en 20 minutos. Si no solicitaste acceso, ignorá este email.
                            </p>
                        </div>
                    </div>
                `,
            }),
        });

        if (!emailRes.ok) {
            const err = await emailRes.text();
            console.error('[MagicLink] Resend error:', err);
            return NextResponse.json({ error: 'Error al enviar email' }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('[MagicLink]', e.message);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
