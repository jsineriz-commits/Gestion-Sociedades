import { USUARIOS_SISTEMA, UsuarioSist } from './usuarios';

// ─── Asociados Comerciales de la Oficina Río Cuarto ─────────────────────────
export interface AcDef {
    nombre: string;
    id: number;           // ID de operador en Metabase
    iniciales: string;
    colorGrad: string;    // Tailwind gradient (bg-gradient-to-br)
    colorSolid: string;   // Tailwind bg sólido
    colorBar: string;     // Gradiente para barras de progreso
    colorBadge: string;   // Tailwind clases para badges
    colorAvatar: string;  // Tailwind bg para avatar
    email: string;        // Email de Google Workspace para auth
    canal: string;        // Categoría (Regional, Oficina, Representantes, Comisionista)
    oficina?: string;     // Oficina a la que pertenece (visto en los AC Regionales)
}

const PALETTE = [
    { grad: 'from-blue-500 to-blue-700', bg: 'bg-blue-600', text: 'text-blue-700', ring: 'ring-blue-200', bgLight: 'bg-blue-50', bar: 'from-blue-500 to-blue-400' },
    { grad: 'from-indigo-500 to-indigo-700', bg: 'bg-indigo-600', text: 'text-indigo-700', ring: 'ring-indigo-200', bgLight: 'bg-indigo-50', bar: 'from-indigo-500 to-indigo-400' },
    { grad: 'from-emerald-500 to-emerald-700', bg: 'bg-emerald-600', text: 'text-emerald-700', ring: 'ring-emerald-200', bgLight: 'bg-emerald-50', bar: 'from-emerald-500 to-emerald-400' },
    { grad: 'from-rose-500 to-rose-700', bg: 'bg-rose-600', text: 'text-rose-700', ring: 'ring-rose-200', bgLight: 'bg-rose-50', bar: 'from-rose-500 to-rose-400' },
    { grad: 'from-amber-500 to-amber-700', bg: 'bg-amber-500', text: 'text-amber-700', ring: 'ring-amber-200', bgLight: 'bg-amber-50', bar: 'from-amber-400 to-amber-300' },
    { grad: 'from-violet-500 to-violet-700', bg: 'bg-violet-600', text: 'text-violet-700', ring: 'ring-violet-200', bgLight: 'bg-violet-50', bar: 'from-violet-500 to-violet-400' },
    { grad: 'from-teal-500 to-teal-700', bg: 'bg-teal-600', text: 'text-teal-700', ring: 'ring-teal-200', bgLight: 'bg-teal-50', bar: 'from-teal-500 to-teal-400' },
];

/** Convierte un array de UsuarioSist al tipo enriquecido AcDef (paleta de colores + iniciales) */
export function mapUsuarios(raw: UsuarioSist[]): AcDef[] {
    return raw.map((u, i) => {
        const p = PALETTE[i % PALETTE.length];
        const words = u.nombre.split(' ');
        const iniciales = words.length >= 2
            ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
            : u.nombre.substring(0, 2).toUpperCase();
        return {
            nombre: u.nombre,
            id: u.id,
            iniciales,
            colorGrad: p.grad,
            colorSolid: p.bg,
            colorBar: p.bar,
            colorBadge: `${p.bgLight} ${p.text} ${p.ring}`,
            colorAvatar: p.bg,
            email: u.email,
            canal: u.canal,
            oficina: u.oficina,
        };
    });
}

// Array vacío — la fuente real viene de Google Sheets via /api/usuarios.
// DashboardClient recibe los usuarios como prop `initialUsuarios` y los mapea en runtime.
export const TODOS_LOS_USUARIOS: AcDef[] = mapUsuarios(USUARIOS_SISTEMA);

// Guardamos retrocompatibilidad temporal para código que use ACS_OFICINA
export const ACS_OFICINA = TODOS_LOS_USUARIOS.filter(u => u.canal === 'Regional' || u.canal === 'Oficina');

