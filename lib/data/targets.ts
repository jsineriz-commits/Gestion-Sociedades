// lib/targets.ts — Targets mensuales de cabezas por comercial/filtro
export interface TargetEntry { venta: number; both: number }

// ── Targets anuales por Unidad de Negocio (UN) ───────────────────────────────
export const UN_TARGETS_ANUAL: Record<string, number> = {
    'Faena':        280_000,
    'Invernada':    165_000,
    'Inv. Neo':      35_000,
    'Cría':          20_000,
    'Cria':          20_000,
    'MAG':           25_000,
};
export const COMPANY_ANUAL_TARGET = Object.values(UN_TARGETS_ANUAL).reduce((s, v) => s + v, 0); // 525,000

/**
 * Clave = valor de `acFilter` (viewContext.acName) en el dashboard.
 * - Para un comercial individual  → su nombre exacto
 * - Para una oficina              → el nombre de la oficina
 * Fuente: planilla de metas provista por la dirección.
 */
export const TARGETS_MONTHLY: Record<string, TargetEntry> = {
    // ── Oficina Río Cuarto ─────────────────────────────────────────────
    'Valentin Torriglia':            { venta: 3200, both: 6200 },
    'Santiago Julian':               { venta: 1300, both: 2600 },
    'David Menghi':                  { venta: 1300, both: 1600 },
    'Alexis Deambrocio':             { venta:  800, both: 1600 },
    'Sebastian Rivarola':            { venta:  500, both:  800 },
    'Facundo Alonso':                { venta:  250, both:  400 },
    'Oficina Rio 4to':               { venta: 7350, both: 13200 }, // suma: VT+SJ+DM+AD+SR+FA

    // ── Independientes regionales ─────────────────────────────────────
    'Santiago Zonni':                { venta:  587, both:  828 },
    'Jorge Torriglia':               { venta:  663, both:  956 },
    'Miguel Angel Portentoso':       { venta:   57, both:  139 },

    // ── Oficina Entre Ríos ────────────────────────────────────────────
    'Manuel Pons':                   { venta: 1100, both: 1200 },
    'Hugo Ganis':                    { venta:  500, both:  600 },
    'Juan José Loza':                { venta:  500, both:  600 },
    'Juan Jose Loza':                { venta:  500, both:  600 },
    'Nicolas Echezarreta':           { venta:  250, both:  350 },
    'Alejo Broggi':                  { venta:   25, both:   50 },
    'Juan Vicente Elias':            { venta:   68, both:   84 },
    'Oficina Entre Rios':            { venta: 2375, both: 2800 }, // suma: MP+HG+JL+NE+AB

    // ── Independientes ────────────────────────────────────────────────
    'Carlos Lostalo':                { venta:   78, both:   78 },
    'Juan Pablo Saenz':              { venta:   23, both:   23 },
    'Francisco Videla Dorna':        { venta:   16, both:   16 },
    'Consignataria Jurado S.R.L':    { venta:    8, both:    8 },

    // ── Alan Garcia y equipo (filtro propio) ──────────────────────────
    'Alan Garcia':                   { venta: 1600, both: 1700 },
    'Dario Hiller':                  { venta:  500, both:  500 },
    'Javier Canete':                 { venta:   28, both:   75 },
    'Ezequiel Tarchetti':            { venta:   58, both:   71 },
    'Andoni Arzuaga':                { venta:   79, both:   79 },
    'Horacio Trucco':                { venta:   29, both:   29 },
    'Jose Maria Bescos':             { venta:   71, both:   88 },

    // ── Independientes ────────────────────────────────────────────────
    'Escritorio Enrique Gonzalez':   { venta: 1192, both: 1315 },
    'Nestor Adrian Macagno':         { venta:  264, both:  264 },
    'Alejandro Martin.':             { venta:  300, both:  500 },
    'Carlos Omar Santamaria':        { venta:   17, both:   17 },

    // ── Oficina Bavio ─────────────────────────────────────────────────
    'Oficina Bavio':                 { venta: 1900, both: 3050 }, // SS(2600)+ES(400)+FR(50)
    'Sebastian Saparrat':            { venta: 1600, both: 2600 },
    'Emiliano Sanchez':              { venta:  250, both:  400 },
    'Facundo Ruete':                 { venta:   50, both:   50 },

    // ── Oficina Ayacucho ──────────────────────────────────────────────
    'Oficina Ayacucho':              { venta: 1500, both: 1750 },
    'Segundo Videla Dorna':          { venta: 1250, both: 1350 },
    'Facundo Sansot':                { venta:  250, both:  400 },

    // ── Independientes ────────────────────────────────────────────────
    'Juan Cruz Iturralde':           { venta:  136, both:  136 },

    // ── Oficina Bs As Central ─────────────────────────────────────────
    'Oficina Bs As Central':         { venta: 1850, both: 2800 }, // ID(1600+2400)+SP(250+400)
    'Ignacio Diehl':                 { venta: 1600, both: 2400 },
    'Sebastian Poullion':            { venta:  250, both:  400 },

    // ── Independientes ────────────────────────────────────────────────
    'Jorge Daniel Fernandez':        { venta:   26, both:   26 },
    'Alejandro Ballve':              { venta:  500, both:  600 },
    'Franco Barrionuevo':            { venta:  500, both:  600 },
    'Marcelo Aguilar':               { venta:  500, both:  600 },
    'Santiago Sitja':                { venta:  500, both:  600 },
    'Consultora Campos Del Mañana':  { venta:  174, both:  174 },
    'Marcelo Barboza':               { venta:  500, both:  500 },
    'Jose Olmedo':                   { venta:  625, both: 1000 },
    'Santiago Correa Farrell':       { venta:  176, both:  235 },
    'Martin Petricevich':            { venta:   75, both:  153 },
    'Pablo Cieri':                   { venta:  500, both:  800 },

    // ── Oficina Olavarria ─────────────────────────────────────────────
    'Oficina Olavarria':             { venta: 1000, both: 1000 },
    'Mariano Laborde':               { venta:  250, both:  250 },
    'Ignacio Urruty':                { venta:  750, both:  750 },

    // ── Independientes ────────────────────────────────────────────────
    'Oscar Clos':                    { venta:   96, both:   96 },
    'Lucia Sposito':                 { venta:  250, both:  400 },
    'Nuevo Representante':           { venta:  750, both:  750 },
    'Ignacio Elissondo':             { venta:  143, both:  143 },
    'Leandro Perez Paroni':          { venta:   49, both:   49 },
    'Alejandro Bridger':             { venta: 1350, both: 1500 },

    // ── Aduriz ────────────────────────────────────────────────────────
    'Aduriz':                        { venta: 1300, both: 1300 }, // Gonzalo 900 + Simon 400
    'Gonzalo Aduriz':                { venta:  900, both:  900 },
    'Simon De Aduriz':               { venta:  400, both:  400 },

    // ── Independientes ────────────────────────────────────────────────
    ' Bertolotto - Ríos Hacienda':   { venta:   41, both:   44 },
    'Bertolotto - Ríos Hacienda':    { venta:   41, both:   44 },
    'Agustin Mascotena':             { venta:  250, both:  400 },
    'Rodolfo Aldasoro':              { venta:  500, both:  500 },
    'Agustin Acuña':                 { venta: 1100, both: 1200 },
    'Lucila Frutos':                 { venta:  600, both: 1000 },

    // ── CABA ──────────────────────────────────────────────────────────
    'CABA':                          { venta: 9680, both: 25915 },
    'Francisco Echeverz':            { venta:  390, both:  411 },
    'Mario Vera':                    { venta:  312, both:  312 },
    'Marcelo Schang':                { venta:  270, both:  272 },
    'Consignataria Montaldo - Madariaga': { venta: 263, both: 315 },
    'Pablo Siersch':                 { venta:  202, both:  233 },
    'Nicolas Copello':               { venta:  195, both:  269 },
    'Esteban Enrique Avendaño':      { venta:  178, both:  185 },
    'Nicolas Gurmindo':              { venta:  500, both:  500 },
    'Alberto Brosa':                 { venta:  135, both:  135 },
    'Federico Alonso':               { venta:  130, both:  151 },
    'Mariano Rodriguez Alcobendas':  { venta:  500, both:  500 },
    'Agustin Irastorza':             { venta:  121, both:  121 },
    'Hernan Cristobal':              { venta:  112, both:  117 },
    'Federico Nicolas Novoa':        { venta:  103, both:  103 },
    'Guillermo Sarobe':              { venta:   92, both:   92 },
    'Daniel Fritz':                  { venta:   85, both:  216 },
    'Marcelo Schafer':               { venta:  250, both:  250 },
    'Juan Ignacio Ramos':            { venta:   64, both:   64 },
    'Carlos Juan De Lusarreta':      { venta:   59, both:   59 },
    'Luis Maria de Hagen':           { venta:   48, both:   48 },
    'Juan Ignacio Iribarne':         { venta:   42, both:   42 },
    'Celedonio Arbucó':              { venta:   40, both:   54 },
    'Juan Jose Maglie':              { venta:   30, both:   30 },
    'Roberto Genovesi':              { venta:   25, both:   25 },
    'Patricio Tomas Elliff Avellaneda': { venta: 22, both:  22 },
    'Marcelo Elichiribehety':        { venta:   12, both:   12 },
    'Florencio Guarrochena':         { venta:    5, both:    6 },
    'Fernando Oliver':               { venta:    4, both:    4 },
    'Luciano de los Heros':          { venta:    3, both:    3 },
    'Mariano Coelho Tenazinha':      { venta:    3, both:  174 },
    'Marcos Isasmendi':              { venta:    2, both:    2 },
    'Adolfo Ochoa':                  { venta:    2, both:    2 },
    'Raul Sobredo':                  { venta:    1, both:    3 },
};

