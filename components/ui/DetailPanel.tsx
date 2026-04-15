'use client';

import { useEffect } from 'react';

export interface DetailRow {
    label: string;
    value?: string | number | null;
    sub?: string;
    badge?: { text: string; color: string };
    highlight?: boolean;
}

export interface DetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    icon?: string;
    accentColor?: string;
    rows?: DetailRow[];
    children?: React.ReactNode;
    count?: number;
}

export default function DetailPanel({
    isOpen,
    onClose,
    title,
    subtitle,
    icon = '📋',
    accentColor = 'border-[#3179a7]',
    rows,
    children,
    count,
}: DetailPanelProps) {
    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // Prevent body scroll
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal: full-screen en mobile, centrado en desktop */}
            <div
                className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 pointer-events-none`}
            >
                <div
                    className={`
                        pointer-events-auto
                        w-full sm:max-w-4xl
                        max-h-[92vh] sm:max-h-[90vh]
                        bg-white sm:rounded-2xl shadow-2xl
                        flex flex-col
                        rounded-t-3xl
                        transition-all duration-300 ease-out
                        ${isOpen
                            ? 'opacity-100 scale-100 translate-y-0'
                            : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
                        }
                    `}
                    aria-modal="true"
                    role="dialog"
                >
                    {/* Header */}
                    <div className={`border-t-4 ${accentColor} rounded-t-2xl px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between flex-shrink-0`}>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-2xl">{icon}</span>
                                <h2 className="text-base font-semibold text-[#555555] uppercase tracking-wide">{title}</h2>
                                {count !== undefined && (
                                    <span className="text-[11px] font-semibold bg-[#eaf2f6] text-[#3179a7] px-2.5 py-0.5 rounded-full">
                                        {count} registros
                                    </span>
                                )}
                            </div>
                            {subtitle && <p className="text-xs text-gray-400 ml-9">{subtitle}</p>}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-[#f8f8f8] transition-colors text-[#888888] hover:text-[#555555] flex-shrink-0 ml-4"
                            aria-label="Cerrar"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content — scrollable */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                        {rows && rows.length > 0 && (
                            <div className="space-y-2">
                                {rows.map((row, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${row.highlight ? 'bg-[#eaf2f6] border border-[#bfd5e4]' : 'bg-[#f8f8f8]'}`}
                                    >
                                        <div>
                                            <span className="text-xs font-medium text-[#555555]">{row.label}</span>
                                            {row.sub && <p className="text-[10px] text-[#888888] mt-0.5">{row.sub}</p>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {row.badge && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.badge.color}`}>{row.badge.text}</span>
                                            )}
                                            {row.value !== undefined && row.value !== null && (
                                                <span className="text-sm font-bold text-[#555555]">{row.value}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {children}
                    </div>

                    {/* Footer */}
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-[#ededed] flex-shrink-0 flex justify-end gap-3 pb-safe">
                        <button
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-6 py-3 sm:py-2.5 rounded-lg bg-[#3179a7] text-white text-xs font-semibold uppercase tracking-widest hover:bg-[#2d6e98] transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
