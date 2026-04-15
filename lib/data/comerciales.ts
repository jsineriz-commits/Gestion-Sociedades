// ─────────────────────────────────────────────────────────────────────────────
// lib/comerciales.ts
//
// Perfiles enriquecidos de los comerciales — SEPARADO de lib/usuarios.ts.
// Agrega campos: oficina, codigo, provincia, partido, tipo.
// NO modifica ni importa de lib/usuarios.ts para evitar dependencias circulares.
// ─────────────────────────────────────────────────────────────────────────────

export interface PerfilComercial {
    usuarioId: number;
    correo: string;
    nombre: string;
    canal: string;         // Regional | Oficina | Operario de carga | Corporate
    codigo: string;        // Iniciales del comercial (FS, VT, etc.)
    provincia: string;
    partido: string;
    oficina?: string;      // Oficina a la que pertenece (para el botón de vista)
    tipo?: string;         // Regional | Operario de carga | Corporate | Oficina
}

export const PERFILES_COMERCIALES: PerfilComercial[] = [
    // ── Sin Oficina ───────────────────────────────────────────────────────────
    { usuarioId: 20128, correo: 'aacuna@decampoacampo.com', nombre: 'Agustin Acuna', canal: 'Regional', codigo: 'AA', provincia: 'Buenos Aires', partido: 'CABA', tipo: 'Representante' },
    { usuarioId: 117393, correo: 'amascotena@decampoacampo.com', nombre: 'Agustin Mascotena', canal: 'Regional', codigo: 'AM', provincia: 'Buenos Aires', partido: 'Coronel Suarez' },
    { usuarioId: 49567, correo: 'agarcia@decampoacampo.com', nombre: 'Alan Garcia', canal: 'Regional', codigo: 'AG', provincia: 'La Pampa', partido: 'Santa Rosa' },
    { usuarioId: 109444, correo: 'mbarboza@decampoacampo.com', nombre: 'Marcelo Barboza', canal: 'Regional', codigo: 'MB', provincia: 'Formosa', partido: 'Formosa' },
    { usuarioId: 82766, correo: 'jolmedo@decampoacampo.com', nombre: 'Jose Olmedo', canal: 'Regional', codigo: 'JO', provincia: 'Santa Fe', partido: 'Rosario' },
    { usuarioId: 110007, correo: 'lsposito@decampoacampo.com', nombre: 'Lucia Sposito', canal: 'Regional', codigo: 'LS', provincia: 'Buenos Aires', partido: 'Tandil' },
    { usuarioId: 112939, correo: 'pcieri@decampoacampo.com', nombre: 'Pablo Cieri', canal: 'Regional', codigo: 'PC', provincia: 'Buenos Aires', partido: 'Saladillo' },
    { usuarioId: 48871, correo: 'saduriz@decampoacampo.com', nombre: 'Simon De Aduriz', canal: 'Regional', codigo: 'SA', provincia: 'Buenos Aires', partido: 'Coronel Pringles', tipo: 'Corporate' },
    { usuarioId: 0, correo: 'mrapp@decampoacampo.com', nombre: 'Marcelo Rapp', canal: 'Regional', codigo: 'MR', provincia: 'Misiones', partido: 'Apostoles' },
    { usuarioId: 0, correo: 'areyno@decampoacampo.com', nombre: 'Augusto Reynot', canal: 'Operario de carga', codigo: 'AR', provincia: 'Cordoba', partido: 'Rio 4to', oficina: 'Oficina Rio 4to' },

    // ── Oficina Ayacucho ──────────────────────────────────────────────────────
    { usuarioId: 115379, correo: 'fsansot@decampoacampo.com', nombre: 'Facundo Sansot', canal: 'Regional', codigo: 'FS', provincia: 'Buenos Aires', partido: 'Tandil', oficina: 'Oficina Ayacucho' },

    // ── Oficina Bavio ─────────────────────────────────────────────────────────
    { usuarioId: 87064, correo: 'esanchez@decampoacampo.com', nombre: 'Emiliano Sanchez', canal: 'Regional', codigo: 'ES', provincia: 'Buenos Aires', partido: 'Magdalena', oficina: 'Oficina Bavio' },
    { usuarioId: 82763, correo: 'ssaparrat@decampoacampo.com', nombre: 'Sebastian Saparrat', canal: 'Regional', codigo: 'SS', provincia: 'Buenos Aires', partido: 'Magdalena', oficina: 'Oficina Bavio' },
    { usuarioId: 0, correo: 'fruete@decampoacampo.com', nombre: 'Facundo Ruete', canal: 'Operario de carga', codigo: 'FR', provincia: 'Buenos Aires', partido: 'Magdalena', oficina: 'Oficina Bavio' },

    // ── Oficina Buenos Aires Central ──────────────────────────────────────────
    { usuarioId: 113764, correo: 'spoullion@decampoacampo.com', nombre: 'Sebastian Poullion', canal: 'Regional', codigo: 'SP', provincia: 'Buenos Aires', partido: 'Bolivar', oficina: 'Oficina Bs As Central' },
    { usuarioId: 115336, correo: 'idiehl@decampoacampo.com', nombre: 'Ignacio Diehl', canal: 'Regional', codigo: 'ID', provincia: 'Buenos Aires', partido: 'Bolivar', oficina: 'Oficina Bs As Central', tipo: 'Oficina' },

    // ── Oficina Central (Corporate) ───────────────────────────────────────────
    { usuarioId: 101887, correo: 'lfrutos@decampoacampo.com', nombre: 'Lucila Frutos', canal: 'Regional', codigo: 'LF', provincia: 'Buenos Aires', partido: 'CABA', oficina: 'Oficina Central', tipo: 'Corporate' },

    // ── Oficina Entre Rios ────────────────────────────────────────────────────
    { usuarioId: 110006, correo: 'hganis@decampoacampo.com', nombre: 'Hugo Ganis', canal: 'Regional', codigo: 'HG', provincia: 'Entre Rios', partido: 'Federal', oficina: 'Oficina Entre Rios' },
    { usuarioId: 91953, correo: 'jloza@decampoacampo.com', nombre: 'Juan José Loza', canal: 'Regional', codigo: 'JL', provincia: 'Entre Rios', partido: 'La Paz', oficina: 'Oficina Entre Rios' },
    { usuarioId: 36755, correo: 'mpons@decampoacampo.com', nombre: 'Manuel Pons', canal: 'Regional', codigo: 'MP', provincia: 'Entre Rios', partido: 'Gualeguaychu', oficina: 'Oficina Entre Rios' },
    { usuarioId: 112941, correo: 'nechezarreta@decampoacampo.com', nombre: 'Nicolas Echezarreta', canal: 'Regional', codigo: 'NE', provincia: 'Entre Rios', partido: 'Concordia', oficina: 'Oficina Entre Rios' },
    { usuarioId: 105876, correo: 'abroggi@decampoacampo.com', nombre: 'Alejo Broggi', canal: 'Operario de carga', codigo: 'AB', provincia: 'Entre Rios', partido: 'Gualeguaychu', oficina: 'Oficina Entre Rios' },

    // ── Oficina Rio 4to ───────────────────────────────────────────────────────
    { usuarioId: 56283, correo: 'vtorriglia@decampoacampo.com', nombre: 'Valentin Torriglia', canal: 'Regional', codigo: 'VT', provincia: 'Cordoba', partido: 'Rio 4to', oficina: 'Oficina Rio 4to' },
    { usuarioId: 69562, correo: 'sjulian@decampoacampo.com', nombre: 'Santiago Julian', canal: 'Regional', codigo: 'SJ', provincia: 'Cordoba', partido: 'Rio 4to', oficina: 'Oficina Rio 4to' },
    { usuarioId: 80328, correo: 'dmenghi@decampoacampo.com', nombre: 'David Menghi', canal: 'Regional', codigo: 'DM', provincia: 'Cordoba', partido: 'Rio 4to', oficina: 'Oficina Rio 4to' },
    { usuarioId: 95000, correo: 'adeambrocio@decampoacampo.com', nombre: 'Alexis Deambrocio', canal: 'Regional', codigo: 'AD', provincia: 'Cordoba', partido: 'Rio 4to', oficina: 'Oficina Rio 4to' },
    { usuarioId: 113392, correo: 'srivarola@decampoacampo.com', nombre: 'Sebastian Rivarola', canal: 'Regional', codigo: 'SR', provincia: 'Cordoba', partido: 'Las Perdices', oficina: 'Oficina Rio 4to' },
    { usuarioId: 112581, correo: 'falonso@decampoacampo.com', nombre: 'Facundo Alonso', canal: 'Operario de carga', codigo: 'FA', provincia: 'Cordoba', partido: 'Rio 4to', oficina: 'Oficina Rio 4to' },
];

/** Obtener el perfil enriquecido de un comercial por email */
export function getPerfilByEmail(email: string): PerfilComercial | undefined {
    if (!email) return undefined;
    return PERFILES_COMERCIALES.find(p => p.correo.toLowerCase() === email.toLowerCase());
}

/** Obtener todos los comerciales de una oficina específica */
export function getComencialesByOficina(oficina: string): PerfilComercial[] {
    return PERFILES_COMERCIALES.filter(p => p.oficina === oficina);
}

/** Mapa de oficinas → nombre del AC de Oficina en Metabase */
export const OFICINAS_MAP: Record<string, string> = {
    'Oficina Ayacucho': 'Oficina Ayacucho',
    'Oficina Bavio': 'Oficina Bavio',
    'Oficina Buenos Aires Central': 'Oficina Bs As Central',
    'Oficina Rio 4to': 'Oficina Rio 4to',
    'Oficina Entre Rios': 'Oficina Entre Rios',
    'Oficina Central': 'Oficina Central',
};
