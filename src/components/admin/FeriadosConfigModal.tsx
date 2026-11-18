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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Registrar Nuevo Feriado / Días No Laborables</h2>
        {error && <div className="mb-3 p-2 bg-red-100 text-red-700 text-sm rounded">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del Feriado</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Motivo</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Aniversario institucional o festividad regional"
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Feriado</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Guardar Feriado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}