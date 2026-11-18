import React, { useState } from 'react';
import { ModalBase } from '../ui/ModalBase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

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

  const footer = (
    <div className="flex items-center justify-end gap-2.5">
      <Button variant="secondary" onClick={onClose}>
        Cancelar
      </Button>
      <Button variant="primary" type="submit" form="form-feriado">
        Guardar Feriado
      </Button>
    </div>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Nuevo Feriado / Días No Laborables"
      subtitle="Configuración de calendario institucional y cómputo de plazos (SLA)"
      size="sm"
      footer={footer}
    >
      <form id="form-feriado" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <Input
          label="Fecha del Feriado"
          type="date"
          required
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />

        <Input
          label="Descripción / Motivo"
          type="text"
          required
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej. Aniversario institucional o festividad regional"
        />

        <Select
          label="Tipo de Feriado"
          required
          value={tipo}
          onChange={(e) => setTipo(e.target.value as any)}
          options={[
            { value: 'NACIONAL', label: 'NACIONAL' },
            { value: 'REGIONAL_UCAYALI', label: 'REGIONAL_UCAYALI' },
            { value: 'INSTITUCIONAL', label: 'INSTITUCIONAL' },
          ]}
        />
      </form>
    </ModalBase>
  );
}
