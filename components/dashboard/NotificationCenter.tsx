'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';

// Reusa la info de usuario enviada desde el layout
export default function NotificationCenter({ userRole, userName, userAcIds }: { userRole: string, userName: string, userAcIds?: number[] }) {
    const [open, setOpen] = useState(false);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastFetched, setLastFetched] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        if (Date.now() - lastFetched < 60000) return; // 1 min throttle
        setLoading(true);
        try {
            const res = await fetch('/api/notificaciones');
            const data = await res.json();
            if (data.success) {
                setEvents(data.events || []);
                setLastFetched(Date.now());
            }
        } catch (e) {
            console.error('Error notif:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const t = setInterval(fetchNotifications, 5 * 60 * 1000); // 5 min background polling
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const handleOut = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handleOut);
        return () => document.removeEventListener('mousedown', handleOut);
    }, [open]);

    // Ojo: Filtros por AC
    const filteredEvents = useMemo(() => {
        if (userRole === 'admin') return events.slice(0, 100); 
        return events.filter(e => {
            if (!e.ac) return true; // Avisos sin especificar
            const myName = String(userName).trim().toLowerCase();
            return String(e.ac).trim().toLowerCase() === myName || String(e.ac).trim().toLowerCase().includes(myName);
        }).slice(0, 50);
    }, [events, userRole, userName]);

    const [unreadCount, setUnreadCount] = useState(0);
    useEffect(() => {
        if (!filteredEvents.length) return;
        const lastView = Number(localStorage.getItem('dcac_notif_last_view') || 0);
        const c = filteredEvents.filter(e => e.parsedDate > lastView).length;
        setUnreadCount(c);
    }, [filteredEvents, open]);

    const handleOpen = () => {
        if (!open) {
            setOpen(true);
            setUnreadCount(0);
            localStorage.setItem('dcac_notif_last_view', String(Date.now()));
            if (!events.length) fetchNotifications();
        } else {
            setOpen(false);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={handleOpen}
                title="Centro de Notificaciones AC"
                className={`relative p-2 sm:p-2.5 rounded-xl transition-all duration-300 ${open ? 'bg-blue-100 text-blue-700 shadow-inner ring-2 ring-blue-200' : 'bg-white/80 hover:bg-white text-gray-500 hover:text-blue-600 shadow-sm border border-gray-100 hover:border-blue-200 backdrop-blur-md hover:-translate-y-0.5'}`}
            >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                
                {unreadCount > 0 && (
                    <span className="absolute top-1 sm:top-1.5 right-1 sm:right-1.5 flex h-4 sm:h-5 min-w-[16px] sm:min-w-[20px] px-1 items-center justify-center rounded-full bg-red-500 text-[9px] sm:text-[10px] font-black text-white shadow ring-2 ring-white animate-in zoom-in">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 sm:-right-4 top-full mt-3 w-[300px] sm:w-[400px] bg-white rounded-2xl shadow-[0_10px_40px_-5px_rgba(0,0,0,0.15)] border border-gray-200 z-[100] overflow-hidden flex flex-col animate-in slide-in-from-top-2 fade-in zoom-in-95 duration-200">
                    <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between backdrop-blur-md">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🔔</span>
                            <h3 className="font-black text-gray-800 text-sm sm:text-base tracking-tight">Centro de Avisos</h3>
                            {loading && <div className="ml-2 w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                        </div>
                        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-gray-200">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto max-h-[50vh] sm:max-h-[60vh] p-2 bg-slate-50/50">
                        {loading && !filteredEvents.length ? (
                            <div className="flex flex-col items-center justify-center py-12 opacity-60">
                                <span className="text-4xl mb-3 grayscale animate-pulse">📡</span>
                                <p className="text-sm font-bold text-gray-500 tracking-wide text-center">Sincronizando Módulo<br/>de Conexiones...</p>
                            </div>
                        ) : filteredEvents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 opacity-60">
                                <span className="text-5xl mb-3 grayscale">📭</span>
                                <p className="text-sm font-bold text-gray-500 tracking-wide">Bandeja al día</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1.5 focus:outline-none">
                                {filteredEvents.map((ev, i) => {
                                    const rawDate = new Date(ev.date);
                                    const isToday = rawDate.toLocaleDateString() === new Date().toLocaleDateString();
                                    const timeMsg = isToday ? rawDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : rawDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                    
                                    let icn = 'bg-slate-100 text-slate-500 border-slate-200';
                                    let ring = 'hover:border-slate-300';
                                    
                                    if (ev.type === 'oferta') { icn = 'bg-amber-100 text-amber-600 border-amber-200'; ring= 'hover:border-amber-300 ring-amber-50'; }
                                    else if (ev.type === 'ofrecimiento') { icn = 'bg-blue-100 text-blue-600 border-blue-200'; ring= 'hover:border-blue-300 ring-blue-50';  }
                                    else if (ev.type === 'ci') { icn = 'bg-emerald-100 text-emerald-600 border-emerald-200'; ring= 'hover:border-emerald-300 ring-emerald-50';  }
                                    else if (ev.type === 'cd') { icn = 'bg-indigo-100 text-indigo-600 border-indigo-200'; ring= 'hover:border-indigo-300 ring-indigo-50';  }

                                    return (
                                        <div key={ev.id + i} className={`p-2.5 sm:p-3 rounded-xl border border-gray-100 shadow-sm bg-white flex gap-3 h-full items-start transition-all ${ring} hover:shadow-md cursor-default`}>
                                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center shrink-0 ${icn} text-[10px] sm:text-xs font-black uppercase shadow-inner`}>
                                                {ev.type.substring(0, 2)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2 mb-0.5 sm:mb-1 border-b border-gray-50 pb-0.5">
                                                    <p className="text-[11px] sm:text-xs font-black text-gray-800 truncate">{ev.title}</p>
                                                    <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 whitespace-nowrap bg-gray-50 px-1 rounded border border-gray-100">{timeMsg}</span>
                                                </div>
                                                <p className="text-[10px] sm:text-[11px] font-semibold text-gray-600 leading-snug mb-1">{ev.desc}</p>
                                                {ev.ac && <p className="text-[8px] sm:text-[9px] font-bold tracking-widest text-[#235677] uppercase">{ev.ac}</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

