'use client';
import React, { useState, useRef, useEffect } from 'react';

export default function InfoTooltip({ text }: { text: string }) {
    const [open, setOpen] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Cerrar si se hace click fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open]);

    return (
        <div 
            className="relative inline-flex items-center ml-1.5" 
            ref={tooltipRef}
            onMouseEnter={() => setOpen(true)} 
            onMouseLeave={() => setOpen(false)}
        >
            <button 
                type="button" 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
                className="w-4 h-4 rounded-full bg-[#f0f4f8] text-[#3179a7] border border-[#d2e3ef] flex items-center justify-center text-[10px] font-bold hover:bg-[#3179a7] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#3179a7] focus:ring-offset-1"
                aria-label="Más información"
            >
                ?
            </button>
            
            {open && (
                <div className="absolute z-[100] w-56 p-2.5 mt-2 bg-[#2a303c] text-[#e0e8f0] text-[11px] font-medium rounded-xl shadow-xl border border-[#3b4353] left-1/2 -translate-x-1/2 top-full md:top-auto md:bottom-full md:mb-2 leading-relaxed animate-in fade-in zoom-in-95 duration-200">
                    {/* Flechita abajo (desktop) */}
                    <div className="hidden md:block absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#2a303c] rotate-45 border-r border-b border-[#3b4353]"></div>
                    {/* Flechita arriba (mobile) */}
                    <div className="md:hidden absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#2a303c] rotate-45 border-l border-t border-[#3b4353]"></div>
                    
                    {text}
                </div>
            )}
        </div>
    );
}
