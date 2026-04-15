export interface UsuarioSist {
    id: number;
    email: string;
    nombre: string;
    canal: string;
    oficina?: string;
}

// Fuente real de datos: Google Sheets vía /api/usuarios
// (Planilla: 1FpgyFCw2hibi3w_jArtohKUxPhvfUpnF9SDDI3YI-aI, hoja "Usuarios" GID 1192272172)
// Este array se mantiene vacío — solo existe por compatibilidad con imports existentes.
export const USUARIOS_SISTEMA: UsuarioSist[] = [];



export interface UsuarioCanon {
    perfil: 1 | 2;
    usuarioId: number;
    correo: string;
    nombre: string;
    canal: string; // Regional | Oficina | Representantes | Comisionista | Operario de carga
}

export const USUARIOS_CANONICOS: UsuarioCanon[] = [
    // ── Perfil 1: Internos ────────────────────────────────────────────────────
    { perfil: 1, usuarioId: 20128, correo: 'aacuna@decampoacampo.com', nombre: 'Agustin Acuna', canal: 'Regional' },
    { perfil: 1, usuarioId: 117393, correo: 'amascotena@decampoacampo.com', nombre: 'Agustin Mascotena', canal: 'Regional' },
    { perfil: 1, usuarioId: 49567, correo: 'agarcia@decampoacampo.com', nombre: 'Alan Garcia', canal: 'Regional' },
    { perfil: 1, usuarioId: 105876, correo: 'abroggi@decampoacampo.com', nombre: 'Alejo Broggi', canal: 'Operario de carga' },
    { perfil: 1, usuarioId: 95000, correo: 'adeambrocio@decampoacampo.com', nombre: 'Alexis Deambrocio', canal: 'Regional' },
    { perfil: 1, usuarioId: 80328, correo: 'dmenghi@decampoacampo.com', nombre: 'David Menghi', canal: 'Regional' },
    { perfil: 1, usuarioId: 87064, correo: 'esanchez@decampoacampo.com', nombre: 'Emiliano Sanchez', canal: 'Regional' },
    { perfil: 1, usuarioId: 112581, correo: 'falonso@decampoacampo.com', nombre: 'Facundo Alonso', canal: 'Operario de carga' },
    { perfil: 1, usuarioId: 115379, correo: 'fsansot@decampoacampo.com', nombre: 'Facundo Sansot', canal: 'Regional' },
    { perfil: 1, usuarioId: 110006, correo: 'hganis@decampoacampo.com', nombre: 'Hugo Ganis', canal: 'Regional' },
    { perfil: 1, usuarioId: 115336, correo: 'idiehl@decampoacampo.com', nombre: 'Ignacio Diehl', canal: 'Regional' },
    { perfil: 1, usuarioId: 82766, correo: 'jolmedo@decampoacampo.com', nombre: 'Jose Olmedo', canal: 'Regional' },
    { perfil: 1, usuarioId: 91953, correo: 'jloza@decampoacampo.com', nombre: 'Juan José Loza', canal: 'Regional' },
    { perfil: 1, usuarioId: 110007, correo: 'lsposito@decampoacampo.com', nombre: 'Lucia Sposito', canal: 'Regional' },
    { perfil: 1, usuarioId: 101887, correo: 'lfrutos@decampoacampo.com', nombre: 'Lucila Frutos', canal: 'Regional' },
    { perfil: 1, usuarioId: 36755, correo: 'mpons@decampoacampo.com', nombre: 'Manuel Pons', canal: 'Regional' },
    { perfil: 1, usuarioId: 109444, correo: 'mbarboza@decampoacampo.com', nombre: 'Marcelo Barboza', canal: 'Regional' },
    { perfil: 1, usuarioId: 112941, correo: 'nechezarreta@decampoacampo.com', nombre: 'Nicolas Echezarreta', canal: 'Regional' },
    { perfil: 1, usuarioId: 112939, correo: 'pcieri@decampoacampo.com', nombre: 'Pablo Cieri', canal: 'Regional' },
    { perfil: 1, usuarioId: 69562, correo: 'sjulian@decampoacampo.com', nombre: 'Santiago Julian', canal: 'Regional' },
    { perfil: 1, usuarioId: 113764, correo: 'spoullion@decampoacampo.com', nombre: 'Sebastian Poullion', canal: 'Regional' },
    { perfil: 1, usuarioId: 113392, correo: 'srivarola@decampoacampo.com', nombre: 'Sebastian Rivarola', canal: 'Regional' },
    { perfil: 1, usuarioId: 82763, correo: 'ssaparrat@decampoacampo.com', nombre: 'Sebastian Saparrat', canal: 'Regional' },
    { perfil: 1, usuarioId: 48871, correo: 'saduriz@decampoacampo.com', nombre: 'Simon De Aduriz', canal: 'Regional' },
    { perfil: 1, usuarioId: 56283, correo: 'vtorriglia@decampoacampo.com', nombre: 'Valentin Torriglia', canal: 'Regional' },
    // ── Perfil 2: Oficinas ────────────────────────────────────────────────────
    { perfil: 2, usuarioId: 71247, correo: 'oficinabavio@decampoacampo.com', nombre: 'Oficina Bavio', canal: 'Oficina' },
    { perfil: 2, usuarioId: 80813, correo: 'bsascentral@decampoacampo.com', nombre: 'Oficina Bs As Central', canal: 'Oficina' },
    { perfil: 2, usuarioId: 100587, correo: 'entrerios@decampoacampo.com', nombre: 'Oficina Entre Rios', canal: 'Oficina' },
    { perfil: 2, usuarioId: 696, correo: 'riocuarto@decampoacampo.com', nombre: 'Oficina Rio 4to', canal: 'Oficina' },
    // ── Perfil 2: Representantes ──────────────────────────────────────────────
    { perfil: 2, usuarioId: 107943, correo: 'irastorzaagustin29@gmail.com', nombre: 'Agustin Irastorza', canal: 'Representantes' },
    { perfil: 2, usuarioId: 266, correo: 'bernardocreton@hotmail.com.ar', nombre: 'Alberto Brosa', canal: 'Representantes' },
    { perfil: 2, usuarioId: 9155, correo: 'alejandroballve@hotmail.com', nombre: 'Alejandro Ballve', canal: 'Representantes' },
    { perfil: 2, usuarioId: 298, correo: 'mariana.morla@rucamalen.com.ar', nombre: 'Alejandro Bridger', canal: 'Representantes' },
    { perfil: 2, usuarioId: 432, correo: 'egonzalezhaciendas@gmail.com', nombre: 'Escritorio Enrique Gonzalez', canal: 'Representantes' },
    { perfil: 2, usuarioId: 13125, correo: 'donpedrocarni@yahoo.com.ar', nombre: 'Esteban Enrique Avendaño', canal: 'Representantes' },
    { perfil: 2, usuarioId: 20324, correo: 'fecheverz80@gmail.com', nombre: 'Francisco Echeverz', canal: 'Representantes' },
    { perfil: 2, usuarioId: 111340, correo: 'francobarrionuevo@curuzu.net', nombre: 'Franco Barrionuevo', canal: 'Representantes' },
    { perfil: 2, usuarioId: 306, correo: 'aduriz2@pringles.com.ar', nombre: 'Gonzalo Aduriz', canal: 'Representantes' },
    { perfil: 2, usuarioId: 78552, correo: 'ignaciourruty@outlook.com.ar', nombre: 'Ignacio Urruty', canal: 'Representantes' },
    { perfil: 2, usuarioId: 15223, correo: 'luismdehagen@gmail.com', nombre: 'Luis Maria de Hagen', canal: 'Representantes' },
    { perfil: 2, usuarioId: 111622, correo: 'aguilarconsignaciones@gmail.com', nombre: 'Marcelo Aguilar', canal: 'Representantes' },
    { perfil: 2, usuarioId: 256, correo: 'mschafer@decampoacampo.com', nombre: 'Marcelo Schafer', canal: 'Representantes' },
    { perfil: 2, usuarioId: 33181, correo: 'mschanghaciendas@gmail.com', nombre: 'Marcelo Schang', canal: 'Representantes' },
    { perfil: 2, usuarioId: 14679, correo: 'marianoalaborde@hotmail.com.ar', nombre: 'Mariano Laborde', canal: 'Representantes' },
    { perfil: 2, usuarioId: 33664, correo: 'marianoro5@hotmail.com.ar', nombre: 'Mariano Rodriguez Alcobendas', canal: 'Representantes' },
    { perfil: 2, usuarioId: 18186, correo: 'mariovera537749@gmail.com', nombre: 'Mario Vera', canal: 'Representantes' },
    { perfil: 2, usuarioId: 26342, correo: 'martinpetri@hotmail.com', nombre: 'Martin Petricevich', canal: 'Representantes' },
    { perfil: 2, usuarioId: 24989, correo: 'nicogurmindo@gmail.com', nombre: 'Nicolas Gurmindo', canal: 'Representantes' },
    { perfil: 2, usuarioId: 62011, correo: 'oscarclos@gmail.com', nombre: 'Oscar Clos', canal: 'Representantes' },
    { perfil: 2, usuarioId: 36459, correo: 'aldasororodolfo@gmail.com', nombre: 'Rodolfo Aldasoro', canal: 'Representantes' },
    { perfil: 2, usuarioId: 64625, correo: 'santiagodcac@gmail.com', nombre: 'Santiago Sitja', canal: 'Representantes' },
    { perfil: 2, usuarioId: 6054, correo: 'sebastianrios.vet@gmail.com', nombre: 'Sebastian Rios', canal: 'Representantes' },
    { perfil: 2, usuarioId: 362, correo: 'segundovidelad@gmail.com', nombre: 'Segundo Videla Dorna', canal: 'Representantes' },
    // ── Perfil 2: Comisionistas ───────────────────────────────────────────────
    { perfil: 2, usuarioId: 2311, correo: 'aro.ochoa@gmail.com', nombre: 'Adolfo Ochoa', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 25390, correo: 'andoniarzuaga@hotmail.com', nombre: 'Andoni Arzuaga', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 253, correo: 'cjlusarreta@hotmail.com', nombre: 'Carlos Juan De Lusarreta', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 570, correo: 'carloslostalo@gmail.com', nombre: 'Carlos Lostalo', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 111763, correo: 'sanmarcial06@hotmail.com', nombre: 'Carlos Omar Santamaria', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 9476, correo: 'celedonioarbuco@hotmail.com', nombre: 'Celedonio Arbucó', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 9612, correo: 'facturacion@montaldoconsignatarios.com', nombre: 'Consignataria Montaldo - Madariaga', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 6344, correo: 'escritorio@camposdelmanana.com.ar', nombre: 'Consultora Campos Del Mañana', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 1014, correo: 'dfritz@decampoacampo.com', nombre: 'Daniel Fritz', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 14896, correo: 'dariohiller999@gmail.com', nombre: 'Dario Hiller', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 35438, correo: 'ezequieltarchetti@hotmail.com', nombre: 'Ezequiel Tarchetti', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 3363, correo: 'ventasalonso@hotmail.com', nombre: 'Federico Alonso', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 8697, correo: 'fnovoa@decampoacampo.com', nombre: 'Federico Nicolas Novoa', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 31911, correo: 'fernandoliver@hotmail.com', nombre: 'Fernando Oliver', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 94581, correo: 'florencioguarrochena@gmail.com', nombre: 'Florencio Guarrochena', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 3176, correo: 'franciscovideladorna@hotmail.com', nombre: 'Francisco Videla Dorna', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 10644, correo: 'guillesarobe@gmail.com', nombre: 'Guillermo Sarobe', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 61492, correo: 'hernan@cmenendez.com.ar', nombre: 'Hernan Cristobal', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 86119, correo: 'tomaseignacioelissondosrl@gmail.com', nombre: 'Ignacio Elissondo', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 110434, correo: 'vivanco.nacho@gmail.com', nombre: 'Ignacio Vivanco', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 16073, correo: 'javica04@hotmail.com', nombre: 'Javier Canete', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 53579, correo: 'otitorriglia@gmail.com', nombre: 'Jorge Torriglia', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 22999, correo: 'iturraldejuanc@gmail.com', nombre: 'Juan Cruz Iturralde', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 18901, correo: 'ignacio.iribarne@gmail.com', nombre: 'Juan Ignacio Iribarne', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 16471, correo: 'ramosjuanignacio@gmail.com', nombre: 'Juan Ignacio Ramos', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 107123, correo: 'Jmaglie@yahoo.com.ar', nombre: 'Juan Jose Maglie', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 24669, correo: 'jfernandezpego@gmail.com', nombre: 'Juan Manuel Fernández Pego', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 68084, correo: 'saenz_jp@hotmail.com', nombre: 'Juan Pablo Saenz', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 25114, correo: 'ldelosheros@gmail.com', nombre: 'Luciano de los Heros', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 89569, correo: 'marceloe@grupoarkay.com', nombre: 'Marcelo Elichiribehety', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 15682, correo: 'marcelopalau@yahoo.com.ar', nombre: 'Marcelo Palau', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 345, correo: 'feriasrodeohuinca@huincacoop.com.ar', nombre: 'Miguel Angel Portentoso', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 9939, correo: 'macagnonestor@hotmail.com', nombre: 'Nestor Adrian Macagno', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 10576, correo: 'copellonicolas@hotmail.com', nombre: 'Nicolas Copello', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 1147, correo: 'nicolaslodeiro@live.com.ar', nombre: 'Nicolas Lodeiro', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 281, correo: 'pablosiersch@hotmail.com', nombre: 'Pablo Siersch', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 12187, correo: 'patriciotomase@hotmail.com', nombre: 'Patricio Tomas Elliff Avellaneda', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 11581, correo: 'ramiro_aramburu@hotmail.com', nombre: 'Ramiro Aramburu', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 2885, correo: 'raulsobredo@hotmail.com', nombre: 'Raul Sobredo', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 4978, correo: 'scorreaf@hotmail.com', nombre: 'Santiago Correa Farrell', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 108212, correo: 'solasantiago@hotmail.com', nombre: 'Santiago Sola', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 115716, correo: 'santi_zonni@hotmail.com', nombre: 'Santiago Zonni', canal: 'Comisionista' },
    { perfil: 2, usuarioId: 96104, correo: 'gabigperez@hotmail.com', nombre: 'Ignacio Perez', canal: 'Comisionista' },
];

/**
 * Busca un usuario canónico por nombre (case-insensitive, primer palabra)
 */
export function findUsuarioCanon(nombre: string): UsuarioCanon | undefined {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const q = norm(nombre);
    return USUARIOS_CANONICOS.find(u => norm(u.nombre) === q)
        ?? USUARIOS_CANONICOS.find(u => norm(u.nombre).startsWith(q.split(' ')[0]));
}

/**
 * Obtiene el ID de plataforma de un usuario canónico por nombre
 */
export function getUsuarioIdCanon(nombre: string): number | undefined {
    return findUsuarioCanon(nombre)?.usuarioId;
}

/**
 * IDs adicionales de Metabase vinculados a un usuario principal.
 * Cuando un AC opera bajo múltiples cuentas de Metabase, se listan aquí.
 * fetchQ95 los pasa todos en un único request (el filtro id_usuario acepta múltiples valores).
 *
 * Clave = ID principal (el que tiene en la sesión)
 * Valor = array con TODOS los IDs a incluir en la query (incluye el principal)
 */
export const LINKED_AC_IDS: Record<number, number[]> = {
    // Simon De Aduriz (48871) opera también bajo la cuenta de Gonzalo Aduriz (306)
    48871: [48871, 306],
};
