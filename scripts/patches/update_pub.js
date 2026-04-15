const fs = require('fs');
let code = fs.readFileSync('components/Publicaciones.tsx', 'utf8');

const s1_from = /const totalLotes = recientes\.length;[\s\S]*?const totalOfertas = recientes\.reduce\(\(s, l\) => s \+ \(l\.cant_ofertas \|\| 0\), 0\);/;
const s1_to = `    const publicadasLotes = recientes.filter(l => (l._estadoReal || '').toLowerCase() === 'publicado');
    const ofrecimientosLotes = recientes.filter(l => (l._estadoReal || '').toLowerCase().includes('ofrecimiento'));`;

const s2_from = /const StatCard = \(\{ title, icon, val, unit \}: \{ title: string, icon: string, val: number, unit: string \}\) => \([\s\S]*?    \);/;
const s2_to = `    const StatCard = ({ title, icon, val, unit }: { title: string, icon: string, val: number, unit: string }) => (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center relative overflow-hidden group hover:border-blue-200 transition-colors">
            <div className="relative z-10">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
                <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-gray-900">{val.toLocaleString('es-AR')}</span>
                    {unit && <span className="text-[10px] font-bold text-gray-400 uppercase">{unit}</span>}
                </div>
            </div>
            {icon && <div className="absolute right-2 -bottom-2 text-5xl opacity-5 group-hover:scale-110 group-hover:-translate-y-1 transition-transform pointer-events-none">{icon}</div>}
        </div>
    );`;

const s3_from = /            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">\s*<StatCard title="Tropas Publicadas"[\s\S]*?<StatCard title="Ofertas Recibidas"[\s\S]*?<\/div>/;
const s3_to = `            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Panel Publicadas */}
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-3">
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                        <span className="text-lg">📢</span> Publicadas
                    </h3>
                    <div className="grid grid-cols-3 gap-2 flex-1">
                        <StatCard title="Lotes" icon="📢" val={publicadasLotes.length} unit="" />
                        <StatCard title="Cabezas" icon="🐂" val={publicadasLotes.reduce((s, l) => s + (l.cabezas || 0), 0)} unit="" />
                        <StatCard title="Ofertas" icon="💬" val={publicadasLotes.reduce((s, l) => s + (l.cant_ofertas || 0), 0)} unit="" />
                    </div>
                </div>

                {/* Panel Ofrecimientos */}
                <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex flex-col gap-3">
                    <h3 className="text-sm font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
                        <span className="text-lg">👋</span> Ofrecimientos
                    </h3>
                    <div className="grid grid-cols-3 gap-2 flex-1">
                        <StatCard title="Lotes" icon="👋" val={ofrecimientosLotes.length} unit="" />
                        <StatCard title="Cabezas" icon="🐂" val={ofrecimientosLotes.reduce((s, l) => s + (l.cabezas || 0), 0)} unit="" />
                        <StatCard title="Ofertas" icon="💬" val={ofrecimientosLotes.reduce((s, l) => s + (l.cant_ofertas || 0), 0)} unit="" />
                    </div>
                </div>
            </div>`;

code = code.replace(s1_from, s1_to);
code = code.replace(s2_from, s2_to);
code = code.replace(s3_from, s3_to);

fs.writeFileSync('components/Publicaciones.tsx', code);
console.log('Update successful');