/**
 * Resolve mensual target para el filtro y modo dados.
 * acFilter: null = empresa completa
 * showBothSides: si true usa "both" (compra+venta), si false usa "venta"
 * memberNames: si se provee y acFilter es una Oficina, suma los targets de sus miembros
 *              → hace el total de oficina auto-escalable sin editar este archivo
 */
export function resolveTarget(
    acFilter: string | null | undefined,
    showBothSides: boolean,
    mes: number, // 0 = año completo
    memberNames?: string[], // nombres de los miembros de la oficina (opcional)
): number | null {
    if (!acFilter) return null;

    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const isOficina = norm(acFilter).startsWith('oficina');

    // ── Oficinas: suma dinámica de los targets de sus miembros ────────────────
    // Si se proveen los nombres de miembros, calculamos la suma en lugar de
    // usar un entry manual. Así agregar un miembro actualiza el total automáticamente.
    if (isOficina && memberNames && memberNames.length > 0) {
        let total = 0;
        const normFilter = norm(acFilter);
        for (const nombre of memberNames) {
            // Búsqueda exacta primero, luego flexible
            let entry = TARGETS_MONTHLY[nombre];
            if (!entry) {
                const key = Object.keys(TARGETS_MONTHLY).find(k => norm(k) === norm(nombre));
                if (key) entry = TARGETS_MONTHLY[key];
            }
            if (entry) total += showBothSides ? entry.both : entry.venta;
        }
        if (total > 0) return mes === 0 ? total * 12 : total;
        // Si ningún miembro tiene target, cae al entry manual de la oficina (si existe)
        void normFilter;
    }

    // ── Búsqueda directa (individual o fallback de oficina) ───────────────────
    let entry = TARGETS_MONTHLY[acFilter];
    if (!entry) {
        const normFilter = norm(acFilter);
        const key = Object.keys(TARGETS_MONTHLY).find(k => norm(k) === normFilter);
        if (key) entry = TARGETS_MONTHLY[key];
    }
    if (!entry) return null;

    const monthly = showBothSides ? entry.both : entry.venta;
    return mes === 0 ? monthly * 12 : monthly;
}

/**
 * Totales de empresa (cuando no hay acFilter).
 * Se computan sumando las entradas top-level para evitar doble conteo.
 */
export const COMPANY_TOTAL_MONTHLY: TargetEntry = {
    venta: Object.values(TARGETS_MONTHLY).reduce((s, e) => s + e.venta, 0),
    both:  Object.values(TARGETS_MONTHLY).reduce((s, e) => s + e.both,  0),
};
