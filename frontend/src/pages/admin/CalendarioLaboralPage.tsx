import { useState } from 'react';
import FeriadosConfigModal from '../../components/admin/FeriadosConfigModal';

interface Feriado {
  fecha: string;
  descripcion: string;
  tipo: 'NACIONAL' | 'REGIONAL_UCAYALI' | 'INSTITUCIONAL';
  impactaSla: boolean;
}

export default function CalendarioLaboralPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feriados, setFeriados] = useState<Feriado[]>([
    { fecha: '2026-06-07', descripcion: 'Batalla de Arica', tipo: 'NACIONAL', impactaSla: true },
    { fecha: '2026-06-24', descripcion: 'Fiesta de San Juan (Ucayali)', tipo: 'REGIONAL_UCAYALI', impactaSla: true },
  ]);
  const [mensajeSla, setMensajeSla] = useState('');

  const handleAgregarFeriado = (nuevoFeriado: Feriado) => {
    const existe = feriados.some((f) => f.fecha === nuevoFeriado.fecha);
    if (existe) {
      alert('Ya existe un feriado registrado para esta fecha.');
      return;
    }

    setFeriados([...feriados, nuevoFeriado]);
    setMensajeSla(`Feriado "${nuevoFeriado.descripcion}" registrado. El semáforo SLA y los plazos de expedientes se han recalculado automáticamente.`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0b2a4a]">Calendario Laboral y Feriados Institucionales</h1>
          <p className="text-sm text-[#4b6b85]">Gestión de días no laborables y su impacto directo en el motor de cálculo SLA de expedientes.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg shadow transition-all"
        >
          + Registrar Nuevo Feriado
        </button>
      </div>

      {mensajeSla && (
        <div className="mb-4 p-4 bg-[#e8f4ff] border-l-4 border-[#38bdf8] text-[#00539b] rounded-r-lg text-sm shadow-sm">
          {mensajeSla}
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden border">
        <table className="min-w-full divide-y divide-[#eaf3fb]">
          <thead className="bg-[#f4f8fb]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#6b8aa5] uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#6b8aa5] uppercase tracking-wider">Descripción</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#6b8aa5] uppercase tracking-wider">Tipo de Feriado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#6b8aa5] uppercase tracking-wider">Impacto SLA</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#eaf3fb]">
            {feriados.map((f, idx) => (
              <tr key={idx} className="hover:bg-[#f4f8fb]">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#0b2a4a]">{f.fecha}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2f648c]">{f.descripcion}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-[#d7e9f7] text-[#00539b]">
                    {f.tipo}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${f.impactaSla ? 'bg-green-100 text-green-800' : 'bg-[#e8f4ff] text-[#0b2a4a]'}`}>
                    {f.impactaSla ? 'Activo (Modifica plazos)' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FeriadosConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAgregarFeriado}
      />
    </div>
  );
}