'use client';

import React, { useState, useEffect } from 'react';

const MERCADO_INSIGHTS = [
    {
        icon: '📈',
        titulo: 'Mercado Liniers',
        texto: 'El Mercado de Liniers es el principal indicador de precios de hacienda bovina de Argentina, con referencias semanales que impactan en toda la cadena.',
    },
    {
        icon: '🥩',
        titulo: 'Precio del Novillo',
        texto: 'El precio del novillo gordo es el principal termómetro del negocio ganadero. Variaciones del 5% en el valor impactan directamente en el margen de los feedlots.',
    },
    {
        icon: '🌽',
        titulo: 'Relación Insumo-Producto',
        texto: 'La relación maíz/carne es clave en el engorde a corral. Cuando el precio del maíz sube más que el de la hacienda, la rentabilidad del feedlot se achica.',
    },
    {
        icon: '🇨🇳',
        titulo: 'Exportaciones a China',
        texto: 'China es el principal destino de la carne vacuna argentina, representando más del 70% de las exportaciones. La demanda china define el piso del mercado interno.',
    },
    {
        icon: '💱',
        titulo: 'Tipo de Cambio y Hacienda',
        texto: 'El tipo de cambio impacta directamente en la competitividad exportadora. Un dólar alto favorece las exportaciones de carne y tiende a sostener los precios internos.',
    },
    {
        icon: '🌱',
        titulo: 'Ciclo Ganadero',
        texto: 'El ciclo ganadero bovino en Argentina dura entre 18 y 30 meses. En fase de liquidación, el stock se reduce y eventualmente los precios suben.',
    },
    {
        icon: '🏆',
        titulo: 'Razas Premium',
        texto: 'Los animales con tipificación JJ (novillo joven de alta calidad) obtienen bonificaciones importantes en frigoríficos exportadores, hasta un 15% sobre el precio base.',
    },
    {
        icon: '🌡️',
        titulo: 'Calidad de Hacienda',
        texto: 'La hacienda de Entre Ríos y Corrientes históricamente recibe un diferencial de precio por sus condiciones de pastoreo natural y calidad de forraje.',
    },
    {
        icon: '📊',
        titulo: 'Índice de Concreción',
        texto: 'Un índice de concreción de operaciones por encima del 60% es considerado saludable en el mercado consignatario. Por debajo del 40% indica sobreoferta o problemas de precio.',
    },
    {
        icon: '🚢',
        titulo: 'Cuota Hilton',
        texto: 'La Cuota Hilton es el cupo de exportación de cortes de alta calidad a la Unión Europea con arancel 0%. Argentina tiene una cuota asignada de 29.500 toneladas anuales.',
    },
    {
        icon: '⚡',
        titulo: 'Ganadería Sustentable',
        texto: 'La ganadería regenerativa gana terreno: productores que combinan pastoreo rotativo con siembra directa logran incrementar la carga animal hasta un 40%.',
    },
    {
        icon: '🐄',
        titulo: 'Stock Bovino Nacional',
        texto: 'Argentina cuenta con aproximadamente 54 millones de cabezas bovinas. El stock es uno de los principales indicadores de la capacidad exportadora futura.',
    },
];

export default function MercadoInsights() {
    const [index, setIndex] = useState(0);
    const [visible, setVisible] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIndex(Math.floor(Math.random() * MERCADO_INSIGHTS.length));
        setIsMounted(true);

        const interval = setInterval(() => {
            setVisible(false);
            setTimeout(() => {
                setIndex((prev) => (prev + 1) % MERCADO_INSIGHTS.length);
                setVisible(true);
            }, 400);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    if (!isMounted) {
        return <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 rounded-xl p-5 min-h-[160px] shadow-lg border border-blue-700/40 relative overflow-hidden" />;
    }

    const insight = MERCADO_INSIGHTS[index];

    return (
        <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 rounded-xl p-5 text-white shadow-lg border border-blue-700/40 relative overflow-hidden">
            {/* Decorative blobs */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-400/10 rounded-full blur-xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center gap-2 mb-4 relative z-10">
                <span className="text-base">📰</span>
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em]">¿Sabías que? · Mercado</p>
                <div className="ml-auto flex gap-1">
                    {MERCADO_INSIGHTS.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => { setVisible(false); setTimeout(() => { setIndex(i); setVisible(true); }, 300); }}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${i === index ? 'bg-blue-300 scale-125' : 'bg-blue-600 hover:bg-blue-400'}`}
                        />
                    ))}
                </div>
            </div>

            {/* Content */}
            <div
                className="relative z-10 transition-all duration-400"
                style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(4px)' }}
            >
                <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{insight.icon}</span>
                    <div>
                        <h3 className="font-black text-sm text-white mb-1">{insight.titulo}</h3>
                        <p className="text-blue-100/80 text-xs leading-relaxed">{insight.texto}</p>
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 h-0.5 w-full bg-blue-800">
                <div
                    key={index}
                    className="h-full bg-blue-400 origin-left"
                    style={{ animation: 'progress 8s linear forwards' }}
                />
            </div>
        </div>
    );
}
