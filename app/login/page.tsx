'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect, FormEvent } from 'react';

/* ── Logo deCampoaCampo replicando el estilo del sitio ──────────────────── */
function DcacLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const cls = {
        sm: { wrap: 'gap-0.5', brand: 'text-2xl', sub: 'text-[10px]' },
        md: { wrap: 'gap-1',   brand: 'text-4xl', sub: 'text-sm' },
        lg: { wrap: 'gap-1.5', brand: 'text-5xl', sub: 'text-base' },
    }[size];

    return (
        <div className={`flex flex-col items-center leading-none ${cls.wrap}`}>
            {/* Wordmark: estilo deCampoaCampo.com — tipografía elegante, colores azul-gris */}
            <span
                className={`font-light tracking-tight text-white select-none ${cls.brand}`}
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif", letterSpacing: '-0.02em' }}
            >
                <span style={{ color: '#a8c4d8' }}>de</span>
                <span style={{ color: '#ffffff' }}>Campo</span>
                <span style={{ color: '#6aA4c8', fontStyle: 'italic' }}>a</span>
                <span style={{ color: '#ffffff' }}>campo</span>
            </span>
            {/* Subtítulo: Mercado Ganadero */}
            <span
                className={`tracking-[0.18em] uppercase font-light text-center ${cls.sub}`}
                style={{ color: '#90b4c8', fontFamily: "'Georgia', serif", marginTop: '2px' }}
            >
                Mercado Ganadero Digital
            </span>
        </div>
    );
}

function LoginContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get('error');
    const tokenParam = searchParams.get('token');
    const emailParam = searchParams.get('email');

    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [magicState, setMagicState] = useState<'idle' | 'loading' | 'sent' | 'verifying' | 'error'>('idle');
    const [showMagicForm, setShowMagicForm] = useState(false);

    // Auto-login si vienen con token en la URL
    useEffect(() => {
        if (tokenParam && emailParam) {
            setMagicState('verifying');
            signIn('magic-link', {
                token: tokenParam,
                email: emailParam,
                callbackUrl: '/',
                redirect: true,
            });
        }
    }, [tokenParam, emailParam]);

    const handleGoogle = async () => {
        setIsGoogleLoading(true);
        await signIn('google', { callbackUrl: '/' });
    };

    const handleMagicLink = async (e: FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setMagicState('loading');
        try {
            const res = await fetch('/api/auth/send-magic-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMagicState('error');
            } else {
                setMagicState('sent');
                if (data._devLink) console.log('[DEV] Magic link:', data._devLink);
            }
        } catch {
            setMagicState('error');
        }
    };

    // Estado: verificando token
    if (magicState === 'verifying') {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #0d2540 60%, #081929 100%)' }}>
                <div className="text-center">
                    <DcacLogo size="md" />
                    <div className="mt-10 flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <p className="text-white/60 text-sm font-light tracking-wide">Verificando acceso...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen flex"
            style={{ fontFamily: "'Inter', sans-serif", background: '#f7f9fb' }}
        >
            {/* ── Panel izquierdo: Branding deCampoaCampo ──────────────────────── */}
            <div
                className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center"
                style={{ background: 'linear-gradient(160deg, #1a3a5c 0%, #0d2540 55%, #081929 100%)' }}
            >
                {/* Textura sutil */}
                <div className="absolute inset-0 opacity-[0.04]" style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '32px 32px'
                }} />
                {/* Glow central */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(100,164,200,0.12) 0%, transparent 70%)' }} />

                <div className="relative z-10 flex flex-col items-center text-center px-16">
                    {/* Logo principal */}
                    <DcacLogo size="lg" />

                    {/* Divisor */}
                    <div className="w-16 h-px my-10" style={{ background: 'linear-gradient(90deg, transparent, rgba(168,196,216,0.4), transparent)' }} />

                    {/* Propuesta de valor */}
                    <p className="text-white/50 text-sm font-light leading-relaxed max-w-sm tracking-wide">
                        Inteligencia comercial en tiempo real para tu equipo de gestión.
                    </p>

                    {/* Features */}
                    <div className="mt-12 space-y-4 text-left w-full max-w-xs">
                        {[
                            { icon: '📊', text: 'KPIs y métricas ejecutivas' },
                            { icon: '🐄', text: 'Estado de tropas en tiempo real' },
                            { icon: '🤝', text: 'Pipeline comercial completo' },
                        ].map(f => (
                            <div key={f.icon} className="flex items-center gap-3">
                                <span className="text-lg opacity-70">{f.icon}</span>
                                <span className="text-white/50 text-sm font-light">{f.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center">
                    <span className="text-white/20 text-[10px] tracking-[0.2em] uppercase font-light">
                        © {new Date().getFullYear()} deCampoacampo
                    </span>
                </div>
            </div>

            {/* ── Panel derecho: Formulario ─────────────────────────────────────── */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 bg-white shadow-2xl">
                <div className="w-full max-w-sm">

                    {/* Mobile: logo compacto sobre fondo azul */}
                    <div
                        className="lg:hidden -mx-8 -mt-8 sm:-mx-12 sm:-mt-12 mb-10 px-8 py-10 flex items-center justify-center"
                        style={{ background: 'linear-gradient(160deg, #1a3a5c 0%, #0d2540 100%)' }}
                    >
                        <DcacLogo size="md" />
                    </div>

                    {/* Encabezado del form */}
                    <div className="mb-8">
                        <h1 className="text-2xl font-semibold text-gray-800 tracking-tight">Bienvenido</h1>
                        <p className="text-sm text-gray-400 mt-1 font-light">Ingresá con tu cuenta para continuar</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-rose-800">Acceso no autorizado</p>
                                <p className="text-xs text-rose-600/80 mt-0.5">
                                    {error === 'Configuration'
                                        ? 'Error de configuración del proveedor de autenticación.'
                                        : error === 'AccessDenied'
                                            ? 'Tu email no está en la lista de acceso habilitado.'
                                            : 'Ocurrió un error al validar tu identidad.'}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {/* Botón Google */}
                        <button
                            onClick={handleGoogle}
                            disabled={isGoogleLoading}
                            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                        >
                            {isGoogleLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                                    <span>Verificando...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    <span>Ingresar con Google Workspace</span>
                                </>
                            )}
                        </button>

                        {/* Magic Link */}
                        {!showMagicForm ? (
                            <button
                                onClick={() => setShowMagicForm(true)}
                                className="w-full py-3 text-sm font-light text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                ¿Sin cuenta corporativa? → Accedé con tu email
                            </button>
                        ) : (
                            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                                {magicState === 'sent' ? (
                                    <div className="text-center py-3">
                                        <div className="text-2xl mb-2">📬</div>
                                        <p className="font-semibold text-sm text-gray-800">¡Link enviado!</p>
                                        <p className="text-xs text-gray-500 mt-1">Revisá <strong>{email}</strong> y hacé clic en el enlace. Expira en 20 min.</p>
                                        <button onClick={() => { setMagicState('idle'); setEmail(''); }} className="mt-3 text-xs text-blue-500 hover:underline">Reenviar</button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleMagicLink} className="space-y-3">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="tu@email.com"
                                            required
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:outline-none text-sm text-gray-800 placeholder-gray-300 bg-white"
                                        />
                                        {magicState === 'error' && (
                                            <p className="text-xs text-rose-600">Error al enviar. Verificá que tu email esté autorizado.</p>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={magicState === 'loading' || !email}
                                            className="w-full py-3 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                                            style={{ background: 'linear-gradient(135deg, #1a3a5c, #0d2540)' }}
                                        >
                                            {magicState === 'loading' ? 'Enviando...' : '✉️ Recibir link de acceso'}
                                        </button>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer del form */}
                    <div className="mt-10 pt-6 border-t border-gray-100 text-center">
                        <p className="text-[10px] text-gray-300 tracking-wider uppercase font-light">
                            deCampoacampo · Mercado Ganadero Digital
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function WelcomePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #1a3a5c 0%, #081929 100%)' }}>
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
