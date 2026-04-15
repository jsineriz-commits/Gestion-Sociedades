'use client';

import { useState, useEffect } from 'react';

interface NotaRow {
    id: string;
    cliente: string;
    operacion: string;
    estado: string;
    comentarios: string;
    fecha: string;
}

export default function NotasPersonales({ userId }: { userId: string | number }) {
    const [notas, setNotas] = useState<NotaRow[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    const storageKey = `tj_notas_${userId}`;

    // Cargar notas desde LocalStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                setNotas(JSON.parse(saved));
            }
        } catch (e) {
            console.error("No se pudieron cargar las notas locales", e);
        }
        setIsLoaded(true);
    }, [storageKey]);

    // Guardar automáticamente cada vez que la tabla cambie
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(storageKey, JSON.stringify(notas));
        }
    }, [notas, isLoaded, storageKey]);

    const addRow = () => {
        const newRow: NotaRow = {
            id: Date.now().toString(),
            cliente: '',
            operacion: '',
            estado: 'Pendiente',
            comentarios: '',
            fecha: new Date().toLocaleDateString('es-AR')
        };
        setNotas([...notas, newRow]);
    };

    const updateRow = (id: string, field: keyof NotaRow, value: string) => {
        setNotas(notas.map(n => n.id === id ? { ...n, [field]: value } : n));
    };

    const deleteRow = (id: string) => {
        if (confirm('¿Seguro que querés borrar este registro?')) {
            setNotas(notas.filter(n => n.id !== id));
        }
    };

    if (!isLoaded) return <div className="p-8 text-center text-gray-400">Cargando tus notas personales...</div>;

    return (
        <div className="space-y-4">
            <div className="bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-100 rounded-2xl p-5 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                        📝 Mis Notas Personales
                    </h2>
                    <p className="text-xs text-gray-500 mt-1 max-w-xl leading-relaxed">
                        Esta tabla es de uso 100% personal y privado. Los datos se guardan directamente en tu navegador actual ({userId}) 
                        y nadie más puede verlos. Usala como tu bloc de notas o seguimiento de clientes.
                    </p>
                </div>
                <button
                    onClick={addRow}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 focus:ring-4 focus:ring-amber-500/20 text-white text-sm font-bold rounded-xl transition-all shadow-sm"
                >
                    <span>+</span> Agregar Fila
                </button>
            </div>

            <div className="bg-white border text-sm border-gray-200 shadow-sm rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-3 font-bold text-gray-500 text-[10px] w-28 uppercase tracking-wider">Fecha</th>
                                <th className="px-4 py-3 font-bold text-gray-500 text-[10px] w-52 uppercase tracking-wider">Cliente / Empresa</th>
                                <th className="px-4 py-3 font-bold text-gray-500 text-[10px] w-48 uppercase tracking-wider">Operación / Categoría</th>
                                <th className="px-4 py-3 font-bold text-gray-500 text-[10px] w-36 uppercase tracking-wider">Estado</th>
                                <th className="px-4 py-3 font-bold text-gray-500 text-[10px] min-w-[250px] uppercase tracking-wider">Comentarios / Seguimiento</th>
                                <th className="px-4 py-3 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {notas.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                                        No tenés notas guardadas. Hacé click en <strong>Agregar Fila</strong> para empezar a agendar.
                                    </td>
                                </tr>
                            ) : (
                                notas.map((nota) => (
                                    <tr key={nota.id} className="hover:bg-amber-50/30 transition-colors group">
                                        <td className="p-0 border-r border-gray-50">
                                            <input 
                                                className="w-full bg-transparent px-4 py-3 text-xs font-mono text-gray-500 focus:outline-none focus:bg-amber-50"
                                                value={nota.fecha}
                                                onChange={(e) => updateRow(nota.id, 'fecha', e.target.value)}
                                                placeholder="DD/MM/AAAA"
                                            />
                                        </td>
                                        <td className="p-0 border-r border-gray-50">
                                            <input 
                                                className="w-full bg-transparent px-4 py-3 font-bold text-gray-800 focus:outline-none focus:bg-amber-50"
                                                value={nota.cliente}
                                                onChange={(e) => updateRow(nota.id, 'cliente', e.target.value)}
                                                placeholder="Nombre del cliente..."
                                            />
                                        </td>
                                        <td className="p-0 border-r border-gray-50">
                                            <input 
                                                className="w-full bg-transparent px-4 py-3 text-gray-700 text-sm focus:outline-none focus:bg-amber-50"
                                                value={nota.operacion}
                                                onChange={(e) => updateRow(nota.id, 'operacion', e.target.value)}
                                                placeholder="Ej. 120 Invernada..."
                                            />
                                        </td>
                                        <td className="p-0 border-r border-gray-50">
                                            <select 
                                                className={`w-full bg-transparent px-4 py-3 text-xs font-bold focus:outline-none focus:bg-amber-50 appearance-none cursor-pointer outline-none border-0 ${
                                                    nota.estado === 'Cerrado' ? 'text-emerald-600' : 
                                                    nota.estado === 'Perdido' ? 'text-rose-500' : 
                                                    nota.estado === 'En Negociación' ? 'text-blue-600' : 'text-amber-500'
                                                }`}
                                                value={nota.estado}
                                                onChange={(e) => updateRow(nota.id, 'estado', e.target.value)}
                                            >
                                                <option value="Pendiente">Pendiente</option>
                                                <option value="En Negociación">En Negociación</option>
                                                <option value="Visto Bueno">Visto Bueno</option>
                                                <option value="Cerrado">Cerrado</option>
                                                <option value="Perdido">Operación Caída</option>
                                            </select>
                                        </td>
                                        <td className="p-0">
                                            <input 
                                                className="w-full bg-transparent px-4 py-3 text-sm text-gray-600 focus:outline-none focus:bg-amber-50"
                                                value={nota.comentarios}
                                                onChange={(e) => updateRow(nota.id, 'comentarios', e.target.value)}
                                                placeholder="Llamar el martes / Ofreció 2150 pero pide plazo..."
                                            />
                                        </td>
                                        <td className="p-0 text-center">
                                            <button 
                                                onClick={() => deleteRow(nota.id)}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all focus:outline-none"
                                                title="Eliminar fila"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
