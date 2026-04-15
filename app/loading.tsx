'use client';

export default function Loading() {
    return (
        <div
            className="flex flex-col items-center justify-center min-h-screen fixed inset-0 z-[100]"
            style={{ background: 'linear-gradient(160deg, #1a3a5c 0%, #0d2540 55%, #081929 100%)' }}
        >
            {/* Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(100,164,200,0.10) 0%, transparent 70%)' }} />

            <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                {/* Wordmark */}
                <div className="flex flex-col items-center leading-none gap-1 mb-10">
                    <span
                        className="font-light tracking-tight select-none"
                        style={{
                            fontFamily: "'Georgia', 'Times New Roman', serif",
                            fontSize: '2.6rem',
                            letterSpacing: '-0.02em',
                        }}
                    >
                        <span style={{ color: '#a8c4d8' }}>de</span>
                        <span style={{ color: '#ffffff' }}>Campo</span>
                        <span style={{ color: '#6aA4c8', fontStyle: 'italic' }}>a</span>
                        <span style={{ color: '#ffffff' }}>Campo</span>
                    </span>
                    <span
                        className="tracking-[0.18em] uppercase font-light text-xs text-center"
                        style={{ color: '#90b4c8', fontFamily: "'Georgia', serif", marginTop: '2px' }}
                    >
                        Mercado Ganadero Digital
                    </span>
                </div>

                {/* Divisor */}
                <div className="w-16 h-px mb-8"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(168,196,216,0.35), transparent)' }} />

                {/* Loader dots */}
                <div className="flex flex-col items-center gap-3">
                    <div className="flex gap-1.5">
                        {[0, 150, 300].map(delay => (
                            <div
                                key={delay}
                                className="w-1.5 h-1.5 rounded-full animate-bounce"
                                style={{ backgroundColor: 'rgba(168,196,216,0.6)', animationDelay: `${delay}ms` }}
                            />
                        ))}
                    </div>
                    <span className="text-[9px] font-light tracking-[0.25em] uppercase" style={{ color: 'rgba(168,196,216,0.4)' }}>
                        Cargando
                    </span>
                </div>
            </div>
        </div>
    );
}
