import React, { useState } from 'react';
import { DynamicSchemaForm, type JSONSchema } from '../features/tramites/DynamicSchemaForm'
import { ThermalTicketPreview } from '../components/tramite/ThermalTicketPreview';
import { useThermalPrinter } from '../hooks/useThermalPrinter';

// Esquema JSON de prueba para simular la respuesta del backend
// (GET /api/v1/tramites/tipos/:id/formulario-schema)
const ESQUEMA_MOCK_TUPA: JSONSchema = {
  type: 'object',
  required: ['asunto', 'facultad', 'aceptaTerminos'],
  properties: {
    asunto: {
      type: 'string',
      title: 'Asunto de la Solicitud',
      description: 'Breve descripción del trámite a realizar',
      minLength: 5,
    },
    facultad: {
      type: 'string',
      title: 'Facultad / Escuela',
      enum: [
        'Ingeniería de Sistemas e Informática',
        'Derecho y Ciencias Políticas',
        'Ciencias de la Salud',
        'Educación',
      ],
    },
    correoNotificacion: {
      type: 'string',
      title: 'Correo de Notificación',
      format: 'email',
    },
    aceptaTerminos: {
      type: 'boolean',
      title: 'Declaración jurada de veracidad de documentos físicos',
    },
  },
};

export const VentanillaPresencialPage: React.FC = () => {
  // Estado para la búsqueda de administrado por DNI
  const [dni, setDni] = useState('');
  const [administrado, setAdministrado] = useState<{ nombre: string; dni: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Estado para el trámite y recepción de folios
  const [selectedTramiteId, setSelectedTramiteId] = useState('');
  const [folios, setFolios] = useState<number>(1);
  const [schema] = useState<JSONSchema | null>(ESQUEMA_MOCK_TUPA);

  // Estado del ticket generado
  const [ticketGenerado, setTicketGenerado] = useState<{
    codigoCUT: string;
    administrado: string;
    dni: string;
    tramite: string;
    folios: number;
    fecha: string;
  } | null>(null);

  const [anchoPapel, setAnchoPapel] = useState<'80mm' | '58mm'>('80mm');
  const { printTicket } = useThermalPrinter();

  // Búsqueda simulada por DNI
  const handleBuscarDni = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni || dni.length !== 8) {
      alert('Ingrese un DNI válido de 8 dígitos');
      return;
    }

    setIsSearching(true);
    // Simulación de respuesta de API
    setTimeout(() => {
      setAdministrado({
        dni,
        nombre: 'JUAN PÉREZ GÓMEZ',
      });
      setIsSearching(false);
    }, 400);
  };

  // Procesar registro del trámite
  const handleFormSubmit = () => {
    if (!administrado) {
      alert('Debe buscar y seleccionar un administrado primero');
      return;
    }

    if (!selectedTramiteId) {
      alert('Debe seleccionar un procedimiento TUPA');
      return;
    }

    // Generar datos del ticket e invocar la impresión
    const nuevoTicket = {
      codigoCUT: `CUT-${Math.floor(100000 + Math.random() * 900000)}`,
      administrado: administrado.nombre,
      dni: administrado.dni,
      tramite: selectedTramiteId,
      folios: folios,
      fecha: new Date().toLocaleString('es-PE'),
    };

    setTicketGenerado(nuevoTicket);

    // Disparar la impresión automática
    setTimeout(() => {
      printTicket('thermal-ticket');
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera de Ventanilla */}
        <header className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Mesa de Partes - Ventanilla Presencial</h1>
            <p className="text-sm text-gray-500">Módulo M2 - Registro Ágil de Trámites Físicos</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-green-100 text-green-800">
              Operador Activo
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Izquierdo / Formulario Único de Atención (2 columnas) */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Búsqueda Rápida de Administrado */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-md font-bold text-gray-700 mb-3">1. Datos del Administrado</h2>
              <form onSubmit={handleBuscarDni} className="flex gap-3">
                <input
                  type="text"
                  maxLength={8}
                  placeholder="Ingrese DNI (8 dígitos)"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900 transition-colors"
                >
                  {isSearching ? 'Buscando...' : 'Buscar DNI'}
                </button>
              </form>

              {administrado && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
                  <p className="text-blue-900 font-semibold">{administrado.nombre}</p>
                  <p className="text-blue-700">DNI: {administrado.dni}</p>
                </div>
              )}
            </div>

            {/* 2. Selección de Trámite TUPA y Recepción de Folios */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-md font-bold text-gray-700 mb-3">2. Procedimiento TUPA y Recepción</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Procedimiento TUPA</label>
                  <select
                    value={selectedTramiteId}
                    onChange={(e) => setSelectedTramiteId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none text-sm"
                  >
                    <option value="">-- Seleccionar Procedimiento --</option>
                    <option value="TUPA-001: Constancia de Estudios">TUPA-001: Constancia de Estudios</option>
                    <option value="TUPA-002: Solicitud de Rectificación de Matrícula">TUPA-002: Solicitud de Rectificación de Matrícula</option>
                    <option value="TUPA-003: Expedición de Grado Académico / Titulo">TUPA-003: Expedición de Grado Académico / Título</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Folios Físicos</label>
                  <input
                    type="number"
                    min={1}
                    value={folios}
                    onChange={(e) => setFolios(parseInt(e.target.value) || 1)}
                    className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Formulario Dinámico Paramétrico */}
              {selectedTramiteId && schema && (
                <div className="mt-6 border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-3">Requisitos Paramétricos del Trámite</h3>
                  <DynamicSchemaForm schema={schema} onSubmit={handleFormSubmit} />
                </div>
              )}
            </div>
          </div>

          {/* Panel Derecho / Vista Previa e Impresión de Ticket (1 columna) */}
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-md font-bold text-gray-700 mb-3">3. Previsualización de Ticket</h2>

              <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-medium text-gray-600">Ancho Impresora POS:</label>
                <select
                  value={anchoPapel}
                  onChange={(e) => setAnchoPapel(e.target.value as '80mm' | '58mm')}
                  className="text-xs border border-gray-300 rounded p-1"
                >
                  <option value="80mm">Papel 80mm</option>
                  <option value="58mm">Papel 58mm</option>
                </select>
              </div>

              {ticketGenerado ? (
                <div>
                  <ThermalTicketPreview paperWidth={anchoPapel} ticketData={ticketGenerado} />
                  
                  <button
                    onClick={() => printTicket('thermal-ticket')}
                    className="w-full mt-4 bg-emerald-600 text-white py-2 px-4 rounded-md hover:bg-emerald-700 transition-colors font-medium text-sm flex items-center justify-center space-x-2"
                  >
                    <span>Reimprimir Ticket POS</span>
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-md p-8 text-center text-gray-400 text-xs">
                  Complete el registro para generar y previsualizar el ticket térmico automáticamente.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};