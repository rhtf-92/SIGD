import React, { useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { fecha: string; descripcion: string; tipo: 'NACIONAL' | 'REGIONAL_UCAYALI' | 'INSTITUCIONAL'; impactaSla: boolean }) => void;
}

export default function FeriadosConfigModal({ isOpen, onClose, onSave }: ModalProps) {
  const [fecha, setFecha] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<'NACIONAL' | 'REGIONAL_UCAYALI' | 'INSTITUCIONAL'>('NACIONAL');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fecha || !descripcion) {
      setError('Todos los campos son obligatorios.');
      return;
    }
    setError('');
    // Al ser feriado institucional/regional, por defecto impacta el SLA de expedientes
    onSave({ fecha, descripcion, tipo, impactaSla: true });
    setFecha('');
    setDescripcion('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#0b2a4a]/35 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <h2 className="text-xl font-bold text-[#0b2a4a] mb-4">Registrar Nuevo Feriado / Días No Laborables</h2>
        {error && <div className="mb-3 p-2 bg-red-100 text-red-700 text-sm rounded">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#2f648c] mb-1">Fecha del Feriado</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-[#bfe0f7] rounded-lg p-2 focus:ring-[#006ec7] focus:border-[#006ec7]"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#2f648c] mb-1">Descripción / Motivo</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Aniversario institucional o festividad regional"
              className="w-full border border-[#bfe0f7] rounded-lg p-2 focus:ring-[#006ec7] focus:border-[#006ec7]"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#2f648c] mb-1">Tipo de Feriado</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as any)}
              className="w-full border border-[#bfe0f7] rounded-lg p-2 focus:ring-[#006ec7] focus:border-[#006ec7]"
            >
              <option value="NACIONAL">NACIONAL</option>
              <option value="REGIONAL_UCAYALI">REGIONAL_UCAYALI</option>
              <option value="INSTITUCIONAL">INSTITUCIONAL</option>
            </select>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#d7e9f7] text-[#2f648c] rounded-lg hover:bg-[#d7e9f7]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#006ec7] text-white rounded-lg hover:bg-[#006ec7]"
            >
              Guardar Feriado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}