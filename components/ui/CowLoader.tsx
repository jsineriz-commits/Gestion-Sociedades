'use client';

import React, { useState, useEffect } from 'react';

const COW_FACTS = [
    // Bovinos
    "🐮 Las vacas tienen un campo visual de casi 360 grados — solo tienen un punto ciego directo detrás de ellas.",
    "🐄 Una vaca de alta producción puede llegar a dar más de 40 litros de leche por día.",
    "🧠 Las vacas tienen excelente memoria a largo plazo y pueden reconocer hasta 50 animales distintos.",
    "🐄 Las manchas de una vaca Holstein son únicas como huellas digitales — ninguna se repite.",
    "💧 Una vaca bebe entre 110 y 190 litros de agua al día — casi una bañera entera.",
    "🌾 Una vaca adulta consume entre 70 y 90 kg de pasto fresco por día.",
    "🐮 Las vacas tienen 4 estómagos: rumen, retículo, omaso y abomaso para digerir correctamente.",
    "🐄 El ganado bovino fue domesticado hace aproximadamente 10.000 años en Medio Oriente.",
    "🏋️ Un toro Hereford adulto puede pesar más de 1.000 kg.",
    "🐄 Argentina es uno de los 5 mayores productores de carne bovina del mundo.",
    "🌡️ La temperatura corporal normal de un bovino es de 38 a 39,5°C.",
    "🐄 Las vacas pasan entre 8 y 12 horas por día rumiando — masticando el pasto ya tragado.",
    "🐮 Los bovinos se comunican con mugidos que expresan dolor, hambre, estrés y hasta afecto.",
    "🏃 Un novillo bien alimentado puede ganar entre 900g y 1,3 kg de peso vivo por día.",
    // Porcinos
    "🐷 Los cerdos son de los animales más inteligentes del mundo — superan en coeficiente a los perros.",
    "🐖 Argentina producción porcina creció más del 200% en los últimos 20 años.",
    "🐷 Un cerdo puede alcanzar los 100 kg de peso en tan solo 6 meses con buena alimentación.",
    "🐖 La carne de cerdo es la más consumida a nivel mundial, superando a la bovina y avícola.",
    "🐷 Los cerdos no tienen glándulas sudoríparas funcionales — se refrescan revolcándose en barro.",
    "🐖 El rendimiento de faena de un cerdo es del 75-80%, uno de los más altos entre las especies.",
    // Ovejas y lanares
    "🐑 Argentina tiene aproximadamente 14 millones de ovinos, principalmente en Patagonia.",
    "🐑 Una oveja produce entre 2 y 6 kg de lana por esquila anual.",
    "🐑 Las ovejas Merino tienen la fibra de lana más fina del mundo, menor a 20 micrones.",
    // Equinos
    "🐎 El caballo Criollo Argentino es reconocido mundialmente por su resistencia y adaptabilidad.",
    "🐎 Un equino adulto bebe entre 25 y 55 litros de agua por día según la temperatura.",
    // Producción general
    "🌱 La Pampa Húmeda Argentina es considerada una de las tierras más fértiles del planeta.",
    "🌿 Una hectárea de campo bien manejado puede soportar entre 1 y 2 animales de manera sostenida.",
    "🌾 Argentina tiene más de 170 millones de hectáreas destinadas a uso agropecuario.",
    "🐄 El SENASA registra más de 54 millones de cabezas bovinas en Argentina.",
    "📦 Las exportaciones de carne vacuna argentina superaron las 900 mil toneladas en 2023.",
    "🔬 La raza Angus representa casi el 70% de las razas bovinas en Argentina.",
    "🌱 El pastizal natural de la Pampa puede fijar hasta 1,5 toneladas de CO₂ por hectárea por año.",
    "🚜 Argentina exporta tecnología agropecuaria a más de 50 países del mundo.",
    "🐄 El Brahman es la raza más difundida en las zonas tropicales de Argentina por su resistencia al calor.",
    "🌾 Una hacienda bien nutrida puede reducir su tiempo de engorde hasta en un 30%.",
];

interface CowLoaderProps {
    message?: string;
}

export default function CowLoader({ message = 'Cargando datos...' }: CowLoaderProps) {
    const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * COW_FACTS.length));
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setVisible(false);
            setTimeout(() => {
                setFactIndex((prev) => (prev + 1) % COW_FACTS.length);
                setVisible(true);
            }, 300);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col flex-1 items-center justify-center p-10 min-h-[40vh] w-full mt-8 bg-white rounded-xl shadow-sm border border-emerald-100">
            <div className="text-5xl mb-4">
                <div className="animate-bounce">🐄</div>
            </div>

            <div className="text-emerald-700 font-semibold mb-1 text-base">
                {message}
            </div>

            <div className="flex items-center space-x-2 text-sm text-gray-400 mb-6">
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-emerald-500" />
                <span>Conectando con la base de datos</span>
            </div>

            <div
                className="max-w-lg bg-emerald-50 rounded-xl p-5 border border-emerald-100 relative overflow-hidden transition-opacity duration-300"
                style={{ opacity: visible ? 1 : 0 }}
            >
                <div className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>💡</span> ¿Sabías qué?
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">
                    {COW_FACTS[factIndex]}
                </p>
                <div className="absolute bottom-0 left-0 h-0.5 bg-emerald-200 w-full">
                    <div
                        key={factIndex}
                        className="h-full bg-emerald-500 origin-left animate-[progress_5s_linear]"
                    />
                </div>
            </div>
        </div>
    );
}
