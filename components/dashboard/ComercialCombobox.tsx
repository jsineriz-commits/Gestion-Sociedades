'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AcDef } from '@/lib/data/constants';

interface Props {
    value: string;                          // 'all' | 'u:{id}|{nombre}'
    onChange: (val: string) => void;
    grupos: [string, AcDef[]][];            // usuariosAgrupados
    filterCanal: string;                    // selectedCanalFilter
    size?: 'sm' | 'md';                     // sm = sidebar, md = mobile drawer
    onClose?: () => void;                   // opcional: cierra el drawer mobile tras seleccionar
}

export default function ComercialCombobox({
    value,
    onChange,
    grupos,
    filterCanal,
    size = 'sm',
    onClose,
}: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Nombre legible del valor actual
    const currentLabel =
        value === 'all'
            ? ''
            : grupos
                  .flatMap(([, users]) => users)
                  .find((u) => `u:${u.id}|${u.nombre}` === value)?.nombre ?? '';

    // Grupos filtrados por canal seleccionado y texto de búsqueda
    const filteredGrupos = grupos
        .filter(([canal]) => filterCanal === 'all' || canal === filterCanal)
        .map(
            ([canal, users]) =>
                [
                    canal,
                    users
                        .filter(
                            (u) =>
                                !query ||
                                u.nombre
                                    .toLowerCase()
                                    .normalize('NFD')
                                    .replace(/[\u0300-\u036f]/g, '')
                                    .includes(
                                        query
                                            .toLowerCase()
                                            .normalize('NFD')
                                            .replace(/[\u0300-\u036f]/g, '')
                                            .trim()
                                    )
                        )
                        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
                ] as [string, AcDef[]]
        )
        .filter(([, users]) => users.length > 0);

    // Cerrar al hacer click fuera
    const handleOutsideClick = useCallback((e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
            setOpen(false);
            setQuery('');
        }
    }, []);

    useEffect(() => {
        if (open) document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [open, handleOutsideClick]);

    function handleSelect(val: string) {
        onChange(val);
        setOpen(false);
        setQuery('');
        onClose?.();
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setQuery(e.target.value);
        if (!open) setOpen(true);
    }

    function handleFocus() {
        setOpen(true);
        setQuery('');
    }

    // ── Estilos según tamaño ─────────────────────────────────────────────────
    const isMd = size === 'md';
    const inputCls = isMd
        ? 'w-full text-sm px-3 py-2.5 border border-[#cae2bd] rounded-xl bg-[#eef6ea] text-[#3c731f] font-medium outline-none pr-7'
        : 'w-full text-xs px-2 py-1.5 border border-[#cae2bd] rounded-lg bg-[#eef6ea] text-[#3c731f] font-medium outline-none pr-6';
    const dropdownItemCls = isMd
        ? 'px-3 py-2 text-sm cursor-pointer select-none'
        : 'px-3 py-1.5 text-xs cursor-pointer select-none';
    const dropdownHeaderCls = isMd
        ? 'px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#999] bg-[#f5f5f5]'
        : 'px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#bbb] bg-[#f8f8f8]';

    return (
        <div ref={containerRef} className="relative w-full">
            {/* Input de búsqueda */}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    autoComplete="off"
                    placeholder={value === 'all' ? '— Todos en el Canal —' : currentLabel}
                    value={open ? query : (value !== 'all' ? currentLabel : '')}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    className={inputCls}
                />
                {/* Ícono lupa / ×clear */}
                {value !== 'all' && !open ? (
                    <button
                        type="button"
                        onClick={() => handleSelect('all')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-red-500 font-black text-sm leading-none"
                        title="Limpiar"
                    >
                        ×
                    </button>
                ) : (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#a0c4a0] pointer-events-none text-xs">
                        {open ? '▲' : '▼'}
                    </span>
                )}
            </div>

            {/* Dropdown */}
            {open && (
                <div
                    ref={listRef}
                    className="absolute z-[999] mt-1 w-full max-h-56 overflow-y-auto bg-white border border-[#cae2bd] rounded-xl shadow-xl"
                    style={{ minWidth: '180px' }}
                >
                    {/* Opción "Todos" */}
                    <div
                        className={`${dropdownItemCls} text-[#666] hover:bg-[#eef6ea] border-b border-[#f0f0f0]`}
                        onMouseDown={() => handleSelect('all')}
                    >
                        — Todos en el Canal —
                    </div>

                    {filteredGrupos.length === 0 && (
                        <div className={`${dropdownItemCls} text-[#aaa] italic`}>
                            Sin resultados para "{query}"
                        </div>
                    )}

                    {filteredGrupos.map(([canal, users]) => (
                        <div key={canal}>
                            {/* Encabezado de canal */}
                            <div className={dropdownHeaderCls}>{canal}</div>
                            {users.map((u) => {
                                const val = `u:${u.id}|${u.nombre}`;
                                const isSelected = value === val;
                                return (
                                    <div
                                        key={u.id}
                                        className={`${dropdownItemCls} hover:bg-[#eef6ea] ${
                                            isSelected
                                                ? 'bg-[#d4edda] text-[#3c731f] font-semibold'
                                                : 'text-[#333]'
                                        }`}
                                        onMouseDown={() => handleSelect(val)}
                                    >
                                        {u.nombre}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
