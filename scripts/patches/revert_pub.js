const fs = require('fs');
let code = fs.readFileSync('components/Publicaciones.tsx', 'utf8');

const s1_from = /const publicadasLotes = recientes.*?includes\('ofrecimiento'\)\);/s;
const s1_to = `    const totalLotes = recientes.length;
    const totalLcbzs = recientes.reduce((s, l) => s + (l.cabezas || 0), 0);
    const totalOfertas = recientes.reduce((s, l) => s + (l.cant_ofertas || 0), 0);`;

const s2_from = /const StatCard =.*?=>.*?    \);/s;
const s2_to = `    const StatCard = ({ title, icon, val, unit }: { title: string, icon: string, val: number, unit: string }) => (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
                <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-gray-900">{val.toLocaleString('es-AR')}</span>
                    <span className="text-xs font-bold text-gray-400 uppercase">{unit}</span>
                </div>
            </div>
            <div className="text-2xl opacity-80">{icon}</div>
        </div>
    );`;

const s3_from = /            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">.*?Ofrecimientos.*?<\/div>\s*<\/div>\s*<\/div>/s;
const s3_to = `            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Tropas Publicadas" icon="📢" val={recientes.length} unit="lotes" />
                <StatCard title="Cabezas Publicadas" icon="🐂" val={recientes.reduce((s, l) => s + (l.cabezas || 0), 0)} unit="cbzs" />
                <StatCard title="Ofertas Recibidas" icon="💬" val={recientes.reduce((s, l) => s + (l.cant_ofertas || 0), 0)} unit="ofertas" />
            </div>`;

code = code.replace(s1_from, s1_to);
code = code.replace(s2_from, s2_to);
code = code.replace(s3_from, s3_to);

fs.writeFileSync('components/Publicaciones.tsx', code);
console.log('Revert done');
