'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';

const KPIsRegional = dynamic(() => import('@/components/dashboard/KPIsRegional'));
const RankingAC = dynamic(() => import('@/components/analisis/RankingAC'));
const TopSociedades = dynamic(() => import('@/components/analisis/TopSociedades'));
const Publicaciones = dynamic(() => import('@/components/publicaciones/Publicaciones'));
const PagosPanel = dynamic(() => import('@/components/dashboard/PagosPanel'));
const NoConcretadasPanel = dynamic(() => import('@/components/dashboard/NoConcretadasPanel'));
const NotasPersonales = dynamic(() => import('@/components/admin/NotasPersonales'));
const MonitorCIs = dynamic<{ cisInv: any[]; cisInvFull: any[]; acName?: string | null; acId?: number | null; topSoc?: any[] }>(() => import('@/components/dashboard/MonitorCIs'));
const EvolucionAnual = dynamic<{ opsAll: any[]; selectedYear: number; filterCierre: boolean; historyLoaded?: boolean }>(() => import('@/components/dashboard/EvolucionAnual'));
const EstadoTropas = dynamic(() => import('@/components/dashboard/EstadoTropas'));
const CowLoader = dynamic(() => import('@/components/ui/CowLoader'));
const MercadoInsightsCard = dynamic(() => import('@/components/analisis/MercadoInsights'));
const InsightsClient = dynamic(() => import('@/components/analisis/InsightsClient'));
const PublicacionesCard = dynamic(() => import('@/components/publicaciones/PublicacionesCard'));
// NotificationCenter removido
import OfrecimientosCard from '@/components/publicaciones/OfrecimientosCard';
import InfoTooltip from '@/components/ui/InfoTooltip';
const AuditoriaComerciales = dynamic<{ ops: any[]; canal?: string | null; selectedYear?: number; selectedMes?: number; filterCierre?: boolean }>(() => import('@/components/admin/AuditoriaComerciales'));
const Asignaciones = dynamic(() => import('@/components/admin/Asignaciones'));



const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_FULL = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type CompMode = 'MoM' | 'YoY' | 'YTD';

const VIEWS = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'tropas', icon: '🐄', label: 'Estado Tropas' },
    { id: 'publicaciones', icon: '🤝', label: 'Ofrecimientos' },
    { id: 'sociedades', icon: '🏢', label: 'Ranking Sociedades' },
    { id: 'asignaciones', icon: '👤', label: 'Asignaciones AC' },
    { id: 'monitorCis', icon: '📈', label: 'Monitor CIs' },
    { id: 'auditoria', icon: '🔍', label: 'Auditoría AC', adminOnly: true },
    { id: 'notas', icon: '📝', label: 'Mis Notas' },
    { id: 'insights', icon: '🔬', label: 'Insights', adminOnly: true },
];

import { useSession } from 'next-auth/react';
import { ADMIN_NAMES, mapUsuarios, AcDef } from '@/lib/data/constants';
import { UsuarioSist } from '@/lib/data/usuarios';
import { PERFILES_COMERCIALES, getComencialesByOficina } from '@/lib/data/comerciales';
import ComercialCombobox from '@/components/dashboard/ComercialCombobox';

type PreviewUser = { acId: number | null; acName: string | null; email: string; oficina?: string } | null;