// ─── Administradores (Acceso total al tablero sin filtros) ───────────────────
// Agregar acá los mails que tienen acceso admin (ven todo, sin filtro por ID_Usuario).
// Cuando el usuario envíe los mails, agregarlos a este array.
export const ADMIN_EMAILS: string[] = [
    'sdewey@decampoacampo.com',
    'arivas@decampoacampo.com',
    'asegobia@decampoacampo.com',
    'eherz@decampoacampo.com',
    'erimoldi@decampoacampo.com',
    'icavanagh@decampoacampo.com',
    'jtonon@decampoacampo.com',
    'jsineriz@decampoacampo.com',
    'lbortolin@decampoacampo.com',
    'ptaffarel@decampoacampo.com',
    'plopezmeyer@decampoacampo.com',
    'spalacios@decampoacampo.com',
    'inapoli@decampoacampo.com',
    'josemd@decampoacampo.com',
];

export const ADMIN_NAMES: Record<string, string> = {
    'sdewey@decampoacampo.com': 'Santos',
    'arivas@decampoacampo.com': 'Aguja',
    'asegobia@decampoacampo.com': 'Agustín',
    'eherz@decampoacampo.com': 'Emilio',
    'erimoldi@decampoacampo.com': 'Enzo',
    'icavanagh@decampoacampo.com': 'Nacho',
    'jtonon@decampoacampo.com': 'Juanse',
    'jsineriz@decampoacampo.com': 'Juan',
    'lbortolin@decampoacampo.com': 'Lan',
    'ptaffarel@decampoacampo.com': 'Pauli',
    'plopezmeyer@decampoacampo.com': 'Peter',
    'spalacios@decampoacampo.com': 'Pala',
    'inapoli@decampoacampo.com': 'Napo',
    'josemd@decampoacampo.com': 'Pepe',
};

export function isAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    const emailLower = email.toLowerCase();
    // 1. Check lista explícita
    if (ADMIN_EMAILS.map(e => e.toLowerCase()).includes(emailLower)) return true;
    // 2. Check canal Admin en USUARIOS_SISTEMA
    const user = getAcByEmail(email);
    return user ? (user.canal === 'Admin') : false;
}

export function getAcByEmail(email: string | null | undefined): AcDef | undefined {
    if (!email) return undefined;
    const lowerEmail = email.toLowerCase();
    return TODOS_LOS_USUARIOS.find(a => a.email.toLowerCase() === lowerEmail);
}

// Directa (operaciones sin AC asignado)
export const AC_DIRECTA = {
    nombre: 'Directa', iniciales: 'DR',
    colorGrad: 'from-gray-400 to-gray-500',
    colorSolid: 'bg-slate-500',
    colorBar: 'from-slate-400 to-slate-300',
    colorBadge: 'bg-slate-50 text-slate-600 ring-slate-200',
    colorAvatar: 'bg-slate-500',
} as const;

// Helpers rápidos
export const AC_NOMBRES = TODOS_LOS_USUARIOS.map(a => a.nombre);

export function getAcByNombre(nombre: string): AcDef | undefined {
    return TODOS_LOS_USUARIOS.find(a => a.nombre.toLowerCase() === nombre.toLowerCase());
}

// ─── Oficina ─────────────────────────────────────────────────────────────────
export const OFICINA_ID = 696;
export const REPRESENTANTE_OFICINA = 'Oficina Rio 4to';

// ─── Unidades de Negocio ─────────────────────────────────────────────────────
export const UN_LIST = ['Faena', 'Invernada', 'Cría', 'MAG'] as const;
export type UN = typeof UN_LIST[number];

export const UN_COLOR: Record<string, string> = {
    Faena: 'bg-blue-500',
    Invernada: 'bg-red-500',
    Cría: 'bg-yellow-400',
    Cria: 'bg-yellow-400',
    MAG: 'bg-green-500',
};