export default function DashboardClient({
    initialData,
    previewUser,
    initialUsuarios = [],
}: {
    initialData: any;
    previewUser?: PreviewUser;
    initialUsuarios?: UsuarioSist[];
}) {
    const { data: session, status } = useSession();
    const _sessionUser = session?.user as any;

    // En modo preview, sustituimos el user de sesión por el perfil simulado
    const user = previewUser
        ? { ..._sessionUser, isAdmin: false, acId: previewUser.acId, acName: previewUser.acName, email: previewUser.email, oficina: previewUser.oficina }
        : _sessionUser;

    // Detectar si el usuario no está configurado (calculado antes de hooks para usarlo luego)
    const isInternalEmail = _sessionUser?.email?.toLowerCase().endsWith('@decampoacampo.com') ||
                            _sessionUser?.email?.toLowerCase().endsWith('@decampoacampo.com.ar');
    const isUnconfigured = !previewUser && status === 'authenticated' && isInternalEmail && !_sessionUser?.isAdmin && !_sessionUser?.acId;


    const [selectedAcFilter, setSelectedAcFilter] = useState<string>('all');
    const [selectedCanalFilter, setSelectedCanalFilter] = useState<string>('all');
    const [viewingAs, setViewingAs] = useState<{ nombre: string; email: string; id?: number | null; canal?: string | null } | null>(null);
    const [nightMode, setNightMode] = useState(false);

    // Lista de usuarios dinámica (Google Sheets). Se inicializa con los datos SSR.
    const [usuarios, setUsuarios] = useState<AcDef[]>(() => mapUsuarios(initialUsuarios));
    
    const [historyLoaded, setHistoryLoaded] = useState(true);
    const historyAbortRef = useRef<AbortController | null>(null);
    const [modalStats, setModalStats] = useState<{ title: string; list: any[]; type: 'lote' | 'op' | 'oferta' } | null>(null);
    const [officeMapMode, setOfficeMapMode] = useState<'cbz' | 'soc'>('cbz');

    useEffect(() => {
        // Toggle dark mode classes on html
        if (nightMode) {
            document.documentElement.classList.add('night-mode');
        } else {
            document.documentElement.classList.remove('night-mode');
        }
    }, [nightMode]);

    // 1. Estados iniciales (data completa)
    const [lotesRaw, setLotesRaw] = useState<any[]>(initialData?.lotes || []);
    const [lotesGlobalesRaw, setLotesGlobalesRaw] = useState<any[]>(initialData?.lotesGlobales || []);
    const [opsOfRaw, setOpsOfRaw] = useState<any[]>(initialData?.opsOficina || []);
    const [ofertasRaw, setOfertasRaw] = useState<any[]>(initialData?.ofertas || []);
    const [topSoc, setTopSoc] = useState<any[]>(initialData?.topSoc || []);
    const [cisInv, setCisInv] = useState<any[]>(initialData?.cisInv || []);
    const [cisInvFull, setCisInvFull] = useState<any[]>(initialData?.cisInvFull || []);
    const [tropasData, setTropasData] = useState<any[] | null>(null); // prefetch tropas
    const [monitorOfertas, setMonitorOfertas] = useState<any[]>([]); // Q185 Monitor Ofertas SD
    const [monitorOfertasLoading, setMonitorOfertasLoading] = useState(false);

    // 2. Data lista para usar (ya viene filtrada del servidor)
    const lotes = useMemo(() => lotesRaw, [lotesRaw]);
    const lotesPublicaciones = useMemo(() => lotesGlobalesRaw, [lotesGlobalesRaw]);
    const opsOf = useMemo(() => opsOfRaw, [opsOfRaw]);

    // Como los datos ya vienen del servidor, loading inicial es falso si hay datos
    const [loading, setLoading] = useState(!initialData);
    const [initialLoad, setInitialLoad] = useState(!initialData);
    const [extraLoading, setExtraLoading] = useState(false);
    const [hasLoadedExtra, setHasLoadedExtra] = useState(false);
    const [renderGraphics, setRenderGraphics] = useState(false);

    useEffect(() => {
        if (!initialLoad) {
            const timer = setTimeout(() => setRenderGraphics(true), 50);
            return () => clearTimeout(timer);
        } else {
            setRenderGraphics(false);
        }
    }, [initialLoad]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const [enrichedOfertas, setEnrichedOfertas] = useState<any[] | null>(null);
    const [isEnrichingOfertas, setIsEnrichingOfertas] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (!modalStats) setExpandedRows(new Set());
    }, [modalStats]);

    // Q185 ya trae los datos completos — no se llama al viejo /api/ofertas
    useEffect(() => {
        if (modalStats?.type === 'oferta') {
            setEnrichedOfertas(modalStats.list);
            setIsEnrichingOfertas(false);
        } else {
            setEnrichedOfertas(null);
            setIsEnrichingOfertas(false);
        }
    }, [modalStats]);

    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
    const [lastUpdated, setLU] = useState<Date | null>(null);
    const [activeView, setView] = useState('dashboard');
    const [sideOpen, setSide] = useState(true);

    // Usuarios agrupados por canal para el selector Admin (usa lista dinámica de Google Sheets)
    const usuariosAgrupados = useMemo(() => {
        // Orden preferido de canales conocidos. Canales nuevos en la planilla se agregan al final automáticamente.
        const CANAL_ORDER_KNOWN = ['Regional', 'Oficina', 'Representante', 'Representantes', 'Directo', 'Comisionista', 'Operario de carga'];
        const map = new Map<string, AcDef[]>();
        usuarios.forEach(u => {
            if (u.canal === 'Admin') return; // Admins no aparecen en el selector
            if (!map.has(u.canal)) map.set(u.canal, []);
            map.get(u.canal)!.push(u);
        });
        // Primero los canales en orden conocido, luego cualquier canal extra de la planilla
        const ordered = CANAL_ORDER_KNOWN.filter(c => map.has(c));
        const extra = Array.from(map.keys()).filter(c => !CANAL_ORDER_KNOWN.includes(c)).sort();
        return [...ordered, ...extra].map(c => [c, map.get(c)!] as [string, AcDef[]]);
    }, [usuarios]);


    // Filtros
    const hoy = new Date();
    const [selectedYear, setYear] = useState(hoy.getFullYear());
    const [selectedMes, setMes] = useState(hoy.getMonth() + 1); // Carga por defecto el Mes Actual 
    const [filterCierre, setCierre] = useState(false);
    // compMode derivado automáticamente: mes=0 → YTD, mes específico → YoY
    const compMode: CompMode = selectedMes === 0 ? 'YTD' : 'YoY';
    // ¿El período seleccionado es el mes/año real de hoy?
    const isCurrentPeriod = selectedYear === hoy.getFullYear() && selectedMes === (hoy.getMonth() + 1);

    const currentUserObj = useMemo(() => {
        return usuarios.find(u => u.nombre === user?.acName);
    }, [user?.acName, usuarios]);

    const userOficinaObj = useMemo(() => {
        const oficina = currentUserObj?.oficina ?? (previewUser?.oficina || null);
        if (!oficina) return null;
        return usuarios.find(u => u.canal === 'Oficina' && u.nombre === oficina);
    }, [currentUserObj, previewUser, usuarios]);

    // ── Fuente única de verdad: ¿qué está viendo el usuario ahora? ──────────
    // Esto reemplaza la lógica duplicada en cada componente hijo.
    const viewContext = useMemo(() => {
        if (user?.isAdmin) {
            // Admin viendo todo (o todo un canal) → sin usuario específico
            if (!viewingAs) {
                const c = selectedCanalFilter !== 'all' ? selectedCanalFilter : null;
                return { canal: c, acName: null, acId: null, isAdmin: true };
            }
            // Admin viendo comercial específico (id presente)
            return { canal: viewingAs.canal ?? selectedCanalFilter ?? null, acName: viewingAs.nombre, acId: viewingAs.id, isAdmin: false };
        }
        // Usuario no-admin visualizando su oficina asignada
        if (viewingAs) {
            return {
                canal: viewingAs.canal ?? null,
                acName: viewingAs.nombre,
                acId: viewingAs.id,
                isAdmin: false,
            };
        }
        // Usuario no-admin normal
        return {
            canal: user?.canal ?? null,
            acName: user?.acName ?? null,
            acId: user?.acId ?? null,
            isAdmin: false,
        };
    }, [user, viewingAs, selectedCanalFilter]);

    const statsHoy = useMemo(() => {
        // Usar fecha LOCAL (no UTC) — en Argentina después de las 21hs
        // toISOString() ya devuelve el día siguiente (está en UTC, no en local)
        const _now = new Date();
        const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
        const res = {
            ventas: { t: 0, c: 0, list: [] as any[] },
            compras: { t: 0, c: 0, list: [] as any[] },
            ofrecimientos: { t: 0, c: 0, list: [] as any[] },    // hoy
            ofertas: { t: 0, c: 0, list: [] as any[] },           // hoy (Q185)
        };

        // ── Operaciones CONCRETADAS del día (Q95 via opsOf, ya filtradas por AC/repre ID) ──
        // Venta  = la oficina/AC está en el lado VENDEDOR
        // Compra = la oficina/AC está en el lado COMPRADOR
        // Para oficinas usamos Oficina_Venta / Oficina_Compra (más preciso)
        // Para individuales usamos AC_Vend / AC_Comp como antes
        const _currentAcName = viewContext.acName ?? null;
        const _isOficina = !!_currentAcName && _currentAcName.toLowerCase().startsWith('oficina');
        const _oficinaNorm = _currentAcName?.toLowerCase().trim() ?? '';

        opsOf.forEach(o => {
            const fOp = typeof o.fecha_operacion === 'string' ? o.fecha_operacion.split('T')[0] : '';
            if (fOp !== todayStr) return;
            const estado = (o.estado_general || o.ESTADO || o.Estado_Trop || o.estado_tropas || '').toUpperCase();
            if (!estado.includes('CONCRET') && !estado.includes('VENDID')) return;
            const cbzs = Number(o.Cabezas ?? o.cabezas ?? 0);

            let esVenta: boolean;
            let esCompra: boolean;

            if (_isOficina) {
                // Para oficinas: usar los campos Oficina_Venta / Oficina_Compra
                esVenta  = (o.Oficina_Venta  || '').toLowerCase().trim() === _oficinaNorm;
                esCompra = (o.Oficina_Compra || '').toLowerCase().trim() === _oficinaNorm;
            } else {
                // Para individuales: AC_Vend → venta, AC_Comp → compra
                esVenta  = !!(o.AC_Vend && String(o.AC_Vend).trim());
                esCompra = !!(o.AC_Comp && String(o.AC_Comp).trim());
            }

            if (esVenta) {
                res.ventas.t++;
                res.ventas.c += cbzs;
                res.ventas.list.push(o);
            }
            if (esCompra) {
                res.compras.t++;
                res.compras.c += cbzs;
                res.compras.list.push(o);
            }
        });

        // ── Ofrecimientos: tropas publicadas hoy (desde opsOf → fecha_publicaciones) ──
        // La query de ofrecimientos ya viene filtrada por AC/repre ID,
        // sólo necesitamos filtrar por fecha de publicación = hoy
        const ofrecimientosIds = new Set<string>();
        opsOf.forEach(o => {
            const fPub = typeof o.fecha_publicaciones === 'string' ? o.fecha_publicaciones.split('T')[0] : '';
            if (fPub !== todayStr) return;
            const idKey = String(o.id_lote || '').trim();
            if (idKey && ofrecimientosIds.has(idKey)) return;
            if (idKey) ofrecimientosIds.add(idKey);
            res.ofrecimientos.t++;
            res.ofrecimientos.c += Number(o.Cabezas ?? o.cabezas ?? 0);
            res.ofrecimientos.list.push(o);
        });
        // Complementar con lotes MB1 si los hay para hoy y no están en Q95
        lotesPublicaciones.forEach((l: any) => {
            const fPub = (l.fecha_publicacion || l.fecha_publicaciones || l.dia_hora_publicacion || l.created_at || '');
            if (typeof fPub !== 'string' || fPub.split('T')[0] !== todayStr) return;
            const idKey = String(l.id || l.id_lote || '').trim();
            if (idKey && ofrecimientosIds.has(idKey)) return;
            if (idKey) ofrecimientosIds.add(idKey);
            res.ofrecimientos.t++;
            res.ofrecimientos.c += Number(l.cabezas) || 0;
            res.ofrecimientos.list.push(l);
        });

        // ── Ofertas: desde Q185 (monitorOfertas) — ya filtradas por id_usuario ──
        // Separamos: ofertas de HOY y ofertas de la ÚLTIMA SEMANA
        monitorOfertas.forEach(o => {
            const fOf = typeof o.fecha_oferta === 'string' ? o.fecha_oferta.split('T')[0]
                      : typeof o.fecha === 'string' ? o.fecha.split('T')[0] : '';
            if (!fOf) return;
            const cbzs = Number(o.cantidad || o.Cabezas || o.cabezas || o.cant_cabezas) || 0;
            if (fOf === todayStr) {
                res.ofertas.t++;
                res.ofertas.c += cbzs;
                res.ofertas.list.push(o);
            }
        });

        return res;
    }, [opsOf, lotesPublicaciones, monitorOfertas, viewContext]);

    // Ya fue movido arriba

    // Fetch secundario transparente
    const loadExtraData = useCallback(async (
        overrideAcId?: number | null,
        overrideAcName?: string | null,
        overrideAcIds?: number[] | null,
        overrideAcNames?: string[] | null
    ) => {
        setExtraLoading(true);
        try {
            const params = new URLSearchParams();
            if (overrideAcIds?.length) {
                // Vista de canal completo con múltiples IDs
                params.append('acIds', overrideAcIds.join(','));
                if (overrideAcNames?.length) params.append('acNames', overrideAcNames.join(','));
            } else if (overrideAcName?.toLowerCase().startsWith('oficina')) {
                // Vista de oficina: pasar TODOS los usuarioId de sus miembros
                // Así Q145 (TopSoc) y Q148 (CIs) se fetchean para cada AC y se mergean
                const memberIds = PERFILES_COMERCIALES
                    .filter(p => p.oficina === overrideAcName && p.usuarioId > 0)
                    .map(p => p.usuarioId);
                if (memberIds.length > 0) {
                    params.append('acIds', memberIds.join(','));
                    params.append('acName', overrideAcName);
                } else {
                    // Sin miembros con ID válido: traer todo sin filtro
                    params.append('isAdmin', 'true');
                }
            } else if (overrideAcId) {
                params.append('acId', String(overrideAcId));
                if (overrideAcName) params.append('acName', overrideAcName);
            } else if (user?.isAdmin && !overrideAcId) {
                params.append('isAdmin', 'true');
            } else if (!user?.isAdmin && user?.acId) {
                params.append('acId', user.acId);
                params.append('acName', user.acName);
            }
            params.append('year', String(selectedYear));
            const res = await fetch(`/api/regional/secundario?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setTopSoc(data.topSoc || []);
                setCisInv(data.cisInv || []);
                setCisInvFull(data.cisInvFull || []);
            }
        } catch (e: any) { 
            console.error("Extra data error", e); 
        } finally { 
            setExtraLoading(false); 
        }
    }, [user]);

    // Fetch manual o por cambio de filtro de Admin
    const loadData = useCallback(async (
        overrideAcId?: number | null,
        overrideAcName?: string | null,
        overrideAcIds?: number[] | null,
        overrideAcNames?: string[] | null,
        overrideCanal?: string | null,
        forceRefresh?: boolean
    ) => {
        setLoading(true); setError(null);
        try {
            const params = new URLSearchParams();
            params.append('t', String(Date.now()));
            if (forceRefresh) params.append('forceRefresh', 'true');

            if (overrideAcIds?.length) {
                // Vista de canal completo: múltiples IDs en paralelo
                params.append('acIds', overrideAcIds.join(','));
                if (overrideAcNames?.length) params.append('acNames', overrideAcNames.join(','));
            } else if (overrideAcId) {
                // Vista de un AC específico con ID en Metabase
                params.append('acId', String(overrideAcId));
                if (overrideAcName) params.append('acName', overrideAcName);
            } else if (overrideAcName) {
                // Filtro solo por nombre (Representantes, Comisionistas, Oficinas sin acId)
                // El servidor carga todo y post-filtra por nombre — NO tratar como admin global.
                params.append('acName', overrideAcName);
            } else if (user?.isAdmin && !overrideCanal) {
                // Vista General Admin sin ningún filtro explícito → retorna todo
                // Si hay overrideCanal, dejamos que el param 'canal' filtre sin isAdmin
                params.append('isAdmin', 'true');
            } else if (user?.acId) {
                // Usuario no admin visualizando su propio dashboard
                params.append('acId', user.acId);
                params.append('acName', user.acName);
            }

            // Propiedades transversales
            if (overrideCanal && overrideCanal !== 'all') {
                params.append('canal', overrideCanal);
            }
            
            params.append('year', String(selectedYear));
            params.append('timeframe', 'recent');

            const res = await fetch(`/api/regional?${params.toString()}`);
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            
            setLotesRaw(data.lotes || []);
            setLotesGlobalesRaw(data.lotesGlobales || []);
            setOpsOfRaw(data.opsOficina || []);
            setOfertasRaw(data.ofertas || []);
            setLU(new Date());
            setHistoryLoaded(false);

            // ── Fase 2: Carga histórica en segundo plano ──
            if (historyAbortRef.current) historyAbortRef.current.abort();
            historyAbortRef.current = new AbortController();
            
            params.set('timeframe', 'history');
            fetch(`/api/regional?${params.toString()}`, { signal: historyAbortRef.current.signal })
                .then(r => r.json())
                .then(hist => {
                    if (hist.error || !hist.opsOficina) return;
                    setOpsOfRaw(prev => [...hist.opsOficina, ...prev]);
                    setHistoryLoaded(true);
                })
                .catch(e => {
                    if (e.name !== 'AbortError') console.error('Error histórico:', e);
                });

            loadExtraData(overrideAcId, overrideAcName, overrideAcIds, overrideAcNames);

        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); setInitialLoad(false); }
    }, [user, loadExtraData]);

    const handleRefresh = useCallback(() => {
        if (user?.isAdmin && viewingAs) {
            // @ts-ignore
            loadData(viewingAs.id || null, viewingAs.nombre, viewingAs.acIds, viewingAs.acNames, viewingAs.canal, true);
        } else {
            loadData(null, null, null, null, null, true);
        }
    }, [user, viewingAs, loadData]);

    // Lógica de carga diferida (Mount initial)
    useEffect(() => {
        if (!hasLoadedExtra) {
            setHasLoadedExtra(true);
            if (!initialData) {
                loadData();
            } else {
                loadExtraData();
            }
        }
    }, [initialData, hasLoadedExtra, loadData, loadExtraData]);

    // ── Monitor Ofertas (Q185): tarjeta del día — aislado del resto del tablero ─
    // - Con acId → filtra por ese AC/representante (usuario comercial normal)
    // - Sin acId → trae todo sin filtro (admins, o viewingAs sin acId definido)
    useEffect(() => {
        const acId = viewContext?.acId ?? user?.acId;
        setMonitorOfertasLoading(true);
        // vacío = Q185 trae tutto; con id = filtrado
        const url = acId
            ? `/api/monitor-ofertas?id_usuario=${encodeURIComponent(acId)}`
            : `/api/monitor-ofertas`;
        fetch(url)
            .then(r => r.ok ? r.json() : { success: false, data: [] })
            .then(d => {
                if (d.success && Array.isArray(d.data)) {
                    setMonitorOfertas(d.data);
                }
            })
            .catch(e => console.error('[MonitorOfertas]', e))
            .finally(() => setMonitorOfertasLoading(false));
    // Recarga si cambia el usuario activo o el viewingAs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.acId, viewingAs?.id]);

    // ── Prefetch silencioso de tropas (calienta el cache YA) ─────────────────
    useEffect(() => {
        if (!user) return; // esperar sesión
        const hoyY = new Date().getFullYear();
        const y = selectedYear || hoyY;
        const p = new URLSearchParams({
            fecha_desde: `${y}-01-01`,
            fecha_hasta: `${y}-12-31`,
        });
        if (user?.isAdmin) p.set('isAdmin', 'true');
        else if (user?.acId) { p.set('acId', String(user.acId)); p.set('acName', user.acName || ''); }
        fetch(`/api/regional/tropas?${p.toString()}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d?.tropas) setTropasData(d.tropas); })
            .catch(() => {}); // silencioso
    // solo se dispara una vez por año/usuario
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.isAdmin, user?.acId, selectedYear]);

    const prevYearRef = useRef(selectedYear);
    useEffect(() => {
        if (hasLoadedExtra && selectedYear !== prevYearRef.current) {
            prevYearRef.current = selectedYear;
            const ctx = viewContext; // usando el source of truth local
            let idNum: number | undefined | null = undefined;
            if (viewingAs) {
                idNum = viewingAs.id || undefined;
            }
            loadData(idNum, ctx.acName, null, null, ctx.canal);
        }
    }, [selectedYear, hasLoadedExtra, loadData, viewContext, viewingAs]);

    const parseDateLocal = useCallback((ds: string | null) => {
        if (!ds) return new Date(NaN);
        const p = ds.includes('T') ? ds.split('T')[0].split('-') : ds.split(' ')[0].split('-');
        return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0) : new Date(ds);
    }, []);


    const years = useMemo(() => {
        const ys = new Set<number>();
        // Siempre incluir los últimos 5 años para poder navegar hacia atrás
        const currentYear = hoy.getFullYear();
        for (let y = currentYear - 4; y <= currentYear; y++) ys.add(y);
        // Sumar los años que haya en los datos
        opsOf.forEach(o => { const d = parseDateLocal(o.fecha_operacion); if (!isNaN(d.getTime())) ys.add(d.getFullYear()); });
        return Array.from(ys).sort((a, b) => b - a);
    }, [opsOf, parseDateLocal, hoy]);


    useEffect(() => {
        if (years.length > 0 && !years.includes(selectedYear) && opsOf.length > 0) {
            setYear(years[0]);
        }
    }, [years, selectedYear, opsOf.length]);

    const isWithinPeriod = useCallback((ds: string | null) => {
        if (!ds) return false;
        const d = parseDateLocal(ds);
        if (isNaN(d.getTime())) return false;

        if (d.getFullYear() !== selectedYear) return false;

        if (compMode === 'YTD') {
            // Aceptamos todo el año en curso para no perder ops si hay desfasaje de horas o fechas en Q95
            return true;
        }

        if (selectedMes === 0) return true;
        return (d.getMonth() + 1) === selectedMes;
    }, [selectedYear, selectedMes, compMode]);

    const lotesFiltrados = useMemo(() =>
        lotes.filter(l => isWithinPeriod(l.dia_hora_publicacion)), [lotes, isWithinPeriod]);

    const lotesPubFiltrados = useMemo(() => {
        // Mapeo previo de ofertasRaw
        const ofertasMap: Record<string, any[]> = {};
        ofertasRaw.forEach(o => {
            const k = String(o.id_lote);
            if (!ofertasMap[k]) ofertasMap[k] = [];
            ofertasMap[k].push(o);
        });

        // Lotes "puros" de la API de publicaciones (si existieran)
        const fromApi = lotesPublicaciones;
        const apiIds = new Set(fromApi.map((l: any) => String(l.id)));

        // Fuente principal: tropasData (query completa de tropas Q95, todos los estados)
        // Fallback: opsOf (datos del endpoint principal /api/regional)
        const source: any[] = tropasData || opsOf;

        // TODAS las tropas de la parte vendedora son un ofrecimiento, sin importar su estado.
        const fromQ95 = source
            .filter(op => {
                const acVend = (op.AC_Vend || '').trim();
                return acVend !== '' && acVend !== '—';
            })
            .map(op => {
                const ofs = ofertasMap[String(op.id_lote)] || [];
                return {
                    id: op.id_lote || 0,
                    categoria: op.categoria || op.Tipo || op.UN || 'S/D',
                    peso: Number(op.kg) || 0,
                    cabezas: Number(op.Cabezas) || 0,
                    raza: '—',
                    sociedad_vendedora: op.RS_Vendedora || '—',
                    representante: op.repre_vendedor || '—',
                    operador: op.AC_Vend || op.usuario_op || op.usuario_acotz || '—',
                    asociado_comercial: op.AC_Vend || '—',
                    provincia: (op.origen || '').split(',').pop()?.trim() || '—',
                    localidad: (op.origen || '').split(',')[0]?.trim() || '—',
                    dia_hora_publicacion: op.fecha_publicaciones || op.fecha_operacion || new Date().toISOString(),
                    Estado_Pub: op.Estado_Trop || op.estado_tropas || op.ESTADO || 'Ofrecimiento',
                    cant_ofertas: ofs.length,
                    ofertas: ofs
                };
            });

        // Unificar: la API dedicada tiene prioridad si el ID se repite.
        const finalQ95 = fromQ95.filter(l => !apiIds.has(String(l.id)));

        return [...fromApi, ...finalQ95].sort((a, b) => new Date(b.dia_hora_publicacion).getTime() - new Date(a.dia_hora_publicacion).getTime());
    }, [lotesPublicaciones, tropasData, opsOf, ofertasRaw]);

    const opsFiltradas = useMemo(() =>
        opsOf.filter(o => {
            if (filterCierre && o.Cierre !== 1) return false;
            return isWithinPeriod(o.fecha_operacion);
        }), [opsOf, isWithinPeriod, filterCierre]);

    const opsPeriodoRaw = useMemo(() =>
        opsOf.filter(o => isWithinPeriod(o.fecha_operacion))  // SIN filtro cierre — base para CCC y pipeline
    , [opsOf, isWithinPeriod]);


    const opsProcesando = useMemo(() => {
        const ESTADOS_PERMITIDOS = [
            'TROPAS VENDIDAS', 'TROPAS A CARGAR', 'TROPAS CARGADAS', 
            'TROPAS A LIQUIDAR', 'LIQUIDADAS', 'CERRADAS', 
            'NEGOCIOS TERMINADOS', 'PAGOS VENCIDOS'
        ];
        
        const permitidosUpper = ESTADOS_PERMITIDOS.map(e => e.toUpperCase());

        let procesando = opsOf.filter(o => {
            if (o.Cierre === 1) return false;
            // Si tiene estado general 'CONCRETADA' pero NO tiene un estado_tropas especificado, lo saltamos
            const et = (o.estado_tropas || '').trim().toUpperCase();
            if (!et) return false;
            
            return permitidosUpper.includes(et);
        });

        // Ordenar: Siempre primero las "TROPAS VENDIDAS", luego el resto
        procesando.sort((a, b) => {
            const etA = (a.estado_tropas || '').trim().toUpperCase();
            const etB = (b.estado_tropas || '').trim().toUpperCase();
            
            if (etA === 'TROPAS VENDIDAS' && etB !== 'TROPAS VENDIDAS') return -1;
            if (etA !== 'TROPAS VENDIDAS' && etB === 'TROPAS VENDIDAS') return 1;
            
            return 0; // Mantener orden original o podrias agregar un secundario por fecha
        });

        return procesando;
    }, [opsOf]);

    const totalOfertas = useMemo(() =>
        lotesFiltrados.reduce((s, l) => s + (l.cant_ofertas || 0), 0), [lotesFiltrados]);

    const periodoLabel = useMemo(() => {
        if (compMode === 'YTD') return `YTD ${MESES_FULL[selectedMes] || 'Año'} ${selectedYear}`;
        return `${MESES_FULL[selectedMes] || '—'} ${selectedYear}`;
    }, [compMode, selectedMes, selectedYear]);

    async function handleLogout() {
        await fetch('/api/auth', { method: 'DELETE' });
        window.location.href = '/login';
    }

    // ── Selector de comercial: lógica compartida entre sidebar y mobile drawer ─
    function handleAcSelect(val: string, closeMobile = false) {
        setSelectedAcFilter(val);
        if (val === 'all') {
            setViewingAs(null);
            loadData(null, null, null, null, selectedCanalFilter === 'all' ? null : selectedCanalFilter);
        } else if (val.startsWith('u:')) {
            const [idStr, ...nameParts] = val.slice(2).split('|');
            const nombre = nameParts.join('|');
            const id = Number(idStr);
            const usr = usuarios.find(a => a.id === id);
            setViewingAs({ nombre, email: usr?.email || '', id: usr?.id || null, canal: usr?.canal || null });
            if (usr?.canal === 'Oficina') {
                const memberIds = PERFILES_COMERCIALES
                    .filter(p => p.oficina === nombre && p.usuarioId > 0)
                    .map(p => p.usuarioId);
                const memberNames = PERFILES_COMERCIALES
                    .filter(p => p.oficina === nombre && p.usuarioId > 0)
                    .map(p => p.nombre);
                loadData(null, nombre, memberIds.length > 0 ? memberIds : null, memberNames.length > 0 ? memberNames : null, 'Oficina');
            } else {
                const esInterno = (usr?.canal === 'Regional' || usr?.canal === 'Comisionista' || usr?.canal === 'Representante' || usr?.canal === 'Representantes' || usr?.canal === 'Directo') && id > 0;
                loadData(esInterno ? id : null, nombre, null, null, usr?.canal ?? null);
            }
        }
        if (closeMobile) setMobileFilterOpen(false);
    }

    const showMonthYearPicker = true;

    // ── Tarjeta cabezas de oficina ─────────────────────────────────────────────
    // • Solo cabezas (sin resultado)
    // • Usa opsFiltradas + estado CONCRETADA → igual que Volumen Concretado de KPIsRegional
    // • DEDUPLICACIÓN: cuando ambos lados son de la oficina (intra-oficina),
    //   se suma 1 sola vez al TOTAL y se atribuye al VENDEDOR en el breakdown
    //   → así suma(aportes individuales) == total (sin duplicados visibles)
    const oficinaCabezasCard = useMemo(() => {
        const nombreOficina = viewContext.acName;
        if (!nombreOficina || !nombreOficina.toLowerCase().startsWith('oficina')) return null;
        const miembros = PERFILES_COMERCIALES.filter(p => p.oficina === nombreOficina);
        if (miembros.length === 0) return null;
        const nombresSet = new Set(miembros.map(m => m.nombre.toLowerCase().trim()));

        const concretadas = opsFiltradas.filter(
            (o: any) => (o.estado_general || '').toUpperCase() === 'CONCRETADA'
        );

        const cbzsPorAc: Record<string, number> = {};
        const socsPorAc: Record<string, Set<string>> = {};
        miembros.forEach(m => { 
            cbzsPorAc[m.nombre] = 0; 
            socsPorAc[m.nombre] = new Set<string>();
        });
        let directaCbzs = 0;
        const directaSocsSet = new Set<string>();
        let totalCbzs = 0;

        const sociedadesSet = new Set<string>();

        concretadas.forEach((o: any) => {
            const vend = (o.AC_Vend || '').toLowerCase().trim();
            const comp = (o.AC_Comp || '').toLowerCase().trim();
            const vendIsOffice = nombresSet.has(vend);
            const compIsOffice = nombresSet.has(comp);
            const cbzs = Number(o.Cabezas) || 0;

            if (!vendIsOffice && !compIsOffice) {
                directaCbzs += cbzs;
                totalCbzs += cbzs;
                if (o.RS_Vendedora && o.RS_Vendedora.trim() !== '' && o.RS_Vendedora.trim() !== '—') directaSocsSet.add(o.RS_Vendedora.trim().toUpperCase());
                if (o.RS_Compradora && o.RS_Compradora.trim() !== '' && o.RS_Compradora.trim() !== '—') directaSocsSet.add(o.RS_Compradora.trim().toUpperCase());
                return;
            }

            // Sociedades únicas para los comerciales de la oficina
            if (vendIsOffice && o.RS_Vendedora && o.RS_Vendedora.trim() !== '' && o.RS_Vendedora.trim() !== '—') {
                sociedadesSet.add(o.RS_Vendedora.trim().toUpperCase());
            }
            if (compIsOffice && o.RS_Compradora && o.RS_Compradora.trim() !== '' && o.RS_Compradora.trim() !== '—') {
                sociedadesSet.add(o.RS_Compradora.trim().toUpperCase());
            }

            totalCbzs += cbzs;

            if (vendIsOffice) {
                miembros.forEach(m => {
                    if (m.nombre.toLowerCase().trim() === vend) {
                        cbzsPorAc[m.nombre] = (cbzsPorAc[m.nombre] || 0) + cbzs;
                        if (o.RS_Vendedora && o.RS_Vendedora.trim() !== '' && o.RS_Vendedora.trim() !== '—') socsPorAc[m.nombre].add(o.RS_Vendedora.trim().toUpperCase());
                    }
                });
            }
            if (compIsOffice) {
                miembros.forEach(m => {
                    if (m.nombre.toLowerCase().trim() === comp) {
                        cbzsPorAc[m.nombre] = (cbzsPorAc[m.nombre] || 0) + cbzs;
                        if (o.RS_Compradora && o.RS_Compradora.trim() !== '' && o.RS_Compradora.trim() !== '—') socsPorAc[m.nombre].add(o.RS_Compradora.trim().toUpperCase());
                    }
                });
            }
        });

        const sociedades = Array.from(sociedadesSet).sort();

        return { nombreOficina, totalCbzs, miembros, cbzsPorAc, socsPorAc, directaCbzs, directaSocsSet, sociedades };
    }, [viewContext.acName, opsFiltradas]);

    if (initialLoad) {
        return (
            <div className="min-h-screen bg-[#0a1128] bg-gradient-to-br from-[#0a1128] via-[#102a5c] to-[#040814] text-white flex flex-col items-center justify-center font-sans tracking-tight z-[100] fixed inset-0 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="relative flex flex-col items-center z-10 animate-in fade-in zoom-in duration-700">
                    <div className="mb-6 relative">
                        <div className="absolute inset-0 bg-blue-400/20 blur-2xl rounded-full" />
                        <Image src="/favicon.ico" alt="DeCampoACampo" width={96} height={96} priority className="w-20 h-20 sm:w-24 sm:h-24 relative z-10 drop-shadow-2xl rounded-2xl"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black mb-3 text-center tracking-tighter drop-shadow-lg" style={{ fontFamily: 'var(--font-outfit)' }}>
                        de<span className="opacity-70">Campo</span><span className="text-[#F59E0B] italic">a</span><span className="opacity-70">campo</span>
                    </h1>
                    <div className="h-px w-16 bg-gradient-to-r from-transparent via-blue-400/50 to-transparent mb-6" />
                    <p className="text-blue-100/70 mb-12 text-sm sm:text-base text-center max-w-sm px-6 font-medium leading-relaxed" style={{ fontFamily: 'var(--font-inter)' }}>
                        Conectando con el motor de análisis y preparando el <strong className="text-white font-semibold">Tablero Ganadero</strong>...
                    </p>
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-10 h-10">
                            <svg className="animate-spin text-white/10 w-full h-full absolute" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            </svg>
                            <svg className="animate-spin text-[#F59E0B] w-full h-full absolute" viewBox="0 0 24 24" fill="none">
                                <path stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="16 40" d="M12 2a10 10 0 1010 10" />
                            </svg>
                        </div>
                        <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-blue-300 drop-shadow-md">
                            Sincronizando
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    const hideRanking = user?.isAdmin;

    // ── Guard: usuario @decampoacampo.com sin ID configurado ─────────────────
    if (isUnconfigured) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 max-w-md w-full p-8 text-center">
                    <div className="text-5xl mb-4">🔒</div>
                    <h1 className="text-xl font-black text-slate-800 mb-2">Cuenta no configurada</h1>
                    <p className="text-slate-500 text-sm mb-6">
                        Tu usuario <span className="font-semibold text-slate-700">{user?.email}</span> todavía no tiene acceso configurado en el tablero.
                    </p>
                    <p className="text-slate-400 text-sm mb-4">
                        Escribile a Santiago para que te den acceso:
                    </p>
                    <a
                        href={`mailto:sdewey@decampoacampo.com?subject=Acceso%20al%20Tablero&body=Hola%20Santiago%2C%20necesito%20acceso%20al%20tablero%20con%20mi%20usuario%20${encodeURIComponent(user?.email || '')}.`}
                        className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold px-5 py-3 rounded-xl transition-colors text-sm"
                    >
                        ✉️ sdewey@decampoacampo.com
                    </a>
                    <p className="text-slate-300 text-xs mt-6">
                        <a href="/api/auth/signout" className="hover:text-slate-500 transition-colors">Cerrar sesión</a>
                    </p>
                </div>
            </div>
        );
    }
    return (
        <div className="flex h-screen bg-[#ededed] font-sans overflow-hidden">
            {/* Sidebar — solo visible en md+ */}
            <aside className={`
        hidden md:flex flex-col flex-shrink-0 bg-white border-r border-[#ededed]
        transition-all duration-300 ease-in-out overflow-hidden
        ${sideOpen ? 'w-56' : 'w-14'}
      `}>
                <div className={`flex items-center justify-between w-full h-16 border-b border-[#ededed] px-3 flex-shrink-0 gap-3`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                            onClick={() => setSide(v => !v)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f8f8f8] transition-colors flex-shrink-0"
                            title={sideOpen ? 'Cerrar menú' : 'Abrir menú'}
                        >
                            <svg className="w-4 h-4 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        {sideOpen && (
                            <div className="overflow-hidden flex flex-col items-start min-w-0">
                                {previewUser && (
                                    <span className="text-[8px] font-black text-amber-600 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded uppercase tracking-wider mb-1">
                                        👁 Vista Previa Admin
                                    </span>
                                )}
                                <p className="text-sm font-semibold text-[#555555] whitespace-nowrap leading-tight truncate w-full">
                                    {viewingAs?.nombre || (user?.isAdmin ? 'Vista Admin' : user?.acName || 'Cargando...')}
                                </p>
                                <p className="text-[9px] text-[#888888] whitespace-nowrap uppercase tracking-wider">Tablero Comercial</p>
                                
                                {/* Toggle Mi Oficina para Comerciales */}
                                {!user?.isAdmin && userOficinaObj && (
                                    <button
                                        onClick={() => {
                                            if (viewingAs?.id === userOficinaObj.id) {
                                                // Volver a perfil individual
                                                setViewingAs(null);
                                                loadData(null, null);
                                            } else {
                                                // Ver oficina
                                                setViewingAs({
                                                    id: userOficinaObj.id,
                                                    nombre: userOficinaObj.nombre,
                                                    canal: 'Oficina',
                                                    email: userOficinaObj.email
                                                });
                                                loadData(userOficinaObj.id, userOficinaObj.nombre, null, null, 'Oficina');
                                            }
                                        }}
                                        className="mt-1.5 text-[8px] font-semibold px-2 py-0.5 rounded-md bg-[#eaf2f6] text-[#3179a7] hover:bg-[#bfd5e4] transition-colors border border-[#bfd5e4]"
                                    >
                                        {viewingAs?.id === userOficinaObj.id ? `← Volver a Mi Perfil` : `Ver ${userOficinaObj.nombre}`}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    {sideOpen && (
                        <div className="flex-shrink-0 cursor-pointer group" onClick={() => setSide(false)}>
                            <span className="text-[9px] font-bold text-[#b0b0b0] group-hover:text-gray-600 uppercase tracking-widest transition-colors flex items-center gap-1.5">
                                ←<span>Esconder</span>
                            </span>
                        </div>
                    )}
                </div>

                <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto min-h-0">
                    {VIEWS.filter(v => !(v as any).adminOnly || user?.isAdmin).map(v => (
                        <button
                            key={v.id}
                            onClick={() => {
                                if (activeView === v.id) handleRefresh();
                                else setView(v.id);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative ${activeView === v.id
                                ? 'bg-[#3179a7] text-white'
                                : 'text-[#666666] hover:bg-[#f8f8f8] hover:text-[#555555]'
                                }`}
                            title={!sideOpen ? v.label : undefined}
                        >
                            <span className="text-lg flex-shrink-0 w-5 text-center">{v.icon}</span>
                            {sideOpen && (
                                <span className="text-xs font-medium truncate flex-1 text-left">{v.label}</span>
                            )}
                            {activeView === v.id && sideOpen && (
                                <div className="absolute right-3 hidden group-hover:block transition-all" title="Click para Actualizar">
                                    <svg className={`w-3.5 h-3.5 text-white/60 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" />
                                    </svg>
                                </div>
                            )}
                        </button>
                    ))}
                </nav>

                {sideOpen && (
                    <div className="border-t border-[#ededed] px-3 py-4 space-y-4 flex-shrink-0">

                        {user?.isAdmin && (
                            <div className="pt-2 border-t border-[#ededed] space-y-2">
                                <p className="text-[9px] font-semibold text-[#888888] uppercase tracking-wider mb-1 mt-3">Filtro Admin (Canal)</p>
                                <select
                                    value={selectedCanalFilter}
                                    onChange={(e) => {
                                        const c = e.target.value;
                                        setSelectedCanalFilter(c);
                                        setSelectedAcFilter('all');
                                        setViewingAs(null);
                                        
                                        if (c === 'all') {
                                            loadData(null, null, null, null, null);
                                        } else if (c === 'Oficina') {
                                            // Para canal Oficina, Q95 no tiene ese valor en Canal_Venta.
                                            // Usamos los IDs de TODOS los miembros de todas las oficinas.
                                            const allMemberIds = PERFILES_COMERCIALES
                                                .filter(p => p.oficina && p.usuarioId > 0)
                                                .map(p => p.usuarioId);
                                            const allMemberNames = PERFILES_COMERCIALES
                                                .filter(p => p.oficina && p.usuarioId > 0)
                                                .map(p => p.nombre);
                                            loadData(null, null, allMemberIds, allMemberNames, 'Oficina');
                                        } else {
                                            loadData(null, null, null, null, c);
                                        }
                                    }}
                                    className="w-full text-xs px-2 py-1.5 border border-[#bfd5e4] rounded-lg outline-none bg-[#eaf2f6] text-[#3179a7] font-medium"
                                >
                                    <option value="all">— Mostrar Todos —</option>
                                    {usuariosAgrupados.map(([canal]) => (
                                        <option key={canal} value={canal}>{canal}</option>
                                    ))}
                                </select>

                                <p className="text-[9px] font-semibold text-[#888888] uppercase tracking-wider mb-1 mt-3">Filtro Admin (Comercial)</p>
                                <ComercialCombobox
                                    value={selectedAcFilter}
                                    onChange={(val) => handleAcSelect(val)}
                                    grupos={usuariosAgrupados}
                                    filterCanal={selectedCanalFilter}
                                    size="sm"
                                />

                                {/* Chip: qué está viendo */}
                                {selectedAcFilter !== 'all' && (
                                    <div className="flex items-center justify-between bg-[#eef6ea] border border-[#cae2bd] rounded-lg px-2 py-1">
                                        <span className="text-[10px] text-[#3c731f] font-medium truncate">
                                            {viewingAs?.nombre || selectedAcFilter}
                                        </span>
                                        <button
                                            onClick={() => {
                                                setSelectedAcFilter('all');
                                                setSelectedCanalFilter('all');
                                                setViewingAs(null);
                                                loadData(null, null);
                                            }}
                                            className="ml-1 text-[10px] text-emerald-400 hover:text-red-500 font-black flex-shrink-0"
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {showMonthYearPicker && (
                            <div>
                                <p className="text-[9px] font-semibold text-[#888888] uppercase tracking-wider mb-1">Período</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        value={selectedMes}
                                        onChange={e => setMes(Number(e.target.value))}
                                        className="w-full text-xs px-2 py-1.5 border border-[#ededed] rounded-lg outline-none bg-[#f8f8f8] text-[#555555] font-medium"
                                    >
                                        <option value={0}>Todo el Año</option>
                                        {MESES.map((m, i) => i === 0 ? null : (
                                            <option key={i} value={i}>{m}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={e => setYear(Number(e.target.value))}
                                        className="w-full text-xs px-2 py-1.5 border border-[#ededed] rounded-lg outline-none bg-[#f8f8f8] text-[#555555] font-medium"
                                    >
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={() => setCierre(v => !v)}
                            className={`w-full text-[10px] font-semibold py-1.5 rounded-lg transition-all ${filterCierre ? 'bg-[#54a22b] text-white' : 'bg-[#f8f8f8] text-[#555555] border border-[#ededed]'}`}
                        >
                            CIERRE
                        </button>
                        {filterCierre ? (
                            <p className="text-[9px] text-[#3c731f] font-medium leading-snug">
                                Mostrando solo operaciones ya liquidadas (cobradas o cerradas en el período).
                            </p>
                        ) : (
                            <p className="text-[9px] text-[#888888] leading-snug">
                                Activar para ver solo operaciones con fecha de cierre en el período (liquidadas).
                            </p>
                        )}
                        <p className="text-[9px] text-[#888888] text-center">{periodoLabel}</p>
                        
                        <div className="pt-2 border-t border-[#ededed] flex justify-center">
                            <button
                                onClick={() => setNightMode(v => !v)}
                                className={`text-[10px] w-full font-medium py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${nightMode ? 'bg-[#153346] text-[#bfd5e4] border border-[#235677]' : 'bg-[#f8f8f8] text-[#555555] border border-[#ededed] hover:bg-[#ededed]'}`}
                            >
                                {nightMode ? '🌙 MODO NOCTURNO' : '☀️ MODO DÍA'}
                            </button>
                        </div>
                    </div>
                )}

                {!sideOpen && (
                    <div className="border-t border-[#ededed] py-3 flex flex-col items-center gap-2 flex-shrink-0">
                        <span className="text-gray-400 text-sm" title={periodoLabel}>🗓</span>
                    </div>
                )}

                <div className={`border-t border-[#ededed] p-3 flex-shrink-0 ${sideOpen ? '' : 'flex justify-center'}`}>
                    {sideOpen ? (
                        <div className="space-y-2">
                            {lastUpdated && (
                                <p className="text-[9px] text-[#888888]" suppressHydrationWarning>
                                    ⏱ {lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                            <div className="flex items-center gap-1.5 justify-center">
                                <button
                                    onClick={handleLogout}
                                    className="px-4 py-1.5 flex items-center gap-2 rounded-lg hover:bg-[#fdefef] text-[#888888] hover:text-[#d25859] transition-colors"
                                    title="Cerrar sesión"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    <span className="text-[10px] font-bold">Cerrar Sesión</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <button onClick={handleLogout} title="Salir"
                                className="p-1.5 rounded-lg hover:bg-[#fdefef] text-[#c0c0c0] hover:text-[#d25859] transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* ── Bottom Nav — solo mobile ── */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-[#ededed] flex items-center justify-around px-1 pt-1.5 pb-2">
                {[
                    { id: 'dashboard',     icon: '📊', label: 'Inicio' },
                    { id: 'tropas',        icon: '🐄', label: 'Tropas' },
                    { id: 'publicaciones', icon: '🤝', label: 'Ofrecim.' },
                    { id: 'monitorCis',    icon: '📈', label: 'Monitor CI' },
                    { id: 'notas',         icon: '📝', label: 'Notas' },
                ].map(v => (
                    <button key={v.id} onClick={() => setView(v.id)}
                        className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all ${activeView === v.id ? 'text-[#3179a7]' : 'text-[#888888]'}`}
                    >
                        <span className="text-xl leading-none">{v.icon}</span>
                        <span className={`text-[9px] font-semibold ${activeView === v.id ? 'text-[#3179a7]' : 'text-[#888888]'}`}>{v.label}</span>
                    </button>
                ))}
            </nav>

            <main className="flex-1 overflow-hidden flex flex-col">
                <header className="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-20 px-3 md:px-6 h-12 md:h-14 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{VIEWS.find(v => v.id === activeView)?.icon}</span>
                        <h1 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                            {VIEWS.find(v => v.id === activeView)?.label}
                        </h1>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        {viewingAs && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full font-bold border border-orange-200 animate-pulse text-[9px]">
                                👁 {viewingAs.nombre.replace('Canal: ', '')}
                                <button onClick={() => { setViewingAs(null); setSelectedAcFilter('all'); setSelectedCanalFilter('all'); loadData(null, null); }}
                                    className="ml-0.5 text-orange-400 hover:text-orange-700 font-black leading-none">×</button>
                            </span>
                        )}
                        <span className="hidden sm:block text-[#c0c0c0]">deCampoacampo</span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full font-bold">{periodoLabel}</span>
                        <span className={`hidden sm:block px-2 py-0.5 rounded-full font-bold text-[9px] ${compMode === 'YTD' ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-700'}`}>
                            {compMode === 'YTD' ? 'YTD' : 'vs año'}
                        </span>
                        {/* Botón Filtros Mobile */}
                        <button
                            onClick={() => setMobileFilterOpen(true)}
                            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-[#eaf2f6] text-[#3179a7] hover:bg-[#bfd5e4] transition-colors ml-1"
                            title="Filtros"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                            </svg>
                        </button>
                        <div className="ml-2 pl-2 border-l border-gray-200">
                             {/* NotificationCenter removido */}
                        </div>
                    </div>
                </header>

                {/* ── Drawer filtros mobile ─────────────────────────── */}
                {mobileFilterOpen && (
                    <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setMobileFilterOpen(false)}>
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                        {/* Drawer */}
                        <div
                            className="relative bg-white rounded-t-2xl shadow-2xl px-4 pt-3 pb-8 space-y-4 max-h-[85vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Handle */}
                            <div className="flex justify-center mb-1">
                                <div className="w-10 h-1 bg-gray-300 rounded-full" />
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-black text-gray-900">📱 Menú</p>
                                <button onClick={() => setMobileFilterOpen(false)} className="text-gray-400 hover:text-gray-700 text-lg font-black">×</button>
                            </div>

                            {/* ── Navegación: todas las hojas ── */}
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Secciones</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {VIEWS.filter(v => !(v as any).adminOnly || user?.isAdmin).map(v => (
                                        <button
                                            key={v.id}
                                            onClick={() => { setView(v.id); setMobileFilterOpen(false); }}
                                            className={`flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-semibold transition-all ${
                                                activeView === v.id
                                                    ? 'bg-[#3179a7] text-white'
                                                    : 'bg-[#f8f8f8] text-[#555555] hover:bg-[#ededed]'
                                            }`}
                                        >
                                            <span className="text-base">{v.icon}</span>
                                            <span className="text-xs leading-tight">{v.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-2">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3">Filtros</p>
                            </div>

                            {/* Filtros Admin */}
                            {user?.isAdmin && (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Canal</p>
                                    <select
                                        value={selectedCanalFilter}
                                        onChange={(e) => {
                                            const c = e.target.value;
                                            setSelectedCanalFilter(c);
                                            setSelectedAcFilter('all');
                                            setViewingAs(null);
                                            if (c === 'all') loadData(null, null, null, null, null);
                                            else loadData(null, null, null, null, c);
                                        }}
                                        className="w-full text-sm px-3 py-2.5 border border-[#bfd5e4] rounded-xl outline-none bg-[#eaf2f6] text-[#3179a7] font-medium"
                                    >
                                        <option value="all">— Mostrar Todos —</option>
                                        {usuariosAgrupados.map(([canal]) => (
                                            <option key={canal} value={canal}>{canal}</option>
                                        ))}
                                    </select>

                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Comercial</p>
                                    <ComercialCombobox
                                        value={selectedAcFilter}
                                        onChange={(val) => handleAcSelect(val, true)}
                                        grupos={usuariosAgrupados}
                                        filterCanal={selectedCanalFilter}
                                        size="md"
                                    />
                                </div>
                            )}

                            {/* Período */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Período</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        value={selectedMes}
                                        onChange={e => setMes(Number(e.target.value))}
                                        className="w-full text-sm px-3 py-2.5 border border-[#ededed] rounded-xl outline-none bg-[#f8f8f8] text-[#555555] font-medium"
                                    >
                                        <option value={0}>Todo el Año</option>
                                        {MESES.map((m, i) => i === 0 ? null : (
                                            <option key={i} value={i}>{m}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={e => setYear(Number(e.target.value))}
                                        className="w-full text-sm px-3 py-2.5 border border-[#ededed] rounded-xl outline-none bg-[#f8f8f8] text-[#555555] font-medium"
                                    >
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* ── Vista Oficina (solo para AC de oficina) ── */}
                            {!user?.isAdmin && userOficinaObj && (
                                <div className="bg-[#eaf2f6] border border-[#bfd5e4] rounded-xl p-3">
                                    <p className="text-[10px] font-semibold text-[#3179a7] uppercase tracking-wider mb-2">📍 Mi Oficina</p>
                                    <button
                                        onClick={() => {
                                            if (viewingAs?.id === userOficinaObj.id) {
                                                setViewingAs(null);
                                                loadData(null, null);
                                            } else {
                                                setViewingAs({
                                                    id: userOficinaObj.id,
                                                    nombre: userOficinaObj.nombre,
                                                    canal: 'Oficina',
                                                    email: userOficinaObj.email
                                                });
                                                loadData(userOficinaObj.id, userOficinaObj.nombre, null, null, 'Oficina');
                                            }
                                            setMobileFilterOpen(false);
                                        }}
                                        className={`w-full text-sm font-black py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
                                            viewingAs?.id === userOficinaObj.id
                                                ? 'bg-[#3179a7] text-white'
                                                : 'bg-white text-[#3179a7] border border-[#bfd5e4] hover:bg-[#eaf2f6]'
                                        }`}
                                    >
                                        {viewingAs?.id === userOficinaObj.id
                                            ? `← Volver a Mi Perfil`
                                            : `Ver ${userOficinaObj.nombre}`}
                                    </button>
                                </div>
                            )}

                            {/* CIERRE */}
                            <button
                                onClick={() => setCierre(v => !v)}
                                className={`w-full text-sm font-semibold py-3 rounded-xl transition-all ${filterCierre ? 'bg-[#54a22b] text-white' : 'bg-[#f8f8f8] text-[#555555] border border-[#ededed]'}`}
                            >
                                {filterCierre ? '✅ MODO CIERRE ACTIVO' : 'CIERRE'}
                            </button>
                            {filterCierre && (
                                <p className="text-[10px] text-emerald-600 font-semibold">
                                    Mostrando solo operaciones liquidadas en el período.
                                </p>
                            )}

                            {/* Modo día/noche */}
                            <button
                                onClick={() => setNightMode(v => !v)}
                                className={`w-full text-sm font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${nightMode ? 'bg-indigo-900 text-indigo-100' : 'bg-gray-100 text-gray-600'}`}
                            >
                                {nightMode ? '🌙 MODO NOCTURNO' : '☀️ MODO DÍA'}
                            </button>

                            {/* Cerrar sesión */}
                            <button
                                onClick={handleLogout}
                                className="w-full text-sm font-bold py-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                )}


                <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-8 space-y-4 md:space-y-5 lg:space-y-7 pb-20 md:pb-6">
                    {loading && (
                        <CowLoader message="Actualizando el Tablero Ganadero..." />
                    )}

                    {error && !loading && (
                        <div className="p-6 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm flex items-center gap-3">
                            <span>⚠️</span> Error: {error}
                            <button onClick={() => loadData()} className="ml-auto underline font-semibold">Reintentar</button>
                        </div>
                    )}



                    {!loading && !error && (
                        <>
                            {activeView === 'dashboard' && (
                                <div className="space-y-5 lg:space-y-7">
                                    {/* --- WELCOME CARD --- */}
                                    <div className="bg-gradient-to-r from-[#173a5a] to-[#245b84] rounded-2xl p-5 md:p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-5 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
                                        <div className="absolute bottom-0 left-10 w-32 h-32 bg-white opacity-5 rounded-full translate-y-1/2"></div>
                                        <div className="relative z-10 w-full md:w-auto">
                                            <p className="text-blue-100 text-lg md:text-xl font-bold tracking-wide mb-1 drop-shadow-sm flex items-center flex-wrap gap-2">
                                                ¡Bienvenido, {(user?.email && ADMIN_NAMES[user.email.toLowerCase()]) || viewContext.acName?.split(' ')[0] || user?.acName?.split(' ')[0] || 'Equipo'}!
                                                {viewingAs && (
                                                    <span className="text-[10px] bg-orange-500/30 text-orange-100 border border-orange-400/50 px-2 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                                        👁 Viendo como {viewingAs.nombre.replace('Canal: ', '')}
                                                    </span>
                                                )}
                                            </p>
                                            <h2 className="text-xl md:text-2xl font-black capitalize drop-shadow-md leading-none mb-1 text-white/90">{new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h2>
                                            <p className="text-blue-100/80 text-sm font-medium capitalize">{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })} • Resumen del día</p>
                                        </div>
                                        
                                        {isCurrentPeriod ? (
<div className="relative z-10 flex flex-wrap xl:flex-nowrap gap-3 sm:gap-4 md:gap-6 xl:gap-8 bg-black/20 p-3 sm:p-4 md:p-5 rounded-xl border border-white/10 w-full md:w-auto justify-between md:justify-start shadow-inner text-center items-center">
                                            <div 
                                                className="flex flex-col items-center justify-between h-full cursor-pointer hover:bg-white/10 p-2 rounded-lg transition-colors"
                                                onClick={() => setModalStats({ title: 'Ofrecimientos Activos', list: statsHoy.ofrecimientos.list, type: 'lote' })}
                                            >
                                                <div className="flex items-center justify-center min-h-[20px] gap-1 mb-1 relative z-20 w-full">
                                                    <span className="text-[10px] md:text-xs text-blue-200 uppercase tracking-wider font-bold whitespace-nowrap">Ofrecimientos</span>
                                                    <InfoTooltip text="Son TODAS las tropas/ofertas donde actuás como parte vendedora que ingresaron al sistema bajo esa fecha de publicación, sin importar su estado final o posterior (Concretadas, No Concretadas, Dadas de Baja)." />
                                                </div>
                                                <span className="text-2xl md:text-3xl font-black text-white drop-shadow-md">{statsHoy.ofrecimientos.t} <span className="text-sm font-normal text-blue-200 uppercase tracking-widest bg-white/10 px-1 rounded">lotes</span></span>
                                                <span className="text-[10px] text-blue-100 font-semibold">{statsHoy.ofrecimientos.c.toLocaleString('es-AR')} cabezas</span>
                                            </div>
                                            <div className="w-px bg-white/10 hidden md:block"></div>
                                            <div 
                                                className="flex flex-col items-center justify-between h-full cursor-pointer hover:bg-white/10 p-2 rounded-lg transition-colors"
                                                onClick={() => setModalStats({ title: 'Ofertas Hoy', list: statsHoy.ofertas.list, type: 'oferta' })}
                                            >
                                                <div className="flex items-center justify-center min-h-[20px] mb-1 w-full gap-1">
                                                    <span className="text-[10px] md:text-xs text-blue-200 uppercase tracking-wider font-bold whitespace-nowrap">Ofertas Hoy</span>
                                                    {monitorOfertasLoading && <span className="w-2 h-2 border border-amber-400/60 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
                                                </div>
                                                <span className="text-2xl md:text-3xl font-black text-amber-400 drop-shadow-md">{statsHoy.ofertas.t} <span className="text-sm font-normal text-amber-200/50 uppercase tracking-widest bg-amber-400/10 px-1 rounded">ofertas</span></span>
                                                <span className="text-[10px] text-amber-200/70 font-semibold">{statsHoy.ofertas.c.toLocaleString('es-AR')} cabezas</span>
                                            </div>
                                            <div className="w-px bg-white/10 hidden md:block"></div>
                                            <div 
                                                className="flex flex-col items-center justify-between h-full cursor-pointer hover:bg-white/10 p-2 rounded-lg transition-colors"
                                                onClick={() => setModalStats({ title: 'Ventas de Hoy', list: statsHoy.ventas.list, type: 'op' })}
                                            >
                                                <div className="flex items-center justify-center min-h-[20px] mb-1 w-full">
                                                    <span className="text-[10px] md:text-xs text-blue-200 uppercase tracking-wider font-bold whitespace-nowrap">Ventas Hoy</span>
                                                </div>
                                                <span className="text-2xl md:text-3xl font-black text-emerald-400 drop-shadow-md">{statsHoy.ventas.t} <span className="text-sm font-normal text-emerald-200/50 uppercase tracking-widest bg-emerald-400/10 px-1 rounded">lotes</span></span>
                                                <span className="text-[10px] text-emerald-200/70 font-semibold">{statsHoy.ventas.c.toLocaleString('es-AR')} cabezas</span>
                                            </div>
                                            <div className="w-px bg-white/10 hidden md:block"></div>
                                            <div 
                                                className="flex flex-col items-center justify-between h-full cursor-pointer hover:bg-white/10 p-2 rounded-lg transition-colors"
                                                onClick={() => setModalStats({ title: 'Compras de Hoy', list: statsHoy.compras.list, type: 'op' })}
                                            >
                                                <div className="flex items-center justify-center min-h-[20px] mb-1 w-full">
                                                    <span className="text-[10px] md:text-xs text-blue-200 uppercase tracking-wider font-bold whitespace-nowrap">Compras Hoy</span>
                                                </div>
                                                <span className="text-2xl md:text-3xl font-black text-[#5ba4d6] drop-shadow-md">{statsHoy.compras.t} <span className="text-sm font-normal text-blue-200/50 uppercase tracking-widest bg-[#5ba4d6]/10 px-1 rounded">lotes</span></span>
                                                <span className="text-[10px] text-blue-200/70 font-semibold">{statsHoy.compras.c.toLocaleString('es-AR')} cabezas</span>
                                            </div>
                                        </div>
                                        ) : (
                                            <div className="relative z-10 bg-black/20 px-5 py-4 rounded-xl border border-white/10 text-center">
                                                <p className="text-blue-200/70 text-xs uppercase tracking-widest font-bold mb-1">Período seleccionado</p>
                                                <p className="text-white text-xl font-black capitalize">{MESES_FULL[selectedMes] || 'Todo el año'} {selectedYear}</p>
                                                <p className="text-blue-100/50 text-xs mt-1">Los datos de hoy solo se muestran en el período actual</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Tarjeta Cabezas de Oficina ── */}
                                    {oficinaCabezasCard && (
                                    <div className="bg-white rounded-2xl border border-blue-100 shadow-sm relative z-10">
                                        <div className="px-5 py-4 border-b border-blue-50 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between rounded-t-2xl">
                                            <div>
                                                <div className="flex items-center">
                                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">🏢 {oficinaCabezasCard.nombreOficina}</h3>
                                                    <InfoTooltip text="Mide el total consolidado de entidades o volumen de la oficina completa, depurado de duplicados internos (si dos compañeros operan juntos, solo cuenta 1 vez)." />
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-0.5">Cabezas totales — sin duplicados entre ACs</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-3xl font-black text-blue-700">{oficinaCabezasCard.totalCbzs.toLocaleString('es-AR')}</p>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">cbzs</p>
                                            </div>
                                        </div>
                                        <div className="p-4">
                                            <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-2">
                                                <div className="flex items-center">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Aporte individual</p>
                                                    <InfoTooltip text="El volumen individual muestra el sumatorio al que aportó cada comercial. Si un negocio es compartido por 2 compañeros, la suma superará el total consolidado, por eso se miden por separado." />
                                                </div>
                                                <div className="flex bg-gray-100/80 rounded-lg p-0.5 border border-gray-200">
                                                    <button onClick={() => setOfficeMapMode('cbz')} className={`px-2 py-1 text-[9px] rounded-md font-bold transition-all ${officeMapMode === 'cbz' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Cabezas</button>
                                                    <button onClick={() => setOfficeMapMode('soc')} className={`px-2 py-1 text-[9px] rounded-md font-bold transition-all ${officeMapMode === 'soc' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Sociedades</button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {oficinaCabezasCard.miembros
                                                    .sort((a, b) => {
                                                        const valA = officeMapMode === 'cbz' ? (oficinaCabezasCard.cbzsPorAc[a.nombre] || 0) : (oficinaCabezasCard.socsPorAc[a.nombre]?.size || 0);
                                                        const valB = officeMapMode === 'cbz' ? (oficinaCabezasCard.cbzsPorAc[b.nombre] || 0) : (oficinaCabezasCard.socsPorAc[b.nombre]?.size || 0);
                                                        return valB - valA;
                                                    })
                                                    .map(m => {
                                                        const val = officeMapMode === 'cbz' ? (oficinaCabezasCard.cbzsPorAc[m.nombre] || 0) : (oficinaCabezasCard.socsPorAc[m.nombre]?.size || 0);
                                                        const maxValItem = officeMapMode === 'cbz' 
                                                            ? Math.max(...oficinaCabezasCard.miembros.map(x => oficinaCabezasCard.cbzsPorAc[x.nombre] || 0), oficinaCabezasCard.directaCbzs)
                                                            : Math.max(...oficinaCabezasCard.miembros.map(x => oficinaCabezasCard.socsPorAc[x.nombre]?.size || 0), oficinaCabezasCard.directaSocsSet.size);
                                                        const barPct = (val / Math.max(maxValItem, 1)) * 100;
                                                        const absoluteTotal = officeMapMode === 'cbz' ? Math.max(oficinaCabezasCard.totalCbzs, 1) : Math.max(oficinaCabezasCard.sociedades.length, 1);
                                                        const labelPct = (val / absoluteTotal) * 100;
                                                        if (val === 0) return null;
                                                        return (
                                                            <div key={m.nombre} className="flex items-center gap-3">
                                                                <span className="text-[10px] font-bold text-gray-600 w-36 truncate">{m.nombre}</span>
                                                                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                                    <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${barPct}%` }} />
                                                                </div>
                                                                <span className="text-[10px] font-black text-gray-700 w-16 text-right whitespace-nowrap">{val.toLocaleString('es-AR')} {officeMapMode === 'soc' && <span className="text-[8px] font-medium text-gray-400">socs</span>}</span>
                                                                <span className="text-[9px] text-gray-400 w-8 text-right">{Math.round(labelPct)}%</span>
                                                            </div>
                                                        );
                                                    })}
                                                {/* Fila Directa */}
                                                {(officeMapMode === 'cbz' ? oficinaCabezasCard.directaCbzs : oficinaCabezasCard.directaSocsSet.size) > 0 && (() => {
                                                        const val = officeMapMode === 'cbz' ? oficinaCabezasCard.directaCbzs : oficinaCabezasCard.directaSocsSet.size;
                                                        const maxValItem = officeMapMode === 'cbz' 
                                                            ? Math.max(...oficinaCabezasCard.miembros.map(x => oficinaCabezasCard.cbzsPorAc[x.nombre] || 0), oficinaCabezasCard.directaCbzs)
                                                            : Math.max(...oficinaCabezasCard.miembros.map(x => oficinaCabezasCard.socsPorAc[x.nombre]?.size || 0), oficinaCabezasCard.directaSocsSet.size);
                                                        const barPct = (val / Math.max(maxValItem, 1)) * 100;
                                                        const absoluteTotal = officeMapMode === 'cbz' ? Math.max(oficinaCabezasCard.totalCbzs, 1) : Math.max(oficinaCabezasCard.sociedades.length, 1);
                                                        const labelPct = (val / absoluteTotal) * 100;
                                                        return (
                                                            <div className="flex items-center gap-3 pt-1 border-t border-gray-100 mt-1">
                                                                <span className="text-[10px] font-bold text-gray-400 w-36 truncate italic">Directa / Repre</span>
                                                                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                                    <div className="bg-gray-300 h-full rounded-full transition-all duration-500" style={{ width: `${barPct}%` }} />
                                                                </div>
                                                                <span className="text-[10px] font-black text-gray-400 w-16 text-right whitespace-nowrap">{val.toLocaleString('es-AR')} {officeMapMode === 'soc' && <span className="text-[8px] font-medium text-gray-300">socs</span>}</span>
                                                                <span className="text-[9px] text-gray-300 w-8 text-right">{Math.round(labelPct)}%</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <KPIsRegional
                                        lotes={lotesFiltrados}
                                        opsOficina={opsFiltradas}
                                        opsPeriodoRaw={opsPeriodoRaw}
                                        totalOfertas={totalOfertas}
                                        opsAll={opsOf}
                                        selectedMes={selectedMes}
                                        selectedYear={selectedYear}
                                        compMode={compMode}
                                        showBothSides={user?.isAdmin}
                                        acFilter={viewContext.acName}
                                        filterCierre={filterCierre}
                                        officeMemberNames={
                                            viewContext.acName?.toLowerCase().startsWith('oficina')
                                                ? PERFILES_COMERCIALES
                                                    .filter(p => p.oficina === viewContext.acName)
                                                    .map(p => p.nombre)
                                                : undefined
                                        }
                                    />
                                    <div className="relative">
                                        {!historyLoaded && (
                                            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl border border-blue-100 dark:border-blue-900 border-dashed">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Cargando histórico...</span>
                                                </div>
                                            </div>
                                        )}
                                        {renderGraphics ? (
                                            <div className="min-h-[400px]">
                                                <EvolucionAnual opsAll={opsOf} selectedYear={selectedYear} filterCierre={filterCierre} historyLoaded={historyLoaded} />
                                            </div>
                                        ) : (
                                            <div className="h-[400px] w-full bg-slate-50 dark:bg-slate-900 rounded-xl" />
                                        )}
                                    </div>
                                    {renderGraphics && (
                                        <div className="w-full">
                                            <PublicacionesCard
                                                acName={viewContext.acName}
                                                acId={viewContext.acId}
                                                canal={viewContext.canal}
                                                isAdmin={viewContext.isAdmin}
                                                selectedYear={selectedYear}
                                                selectedMes={selectedMes}
                                                filterCierre={filterCierre}
                                                opsAll={opsOfRaw}
                                            />
                                        </div>
                                    )}
                                    {user?.isAdmin && !hideRanking && <RankingAC ops={opsFiltradas} filterOficina={viewContext.acName ?? undefined} />}
                                    <MercadoInsightsCard />
                                    <PagosPanel ops={opsOf} />
                                    <NoConcretadasPanel ops={opsFiltradas} />
                                </div>
                            )}
                            {activeView === 'tropas' && (
                                <EstadoTropas
                                    acId={viewContext.acId}
                                    acName={viewContext.acName}
                                    canal={viewContext.canal}
                                    isAdmin={viewContext.isAdmin}
                                    selectedYear={selectedYear}
                                    selectedMes={selectedMes}
                                    filterCierre={filterCierre}
                                    refreshTrigger={refreshTrigger}
                                    lotes={lotesFiltrados}
                                    initialTropas={tropasData}
                                />
                            )}
                            {activeView === 'publicaciones' && <Publicaciones lotes={lotesPubFiltrados} acFilter={viewContext.acName} />}
                            {activeView === 'sociedades' && (
                                extraLoading ? (
                                    <CowLoader message="Cargando Top Sociedades..." />
                                ) : (
                                    <TopSociedades 
                                        sociedades={topSoc} 
                                        selectedMes={selectedMes} 
                                        selectedYear={selectedYear} 
                                        acFilter={user?.isAdmin ? (viewingAs?.id ? viewingAs?.nombre : null) : (user?.acName || null)}
                                    />
                                )
                            )}
                            {activeView === 'notas' && <NotasPersonales userId={user?.acId || 'admin'} />}
                            {activeView === 'insights' && (
                                <InsightsClient
                                    acId={viewContext.acId?.toString()}
                                    acName={viewContext.acName}
                                    isAdmin={user?.isAdmin}
                                    canal={viewContext.canal}
                                    selectedYear={selectedYear}
                                    selectedMes={selectedMes}
                                />
                            )}
                            {activeView === 'asignaciones' && (
                                <Asignaciones
                                    acFilter={user?.isAdmin ? (viewingAs?.nombre || null) : (user?.acName || null)}
                                    opsAll={opsFiltradas}
                                    selectedYear={selectedYear}
                                    selectedMes={selectedMes}
                                    filterCierre={filterCierre}
                                />
                            )}
                            {activeView === 'monitorCis' && (
                                extraLoading ? (
                                    <CowLoader message="Sincronizando Monitor CIs..." />
                                ) : (
                                    <MonitorCIs cisInv={cisInv} cisInvFull={cisInvFull} acName={selectedAcFilter !== 'all' ? selectedAcFilter : (user?.isAdmin ? null : user?.acName)} acId={viewContext.acId} topSoc={topSoc} />
                                )
                            )}
                            {activeView === 'auditoria' && user?.isAdmin && (
                                <AuditoriaComerciales
                                    ops={opsFiltradas}
                                    canal={viewContext.canal}
                                    selectedYear={selectedYear}
                                    selectedMes={selectedMes}
                                    filterCierre={filterCierre}
                                />
                            )}
                        </>
                    )}

                    <div className="border-t border-gray-100 pt-4 text-center">
                        <p className="text-[9px] text-gray-300">Tablero General · {new Date().getFullYear()} · DeCampoACampo</p>
                    </div>
                </div>
            </main>
            
            {modalStats && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-xl font-black text-gray-800">{modalStats.title}</h3>
                            <button onClick={() => setModalStats(null)} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto bg-gray-50">
                            {modalStats.list.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No hay registros para mostrar hoy.</p>
                            ) : (
                                <div className="space-y-3">
                                    {modalStats.list.map((item, idx) => {
                                        const type = modalStats.type;
                                        const refInt = item.id_lote || item.ref_int || item.Ref_Int || item.id_oferta || item.id || '-';
                                        const cabezas = item.cantidad || item.Cabezas || item.cabezas || item.cant_cabezas || 0;
                                        const baseCat = String(item.cat_abrev || item.categoria || item.Categoria || item.categoria_abv || item.UN || '');
                                        const categoria = baseCat.replace(/&ntilde;/gi, 'ñ').replace(/&Ntilde;/gi, 'Ñ');
                                        const estado = item.estado_tropas || item.Estado_Pub || item.Estado || item.respuesta || 'Activo';
                                        const fmtNum = (n: any) => Number(n || 0).toLocaleString('es-AR');

                                        return (
                                            <div key={idx} className="bg-white border text-sm rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-blue-300 transition-colors shadow-sm">
                                                <div className="flex-1 w-full">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-gray-900">Ref: {refInt}</span>
                                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">{cabezas} cabezas</span>
                                                        <span className="text-gray-500 font-medium text-xs bg-gray-100 px-2 py-0.5 rounded">{categoria}</span>
                                                    </div>

                                                    {type === 'lote' && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                                                            <p className="text-gray-500">Vendedor: <span className="text-gray-800 font-medium">{item.RS_Vendedora || item.sociedad_vendedora || '-'}</span></p>
                                                            <p className="text-gray-500">Comercial: <span className="text-blue-700 font-medium">{item.AC_Vend || item.vendedor_ac || '-'}</span></p>
                                                            <p className="text-gray-500">Precio Sugerido: <span className="text-emerald-700 font-bold">{item.precio_sugerido ? `${item.moneda === 'USD' ? 'U$D' : '$'} ${item.precio_sugerido}` : '-'}</span></p>
                                                            <p className="text-gray-500">Plazo: <span className="text-gray-800 font-medium">{item.plazo || item.condicion || '-'}</span></p>
                                                            <p className="text-gray-500">Kg Promedio: <span className="text-gray-800 font-medium">{item.kg_promedio || item.kg || '-'} kg</span></p>
                                                        </div>
                                                    )}

                                                    {type === 'oferta' && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                                                            {/* Legajo del lote publicado — desde Q185 */}
                                                            <p className="text-gray-500">Publicado por: <span className="text-gray-800 font-medium">{item.soc_vendedora || item.RS_Vendedora || item.sociedad_vendedora || '-'}</span></p>
                                                            <p className="text-gray-500">Categoría: <span className="text-gray-800 font-medium">{item.cat_abrev || item.categoria || item.UN || '-'}{item.peso ? ` · ${item.peso} kg` : ''}</span></p>
                                                            <p className="text-gray-500">Origen: <span className="text-gray-800 font-medium">{[item.partido_origen, item.prov_origen].filter(Boolean).join(', ') || item.origen || '-'}</span></p>
                                                            <p className="text-gray-500">Estado tropa: <span className="font-medium text-gray-700">{item.estado_tropa || item.Estado_Trop || '-'}</span></p>
                                                            {/* Datos de la oferta recibida */}
                                                            <div className="sm:col-span-2 border-t border-gray-100 pt-1.5 mt-0.5 grid grid-cols-2 gap-x-4 gap-y-1">
                                                                <p className="text-gray-500">Ofertante: <span className="text-gray-800 font-medium">{item.soc_of || item.RS_Compradora || item.soc_compradora || '-'}</span></p>
                                                                <p className="text-gray-500">Resp: <span className={(() => { const r = String(item.resp_oferta || '').toUpperCase(); return r.includes('ACEPT') ? 'text-emerald-600 font-bold' : r.includes('RECHA') || r.includes('BAJA') ? 'text-red-600 font-bold' : 'text-gray-700 font-medium'; })()}>{item.resp_oferta || '-'}</span></p>
                                                                <p className="text-gray-500">Precio oferta: <span className="text-emerald-700 font-bold">${item.precio_of ?? item.cotiza_usd ?? item.precio ?? '-'}</span></p>
                                                                <p className="text-gray-500">Plazo: <span className="text-gray-800 font-medium">{item.plazo_of ?? item.plazo ?? '-'}</span></p>
                                                                {(item.com_of !== undefined && item.com_of !== null) && <p className="text-gray-500">Com.: <span className="font-medium">{item.com_of}%</span></p>}
                                                                {!!item.valor_total_oferta && <p className="text-gray-500">Valor tot.: <span className="font-bold text-gray-800">$ {Number(item.valor_total_oferta).toLocaleString('es-AR')}</span></p>}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {type === 'op' && (
                                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                                            {/* Col 1: Vendedor */}
                                                            <div className="bg-[#eaf2f6] border border-[#bfd5e4] rounded-xl px-3 py-2">
                                                                <p className="text-[9px] text-[#3179a7] font-bold uppercase tracking-wider mb-1">🏷️ Vendedor</p>
                                                                <p className="text-[11px] font-black text-gray-900 leading-tight">{item.RS_Vendedora || item.sociedad_vendedora || '—'}</p>
                                                                {item.AC_Vend && <p className="text-[9px] text-[#235677] font-semibold mt-0.5">AC: {item.AC_Vend}</p>}
                                                                {item.repre_vendedor && <p className="text-[9px] text-gray-500">{item.repre_vendedor}</p>}
                                                                {item.Canal_Venta && <p className="text-[9px] text-gray-400">{item.Canal_Venta}</p>}
                                                            </div>
                                                            {/* Col 2: Comprador */}
                                                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                                                                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mb-1">🛒 Comprador</p>
                                                                <p className="text-[11px] font-black text-gray-900 leading-tight">{item.RS_Compradora || item.soc_compradora || '—'}</p>
                                                                {item.AC_Comp && <p className="text-[9px] text-emerald-800 font-semibold mt-0.5">AC: {item.AC_Comp}</p>}
                                                                {item.repre_comprador && <p className="text-[9px] text-gray-500">{item.repre_comprador}</p>}
                                                                {item.Canal_compra && <p className="text-[9px] text-gray-400">{item.Canal_compra}</p>}
                                                            </div>
                                                            {/* Col 3: Financiero */}
                                                            <div className="space-y-1.5">
                                                                {item.precio && (
                                                                    <div className="bg-gray-50 rounded-lg px-3 py-1.5">
                                                                        <p className="text-[9px] text-gray-400 font-bold uppercase">Precio</p>
                                                                        <p className="text-[11px] font-black text-emerald-700">{item.moneda === 'USD' ? 'U$D' : '$'} {item.precio} <span className="text-[9px] text-gray-400 font-normal">({item.kg || item.kg_promedio || '—'} kg)</span></p>
                                                                    </div>
                                                                )}
                                                                {(item.importe_vendedor || item.importe_comprador || item.importe) && (
                                                                    <div className="bg-gray-50 rounded-lg px-3 py-1.5">
                                                                        <p className="text-[9px] text-gray-400 font-bold uppercase">Importe</p>
                                                                        <p className="text-[11px] font-black text-gray-800">{item.moneda === 'USD' ? 'U$D' : '$'} {fmtNum(item.importe_vendedor || item.importe_comprador || item.importe || 0)}</p>
                                                                    </div>
                                                                )}
                                                                {(item.resultado_final || item.total_r) && (
                                                                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                                                                        <p className="text-[9px] text-amber-500 font-bold uppercase">Resultado</p>
                                                                        <p className="text-[11px] font-black text-amber-700">$ {fmtNum(item.resultado_final || item.total_r || 0)}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="text-right shrink-0 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 w-full md:w-auto h-full flex flex-col justify-center">
                                                    <p className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">Estado</p>
                                                    <p className="font-semibold text-gray-900 leading-tight">{estado}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
